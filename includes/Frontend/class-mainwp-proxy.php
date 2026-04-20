<?php
/**
 * Burst Statistics – MainWP Proxy (Child Site)
 *
 * Exposes a single REST endpoint (`burst/v1/mainwp-auth`) that the MainWP
 * dashboard calls during a full page load.  It:
 *
 *   1. Verifies the asymmetric signature sent by the dashboard.
 *   2. Resolves the admin user named in the request.
 *   3. Issues (or reuses) a WP Application Password token for that user.
 *   4. Returns the token, a REST nonce, user capabilities, and any
 *      localization data the dashboard React app needs.
 *
 * ── Security model ────────────────────────────────────────────────────────────
 * The dashboard holds an RSA private key; the child stores the matching public
 * key in `mainwp_child_pubkey`.  Every request is signed over `$function.$nonce`
 * so replays are not possible.  This mirrors what MainWP core does in
 * MainWP_Connect::get_post_data_authed().
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @package Burst\Frontend
 */

namespace Burst\Frontend;

use Burst\Traits\Helper;
use Burst\Traits\Sanitize;
use Burst\Traits\Admin_Helper;
use WP_REST_Response;
use WP_REST_Server;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MainWP_Proxy {
	use Helper;
	use Sanitize;
	use Admin_Helper;

	/**
	 * Meta key used to persist the Application Password token between requests.
	 * Storing the token avoids creating a new Application Password on every page load.
	 */
	private const APP_TOKEN_META_KEY = 'burst_mainwp_app_token';

	/**
	 * Display name given to the Application Password created for this integration.
	 */
	private const APP_PASSWORD_NAME = 'Burst MainWP';

	/**
	 * Register REST routes.  Call from a service-container or direct `init()`.
	 */
	public function init(): void {
		$this->send_cors_headers();
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
	}

	/**
	 * Register the `burst/v1/mainwp-auth` endpoint.
	 *
	 * Permission callback is `__return_true` — authentication is handled inside
	 * the callback via MainWP signature verification, not via WP's cookie/token
	 * system, because the request originates from a server-to-server call.
	 */
	public function register_routes(): void {
		register_rest_route(
			'burst/v1',
			'/mainwp-auth',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'handle_auth_request' ],
				'permission_callback' => '__return_true',
			]
		);
	}

	/**
	 * Send CORS headers to allow the MainWP dashboard to make cross-origin requests.
	 *
	 * The dashboard's origin is dynamic and must be reflected back in the
	 * `Access-Control-Allow-Origin` header.  We also allow credentials and
	 * necessary headers for the dashboard's REST requests.
	 *
	 * If the request method is OPTIONS, we return a 204 immediately after
	 * sending the headers, without invoking any REST route callbacks, since
	 * this is a preflight request.
	 */
	private function send_cors_headers(): void {
		if ( isset( $_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'] ) && ! str_contains( sanitize_text_field( wp_unslash( $_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'] ) ), 'x-burstmainwp' ) ) {
			return;
		}

		$origin = isset( $_SERVER['HTTP_ORIGIN'] ) ? sanitize_url( wp_unslash( $_SERVER['HTTP_ORIGIN'] ) ) : '';
		if ( empty( $origin ) ) {
			return;
		}

		if ( empty( get_option( 'mainwp_child_pubkey' ) ) ) {
			return;
		}

		header_remove( 'Access-Control-Allow-Origin' );
		header_remove( 'Access-Control-Allow-Headers' );
		header_remove( 'Access-Control-Allow-Methods' );
		header_remove( 'Access-Control-Allow-Credentials' );

		header( 'Access-Control-Allow-Origin: ' . $origin );
		header( 'Access-Control-Allow-Credentials: true' );
		header( 'Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS' );
		header( 'Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce, X-Burst-Auth-Cookie, X-Requested-With, X-Burst-Share-Token, X-BurstMainWP' );
		header( 'Access-Control-Expose-Headers: X-WP-Total, X-WP-TotalPages, Link' );
		header( 'Vary: Origin' );

		if ( isset( $_SERVER['REQUEST_METHOD'] ) && 'OPTIONS' === $_SERVER['REQUEST_METHOD'] ) {
			status_header( 204 );
			exit;
		}
	}

	/**
	 * Handle an incoming auth request from the MainWP dashboard.
	 *
	 * Steps:
	 *  1. Decode and validate the JSON body.
	 *  2. Verify the MainWP asymmetric signature.
	 *  3. Resolve the admin user; confirm Burst management capability.
	 *  4. Switch to that user context and generate a REST nonce.
	 *  5. Retrieve or create an Application Password token.
	 *  6. Return token + nonce + capabilities + localization data.
	 *
	 * @return WP_REST_Response 200 on success; 401/403/500 on failure.
	 */
	public function handle_auth_request(): WP_REST_Response {
		$user = wp_get_current_user();

		$request_body = file_get_contents( 'php://input' );
		$body         = json_decode( $request_body, true );

		if ( (int) $user->ID <= 0 ) {
			if ( empty( $body ) || ! is_array( $body ) ) {
				return new WP_REST_Response( [ 'error' => 'Invalid MainWP auth body.' ], 403 );
			}

			if ( ! $this->verify_signature( $body ) ) {
				return new WP_REST_Response( [ 'error' => 'MainWP signature verification failed.' ], 403 );
			}

			$username      = sanitize_user( $body['user'] ?? '' );
			$resolved_user = get_user_by( 'login', $username );

			if ( ! $resolved_user ) {
				return new WP_REST_Response( [ 'error' => 'MainWP user not found on child site.' ], 403 );
			}

			if ( ! user_can( $resolved_user, 'manage_burst_statistics' ) ) {
				return new WP_REST_Response( [ 'error' => 'MainWP user lacks Burst capability.' ], 403 );
			}

			wp_set_current_user( (int) $resolved_user->ID );
			$user = wp_get_current_user();
		}

		$token = $this->get_or_create_app_token( $user->ID );
		if ( is_wp_error( $token ) ) {
			return new WP_REST_Response(
				[
					'error'      => $token->get_error_message(),
					'error_code' => $token->get_error_code(),
					'user_id'    => (int) $user->ID,
				],
				500
			);
		}

		// Store dashboard origin for CORS validation.
		$origin = isset( $_SERVER['HTTP_ORIGIN'] ) ? sanitize_url( wp_unslash( $_SERVER['HTTP_ORIGIN'] ) ) : '';
		if ( ! empty( $origin ) ) {
			update_option( 'burst_mainwp_dashboard_url', $origin );
		}

		return new WP_REST_Response(
			[
				'token'             => $token,
				'root_url'          => get_rest_url( null, '/' ),
				'localization_data' => $this->localized_settings( [ 'json_translations' => '' ] ),
			],
			200
		);
	}

	/**
	 * Determine if the incoming request is a valid, signed MainWP request.
	 *
	 * This is used as a gatekeeper in admin screens that are shared between
	 * regular WP users and the MainWP dashboard, to conditionally show/hide
	 * sensitive data and actions.
	 *
	 * @return bool True when the request is a valid MainWP-signed request.
	 */
	public function is_mainwp_signed_request(): bool {
		$request_body = file_get_contents( 'php://input' );
		$body         = json_decode( $request_body, true );

		if ( empty( $body ) || ! is_array( $body ) ) {
			return false;
		}

		if ( ! $this->verify_signature( $body ) ) {
			return false;
		}

		$username = sanitize_user( $body['user'] ?? '' );
		$user     = get_user_by( 'login', $username );

		if ( ! $user ) {
			return false;
		}

		if ( ! user_can( $user, 'manage_burst_statistics' ) ) {
			return false;
		}

		wp_set_current_user( $user->ID );

		return true;
	}

	/**
	 * Determine if the current request is authenticated as the MainWP dashboard.
	 *
	 * This is used in REST route permission callbacks to allow access to certain
	 * routes only when the request is properly signed by the MainWP dashboard.
	 *
	 * @return bool True when the request is authenticated as MainWP.
	 */
	public function is_mainwp_authenticated(): bool {
		$auth_header = sanitize_text_field( wp_unslash( $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '' ) );

		if ( ! empty( $auth_header ) && stripos( $auth_header, 'basic ' ) === 0 ) {
			// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
			$credentials = base64_decode( substr( $auth_header, 6 ), true );
			if ( ! $credentials ) {
				return false;
			}
			$parts = explode( ':', $credentials, 2 );
			if ( count( $parts ) !== 2 ) {
				return false;
			}
			$username = $parts[0];
			$password = $parts[1];
			$is_valid = wp_authenticate_application_password( null, $username, $password );
			if ( is_wp_error( $is_valid ) ) {
				return false;
			}
			$user = get_user_by( 'login', $username );
			wp_set_current_user( $user->ID );

			return true;
		}

		return false;
	}

	/**
	 * Verify the asymmetric signature attached to a dashboard request.
	 *
	 * The dashboard signs `$function . $nonce` with its RSA private key.
	 * The child verifies with the matching public key stored in
	 * `mainwp_child_pubkey` (base64-encoded PEM).
	 *
	 * `verifylib` == 1 means the dashboard used phpseclib (SHA-1 + PKCS#1 v1.5).
	 * `verifylib` == 0 means standard OpenSSL with SHA-256.
	 *
	 * @param array $body Decoded JSON body from the dashboard.
	 * @return bool True when the signature is valid.
	 */
	private function verify_signature( array $body ): bool {
		$pubkey_stored = get_option( 'mainwp_child_pubkey' );
		$signature_b64 = $body['mainwpsignature'] ?? '';
		$nonce         = $body['nonce'] ?? '';
		$function      = $body['function'] ?? '';
		$use_seclib    = ! empty( $body['verifylib'] );

		if ( empty( $pubkey_stored ) || empty( $signature_b64 ) || $nonce === '' || empty( $function ) ) {
			return false;
		}

		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		$pubkey_pem = base64_decode( $pubkey_stored, true );

		if ( empty( $pubkey_pem ) || ! str_contains( $pubkey_pem, '-----BEGIN' ) ) {
			self::error_log( 'Pubkey decode failed or value is not a PEM block.' );
			return false;
		}

		$sign_payload = $function . $nonce;
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		$signature = base64_decode( $signature_b64, true );
		$algorithm = $use_seclib ? OPENSSL_ALGO_SHA1 : OPENSSL_ALGO_SHA256;
		$result    = openssl_verify( $sign_payload, $signature, $pubkey_pem, $algorithm );

		if ( $result !== 1 ) {
			$msg = openssl_error_string();
			while ( $msg ) {
				self::error_log( 'OpenSSL verification error: ' . $msg );
				$msg = openssl_error_string();
			}
		}

		return $result === 1;
	}

	/**
	 * Return an existing short-lived Application Password token for this user,
	 * or create a fresh one.
	 *
	 * We use a transient (1-hour TTL) instead of persistent user meta so the
	 * plain-text password is never stored long-term. When the transient expires
	 * the old Application Password is deleted and a new one is created on the
	 * next request.
	 *
	 * @param int $user_id WP user ID.
	 * @return string|\WP_Error Base64 `user:password` token, or WP_Error on failure.
	 */
	private function get_or_create_app_token( int $user_id ): string|\WP_Error {
		if ( $user_id <= 0 ) {
			return new \WP_Error( 'invalid_mainwp_user', 'Could not resolve MainWP user for app password generation.' );
		}

		$transient_key = self::APP_TOKEN_META_KEY . '_' . $user_id;
		$cached        = get_transient( $transient_key );

		if ( ! empty( $cached ) ) {
			return $cached;
		}

		if ( ! class_exists( 'WP_Application_Passwords' ) ) {
			return new \WP_Error( 'app_passwords_unavailable', 'Application Passwords not available.' );
		}

		// Delete any existing Burst MainWP app passwords to prevent accumulation.
		$existing = \WP_Application_Passwords::get_user_application_passwords( $user_id );
		foreach ( $existing as $app_password ) {
			if ( $app_password['name'] === self::APP_PASSWORD_NAME ) {
				\WP_Application_Passwords::delete_application_password(
					$user_id,
					$app_password['uuid']
				);
			}
		}

		$result = \WP_Application_Passwords::create_new_application_password(
			$user_id,
			[ 'name' => self::APP_PASSWORD_NAME ]
		);

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$user = get_userdata( $user_id );
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
		$token = base64_encode( $user->user_login . ':' . $result[0] );

		// Store for 1 hour only — plain-text token never persisted long-term.
		set_transient( $transient_key, $token, HOUR_IN_SECONDS );

		return $token;
	}
}
