<?php
/**
 * .htaccess diagnostic collector.
 *
 * @package Burst\Admin\Diagnostics
 */

namespace Burst\Admin\Diagnostics;

defined( 'ABSPATH' ) || exit;

/**
 * Class Htaccess_Collector
 *
 * Scans the .htaccess files that govern the tracking endpoint — the site root,
 * wp-content and the plugins directory where endpoint.php lives — for the common
 * security/hosting rules that block direct access to PHP files or to the plugins
 * directory. On NGINX there is no .htaccess, so it cannot be the cause and the
 * check passes.
 */
class Htaccess_Collector extends Diagnostic_Collector {

	/**
	 * {@inheritDoc}
	 */
	public function key(): string {
		return 'htaccess';
	}

	/**
	 * {@inheritDoc}
	 */
	public function collect(): array {
		$label = __( 'Server access rules (.htaccess)', 'burst-statistics' );

		// NGINX does not use .htaccess, so it can never be the cause. Report nothing
		// rather than a green line the user cannot act on.
		$server = isset( $_SERVER['SERVER_SOFTWARE'] ) ? sanitize_text_field( wp_unslash( $_SERVER['SERVER_SOFTWARE'] ) ) : '';
		if ( false !== stripos( $server, 'nginx' ) ) {
			return [];
		}

		$matched = [];
		foreach ( $this->htaccess_files() as $name => $file ) {
			if ( ! is_readable( $file ) ) {
				continue;
			}

			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reading a local config file, not a remote resource.
			$rules = $this->find_blocking_rules( (string) file_get_contents( $file ) );
			if ( ! empty( $rules ) ) {
				$matched[] = [
					'file'  => $name,
					'rules' => $rules,
				];
			}
		}

		if ( empty( $matched ) ) {
			return $this->result(
				'ok',
				$label,
				__( 'No .htaccess rules that could block the tracking endpoint were found.', 'burst-statistics' )
			);
		}

		return $this->result(
			'warning',
			$label,
			__( 'An .htaccess rule may be blocking the request to the tracking endpoint.', 'burst-statistics' ),
			[ 'matched_rules' => $matched ]
		);
	}

	/**
	 * The .htaccess files that can govern a request to endpoint.php, from the site
	 * root down to the plugins directory where the endpoint lives. A blocking rule
	 * in any of them can stop the beacon.
	 *
	 * @return array<string, string> Map of display name => absolute path.
	 */
	private function htaccess_files(): array {
		$files = [ '.htaccess' => ABSPATH . '.htaccess' ];

		if ( defined( 'WP_CONTENT_DIR' ) ) {
			$files['wp-content/.htaccess'] = WP_CONTENT_DIR . '/.htaccess';
		}

		if ( defined( 'WP_PLUGIN_DIR' ) ) {
			$files['wp-content/plugins/.htaccess'] = WP_PLUGIN_DIR . '/.htaccess';
		}

		return $files;
	}

	/**
	 * Scan .htaccess content for the security/hardening rules that most commonly
	 * block a direct request to endpoint.php. We do not look for Burst-specific
	 * rules — in practice the cause is a generic block on PHP files or on the
	 * plugins directory, added by a security plugin or the host.
	 *
	 * @param string $contents Raw .htaccess content.
	 * @return string[] Human-readable descriptions of the matched rules.
	 */
	private function find_blocking_rules( string $contents ): array {
		// Drop comment lines so a commented-out example never triggers a match.
		$contents = (string) preg_replace( '/^\s*#.*$/m', '', $contents );
		$found    = [];

		// The classic "block direct access to PHP files" hardening: a
		// <Files>/<FilesMatch> block on a generic php pattern combined with a deny
		// directive. It forbids endpoint.php along with every other PHP file.
		if ( $this->has_php_files_deny( $contents ) ) {
			$found[] = __( 'A <Files> rule denies direct access to .php files.', 'burst-statistics' );
		}

		// Hosts and security plugins disable PHP execution in the plugins folder
		// with a forbidding rewrite rule. Solid Security writes it with escaped
		// characters (`^wp\-content/plugins/.*\.(?:php[1-7]?|pht|phtml?)$ - [NC,F]`),
		// so a strict pattern would miss the most common real-world rule. Match
		// loosely instead: a single RewriteRule line that targets plugins, mentions
		// php and carries the [F] (forbidden) flag.
		if ( preg_match( '/RewriteRule\s+[^\n]*plugins[^\n]*ph[^\n]*\[[^\]]*F/i', $contents ) ) {
			$found[] = __( 'A rewrite rule forbids PHP requests to the plugins directory.', 'burst-statistics' );
		}

		// A blanket deny placed directly in a directory that contains endpoint.php
		// (typically wp-content/plugins/.htaccess), i.e. outside any <Files> block.
		$outside_files = (string) preg_replace( '/<Files(?:Match)?[^>]*>.*?<\/Files(?:Match)?>/is', '', $contents );
		if ( empty( $found ) && $this->denies_access( $outside_files ) ) {
			$found[] = __( 'Access to the directory is denied for all requests.', 'burst-statistics' );
		}

		return $found;
	}

	/**
	 * Whether a <Files>/<FilesMatch> deny block applies to PHP files in general.
	 *
	 * Hardening a single specific file (`<Files wp-config.php>`, `<Files xmlrpc.php>`)
	 * is extremely common and cannot block endpoint.php, so those never count. Only a
	 * block whose target is a wildcard or regex php pattern (`*.php`, `"\.php$"`,
	 * `"\.(php|phtml)$"`) denies the endpoint too. All blocks are checked, so a benign
	 * wp-config.php block cannot mask a real generic one later in the file.
	 *
	 * @param string $contents Comment-stripped .htaccess content.
	 */
	private function has_php_files_deny( string $contents ): bool {
		if ( ! preg_match_all( '/<Files(?:Match)?\s+([^>]*)>(.*?)<\/Files(?:Match)?>/is', $contents, $blocks, PREG_SET_ORDER ) ) {
			return false;
		}

		foreach ( $blocks as $block ) {
			$target = trim( $block[1], " \t\"'" );
			// `ph` covers php, php5, pht and phtml patterns.
			if ( false === stripos( $target, 'ph' ) || ! $this->denies_access( $block[2] ) ) {
				continue;
			}

			// A literal single filename other than endpoint.php cannot block the endpoint.
			if ( preg_match( '/^[\w.-]+\.php$/i', $target ) && 0 !== strcasecmp( $target, 'endpoint.php' ) ) {
				continue;
			}

			return true;
		}

		return false;
	}

	/**
	 * Whether an .htaccess fragment contains a directive that denies access.
	 *
	 * @param string $chunk .htaccess fragment.
	 */
	private function denies_access( string $chunk ): bool {
		return (bool) preg_match( '/Deny\s+from\s+all|Require\s+all\s+denied/i', $chunk );
	}
}
