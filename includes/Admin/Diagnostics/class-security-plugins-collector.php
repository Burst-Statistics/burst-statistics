<?php
/**
 * Security-plugin diagnostic collector.
 *
 * @package Burst\Admin\Diagnostics
 */

namespace Burst\Admin\Diagnostics;

defined( 'ABSPATH' ) || exit;

/**
 * Class Security_Plugins_Collector
 *
 * Detects security plugins known to block the REST API, and third-party callbacks
 * on the rest_authentication_errors filter that can force authentication — either
 * of which can reject the anonymous tracking beacon when REST tracking is used.
 */
class Security_Plugins_Collector extends Diagnostic_Collector {

	/**
	 * Plugin basename => display name for plugins that can block the REST API.
	 *
	 * @var array<string, string>
	 */
	private const REST_BLOCKING_PLUGINS = [
		'wordfence/wordfence.php'                       => 'Wordfence Security',
		'better-wp-security/better-wp-security.php'     => 'Solid Security (iThemes Security)',
		'ithemes-security-pro/ithemes-security-pro.php' => 'Solid Security Pro',
		'disable-wp-rest-api/disable-wp-rest-api.php'   => 'Disable REST API',
		'wp-cerber/wp-cerber.php'                       => 'WP Cerber Security',
		'wp-hide-security-enhancer/wp-hide.php'         => 'WP Hide & Security Enhancer',
	];

	/**
	 * Callbacks WordPress core itself attaches to rest_authentication_errors.
	 * Anything else on that filter is third-party and may be forcing auth.
	 *
	 * @var string[]
	 */
	private const CORE_REST_AUTH_CALLBACKS = [
		'rest_cookie_check_errors',
		'rest_application_password_check_errors',
	];

	/**
	 * {@inheritDoc}
	 */
	public function key(): string {
		return 'security_plugins';
	}

	/**
	 * {@inheritDoc}
	 */
	public function collect(): array {
		$label  = __( 'Security plugins blocking the REST API', 'burst-statistics' );
		$active = $this->active_plugins();

		$found = [];
		foreach ( self::REST_BLOCKING_PLUGINS as $file => $name ) {
			if ( in_array( $file, $active, true ) ) {
				$found[] = $name;
			}
		}

		$forces_auth = $this->has_external_rest_auth_filter();

		if ( empty( $found ) && ! $forces_auth ) {
			return $this->result(
				'ok',
				$label,
				__( 'No known REST-API-blocking security plugin or authentication filter was detected.', 'burst-statistics' )
			);
		}

		$summary = ! empty( $found )
			? __( 'A security plugin that can block the REST API is active. If tracking uses the REST API, it may be blocked.', 'burst-statistics' )
			: __( 'A filter is forcing authentication on REST requests, which can block the tracking beacon.', 'burst-statistics' );

		return $this->result(
			'warning',
			$label,
			$summary,
			[
				'active_plugins'             => $found,
				'forces_rest_authentication' => $forces_auth,
			]
		);
	}

	/**
	 * Whether a non-core callback is attached to rest_authentication_errors.
	 *
	 * WordPress core attaches rest_cookie_check_errors itself; any other callback
	 * is a third party that may be forcing authentication on REST requests.
	 */
	private function has_external_rest_auth_filter(): bool {
		global $wp_filter;
		if ( ! isset( $wp_filter['rest_authentication_errors'] ) ) {
			return false;
		}

		foreach ( $wp_filter['rest_authentication_errors']->callbacks as $priority_callbacks ) {
			foreach ( $priority_callbacks as $callback ) {
				$name = $this->callback_name( $callback['function'] ?? null );
				if ( '' !== $name && ! in_array( $name, self::CORE_REST_AUTH_CALLBACKS, true ) ) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Resolve a registered callback to a readable name.
	 *
	 * Mixed $callback: a WordPress callback is polymorphic — a string function name,
	 * a [object|class, method] array, or a Closure — so the parameter is genuinely
	 * of mixed type.
	 *
	 * @param mixed $callback The registered callback.
	 */
	private function callback_name( mixed $callback ): string {
		if ( is_string( $callback ) ) {
			return $callback;
		}

		if ( is_array( $callback ) && isset( $callback[0], $callback[1] ) ) {
			$target = is_object( $callback[0] ) ? get_class( $callback[0] ) : (string) $callback[0];
			return $target . '::' . $callback[1];
		}

		if ( $callback instanceof \Closure ) {
			return 'Closure';
		}

		return '';
	}
}
