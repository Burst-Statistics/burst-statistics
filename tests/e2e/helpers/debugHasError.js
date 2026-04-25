const {getDebugLog} = require("./getDebugLog");

async function debugHasError() {
    const log = await getDebugLog();

    const errorPattern = /(PHP\s+(Fatal|Parse|Warning|Notice|Error|Recoverable\s+fatal|Deprecated)|WordPress\s+database\s+error|QueryData\s+error)/i;
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
            /touch\(\): Unable to create file.*wp-content\/uploads\/wc-logs.*Permission denied/.test(line) ||
            /EDD[\\]Gateways[\\]PayPal[\\]refund_transaction/.test(line) ||
            /EDD[\\]/.test(line) ||
            /easy-digital-downloads/.test(line) ||
            /wp_edd_/.test(line) ||
            /chmod\(\): No such file or directory in .*wp-admin\/includes\/class-wp-filesystem-direct\.php/.test(line);
        return !isExcluded;
    });

    // Log the filtered lines
    console.log(filteredLines.join('\n'));

    // Then check for error pattern
    return filteredLines.some(line => errorPattern.test(line));
}

export {debugHasError};