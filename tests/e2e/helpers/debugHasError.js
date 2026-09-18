const {getDebugLog} = require("./getDebugLog");

async function debugHasError() {
    const log = await getDebugLog();

    // PHP / WordPress errors, plus Burst's own error_log() lines that signal a
    // bug rather than an informational message: a missing class (the autoloader
    // could not resolve a reference), a table outside the allowlist, a metric
    // the sanitizer rejected, or a Statistics_Query build error.
    const errorPattern = /(PHP\s+(Fatal|Parse|Warning|Notice|Error|Recoverable\s+fatal|Deprecated)|WordPress\s+database\s+error|QueryData\s+error|Statistics_Query\s+error|Burst: Class .* not found|does not exist in predefined list|is not allowed\. Returning default)/i;
    const lines = log.split('\n');

    // Filter out excluded errors first.
    // Translations loaded too early errors from updraftplus,
    // woocommerce
    // all-in-one-wp-security-and-firewall,
    // connect(): Could not access filesystem errors
    const filteredLines = lines.filter(line => {
        const isExcluded =
            /<code>(updraftplus|all-in-one-wp-security-and-firewall|woocommerce)<\/code>/.test(line) ||
            /as_unschedule_all_actions/.test(line) ||
            /connect\(\): Could not access filesystem/.test(line) ||
            // wp-cli internals are not ours to fix; the bundled php-cli-tools is not
            // yet PHP 8.5 compatible in the latest stable wp-cli release (2.12.0).
            /in phar:\/\/\/usr\/local\/bin\/wp\//.test(line) ||
            /touch\(\): Unable to create file.*wp-content\/uploads\/wc-logs.*Permission denied/.test(line) ||
            /EDD[\\]Gateways[\\]PayPal[\\]refund_transaction/.test(line) ||
            /EDD[\\]/.test(line) ||
            /easy-digital-downloads/.test(line) ||
            /wp_edd_/.test(line) ||
            /subscriben/.test(line) ||
            /chmod\(\): No such file or directory in .*wp-admin\/includes\/class-wp-filesystem-direct\.php/.test(line) ||
            /touch\(\): Utime failed: Operation not permitted/.test(line) ||
            /fileperms\(\): stat failed for .*wp-content\/uploads\/edd\/.*edd-stripe-rate-limiting\.log/.test(line);
        return !isExcluded;
    });

    // Log the filtered lines
    console.log(filteredLines.join('\n'));

    // Then check for error pattern
    return filteredLines.some(line => errorPattern.test(line));
}

export {debugHasError};
