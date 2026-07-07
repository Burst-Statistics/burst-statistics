<?php
namespace Burst\Admin\Search_Console;

use Burst\Traits\Helper;
use Burst\Traits\Admin_Helper;

defined( 'ABSPATH' ) || die();

/**
 * Google Search Console OAuth connect flow (plugin side).
 *
 * The OAuth client lives on the Burst relay. This class mints the PKCE challenge
 * and a CSRF nonce, hands the browser to the relay's /start endpoint, receives
 * the authorization code back on admin-post.php, and exchanges it for tokens via
 * the relay. No client secret ever touches the plugin. Scope is owned by the
 * relay (read-only webmasters); the plugin never requests it.
 */
class Search_Console {
	use Helper;
	use Admin_Helper;

	/**
	 * Token store instance.
	 *
	 * @var \Burst\Admin\Search_Console\Token_Store|null Token_Store Instance.
	 */
	private Token_Store|null $token_store = null;

	/**
	 * Transient holding the in-flight connect attempt: the CSRF nonce and the
	 * PKCE verifier, bound to the user who started it. Existence acts as a
	 * single-flight lock. TTL is 5 minutes (see start_connect()), matching the
	 * relay's 5-minute state expiry.
	 */
	private const TRANSIENT = 'burst_gsc_connect';

	/**
	 * Transient recording that the last in-flight connect attempt ended without
	 * success (the user cancelled on the relay/Google consent screen, or the code
	 * exchange failed). Stores the owning user id so the status poll only surfaces
	 * it to the admin who started the attempt. Consumed by the opener's poll;
	 * cleared whenever a new attempt starts or is cancelled.
	 */
	private const FAIL_TRANSIENT = 'burst_gsc_connect_failed';

	/**
	 * Lazily instantiate the token store. Kept out of the constructor so the
	 * per-request register_oauth_callback() wiring, which only needs to add a
	 * hook, does not build a Token_Store on every admin request.
	 */
	private function token_store(): Token_Store {
		if ( null === $this->token_store ) {
			$this->token_store = new Token_Store();
		}
		return $this->token_store;
	}

	/**
	 * Resolve the relay base URL. Overridable via BURST_GSC_RELAY_URL for testing
	 * against a local relay (the production relay rejects non-HTTPS / localhost).
	 */
	public static function relay_base(): string {
		$default = 'https://search-console.burst-statistics.com/oauth/google';
		$base    = ( defined( 'BURST_GSC_RELAY_URL' ) && '' !== BURST_GSC_RELAY_URL )
			? BURST_GSC_RELAY_URL
			: $default;
		return untrailingslashit( esc_url_raw( $base ) );
	}

	/**
	 * Register hooks that sit behind the admin capability gate: the REST actions
	 * (connect / disconnect / status) and the settings UI registration.
	 */
	public function init(): void {
		// The settings group and its enable toggle are always registered so the
		// feature can be switched on; everything else stays behind the toggle.
		// Priority 20: the group is appended to the Integrations menu item, which
		// Integrations_Settings adds at the default priority 10.
		add_filter( 'burst_menu', [ $this, 'add_menu' ], 20 );
		add_filter( 'burst_fields', [ $this, 'add_field' ] );

		if ( ! $this->get_option_bool( 'enable_search_console' ) ) {
			return;
		}

		add_filter( 'burst_do_action', [ $this, 'handle_do_action' ], 10, 2 );
		add_filter( 'burst_get_action', [ $this, 'handle_get_action' ], 10, 2 );
		add_filter( 'burst_localize_script', [ $this, 'add_to_localize_script' ] );

		( new Sync() )->init();
	}

	/**
	 * Register the OAuth popup callback. This is wired up for every admin request,
	 * not behind the capability gate, because the relay redirects the popup to
	 * admin-post.php and the only trust anchor is the single-use OAuth nonce.
	 */
	public function register_oauth_callback(): void {
		// This action is locked to the user who initiated it.
		add_action( 'admin_post_burst_gsc_callback', [ $this, 'handle_oauth_callback' ] );
	}

	/**
	 * Handle write actions dispatched through burst/v1/do_action/{action}.
	 * The dispatcher has already enforced manage capability + nonce.
	 *
	 * @param array  $output Default response payload.
	 * @param string $action Action slug.
	 */
	public function handle_do_action( array $output, string $action ): array {
		if ( ! $this->user_can_manage() ) {
			return $output;
		}

		return match ( $action ) {
			'gsc_connect'    => $this->start_connect(),
			'gsc_cancel'     => $this->cancel_connect(),
			'gsc_disconnect' => $this->disconnect(),
			default          => $output,
		};
	}

	/**
	 * Handle read actions dispatched through burst/v1/get_action/{action}.
	 * The dispatcher has already enforced the view capability + nonce. Status is a
	 * read, so it lives on the view-gated endpoint: a viewer (e.g. an editor) can
	 * poll the connection state without the manage capability the connect/disconnect
	 * write actions require.
	 *
	 * @param array  $output Default response payload.
	 * @param string $action Action slug.
	 */
	public function handle_get_action( array $output, string $action ): array {
		if ( ! $this->user_can_view() ) {
			return $output;
		}

		return match ( $action ) {
			'get_gsc_status' => $this->status_payload(),
			default          => $output,
		};
	}

	/**
	 * Start a connect attempt: enforce the single-flight lock, mint the PKCE
	 * verifier + CSRF nonce, store them server-side, and return the relay /start
	 * URL for the popup.
	 *
	 * @return array{url?:string,error?:string}
	 */
	private function start_connect(): array {
		$existing = get_transient( self::TRANSIENT );
		if (
			is_array( $existing )
			&& isset( $existing['user_id'] )
			&& (int) $existing['user_id'] !== get_current_user_id()
		) {
			// Another admin is mid-connect; the relay state is single-use.
			return [ 'error' => 'locked' ];
		}

		// A fresh attempt clears any leftover failure flag from a prior cancel.
		delete_transient( self::FAIL_TRANSIENT );

		// PKCE: 43-char URL-safe verifier from a CSPRNG, S256 challenge.
		try {
			// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- PKCE verifier encoding, not obfuscation.
			$verifier = rtrim( strtr( base64_encode( random_bytes( 32 ) ), '+/', '-_' ), '=' );
		} catch ( \Exception $e ) {
			self::error_log( 'GSC: failed to generate PKCE verifier: ' . $e->getMessage() );
			return [ 'error' => 'server' ];
		}
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- PKCE challenge encoding, not obfuscation.
		$challenge = rtrim( strtr( base64_encode( hash( 'sha256', $verifier, true ) ), '+/', '-_' ), '=' );
		$nonce     = wp_generate_password( 32, false );

		set_transient(
			self::TRANSIENT,
			[
				'user_id'       => get_current_user_id(),
				'nonce'         => $nonce,
				'code_verifier' => $verifier,
			],
			5 * MINUTE_IN_SECONDS
		);

		// add_query_arg does not encode the values it appends (only the base
		// URL's pre-existing query string), so encode them here. The relay
		// decodes once and checks the site contains action=burst_gsc_callback.
		$site = admin_url( 'admin-post.php?action=burst_gsc_callback' );
		$url  = add_query_arg(
			[
				'site'           => rawurlencode( $site ),
				'nonce'          => rawurlencode( $nonce ),
				'code_challenge' => rawurlencode( $challenge ),
			],
			self::relay_base() . '/start'
		);

		return [ 'url' => $url ];
	}

	/**
	 * Callback for the OAuth redirect. Verifies the single-use
	 * nonce, exchanges the code for tokens, and renders a static self-closing
	 * page. Never reflects request data into the response.
	 */
	public function handle_oauth_callback(): void {
		// admin-post.php enforces login for this privileged action; require the
		// Burst manage capability on top, mirroring the connect action's gate.
		if ( ! current_user_can( 'manage_burst_statistics' ) ) {
			$this->render_popup( __( 'You do not have permission to complete this connection.', 'burst-statistics' ), false );
		}

		$stored = get_transient( self::TRANSIENT );

		// The OAuth nonce below is the trust anchor; this is not a WP form post.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$nonce = isset( $_GET['nonce'] ) ? sanitize_text_field( wp_unslash( $_GET['nonce'] ) ) : '';
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$code = isset( $_GET['code'] ) ? sanitize_text_field( wp_unslash( $_GET['code'] ) ) : '';
		// OAuth error forwarded by the relay when the user cancels/denies. Used
		// only to pick a message; never reflected into the response.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$error = isset( $_GET['error'] ) ? sanitize_key( wp_unslash( $_GET['error'] ) ) : '';

		if (
			is_array( $stored )
			&& isset( $stored['user_id'] )
			&& (int) $stored['user_id'] !== get_current_user_id()
		) {
			$this->render_popup( __( 'This connection request was started by another account. Please try again.', 'burst-statistics' ), false );
		}

		if (
			! is_array( $stored )
			|| empty( $stored['nonce'] )
			|| '' === $nonce
			|| ! hash_equals( (string) $stored['nonce'], $nonce )
		) {
			$this->render_popup( __( 'This connection request is invalid or has expired. Please try again.', 'burst-statistics' ), false );
		}

		// Single-use: a replayed callback must fail.
		delete_transient( self::TRANSIENT );

		if ( '' === $code ) {
			// No code means the user cancelled/denied (relay forwards ?error) or
			// Google returned nothing. Either way, stop the opener's spinner.
			$this->flag_connect_failed();
			$this->render_popup(
				'access_denied' === $error
					? __( 'Connection cancelled. You can close this window.', 'burst-statistics' )
					: __( 'Google did not return an authorization code. Please try again.', 'burst-statistics' ),
				false
			);
		}

		$ok = $this->token_store()->exchange_code( $code, (string) $stored['code_verifier'] );

		if ( ! $ok ) {
			$this->flag_connect_failed();
		} else {
			// Let the sync resolve the matching property and kick off the first fetch.
			do_action( 'burst_gsc_connected' );
		}

		$this->render_popup(
			$ok
				? __( 'Google Search Console connected. You can close this window.', 'burst-statistics' )
				: __( 'Could not complete the connection. Please try again.', 'burst-statistics' ),
			$ok
		);
	}

	/**
	 * Revoke and delete the stored tokens.
	 *
	 * @return array{status:string}
	 */
	private function disconnect(): array {
		$this->token_store()->revoke();
		$this->token_store()->delete();
		// Force the property to re-resolve on the next sync (the reconnect may use a
		// different Google account), but keep the resolved property, sync cursor and
		// fetched terms. resolve_property() resumes the daily increment when the same
		// property resolves again, and clears the stale data + state when it differs.
		delete_option( 'burst_gsc_property_checked' );
		return [ 'status' => 'disconnected' ];
	}

	/**
	 * Release this user's in-flight connect lock (the single-flight transient).
	 * Only clears it when the lock belongs to the current user, so one admin
	 * cannot cancel another admin's in-flight attempt.
	 *
	 * @return array{status:string}
	 */
	private function cancel_connect(): array {
		$existing = get_transient( self::TRANSIENT );
		if (
			is_array( $existing )
			&& isset( $existing['user_id'] )
			&& (int) $existing['user_id'] === get_current_user_id()
		) {
			delete_transient( self::TRANSIENT );
		}
		delete_transient( self::FAIL_TRANSIENT );
		return [ 'status' => 'cancelled' ];
	}

	/**
	 * Record that the current user's in-flight connect attempt ended without
	 * success, so the status poll can stop the "connecting" spinner immediately
	 * instead of waiting for the 5-minute timeout. Bound to the user who started
	 * the attempt; consumed by status_payload().
	 */
	private function flag_connect_failed(): void {
		set_transient(
			self::FAIL_TRANSIENT,
			[ 'user_id' => get_current_user_id() ],
			5 * MINUTE_IN_SECONDS
		);
	}

	/**
	 * Status payload for the connect poll: the connection state plus whether the
	 * current user's in-flight attempt failed.
	 *
	 * @return array{status:string,connect_failed:bool}
	 */
	private function status_payload(): array {
		$failed    = get_transient( self::FAIL_TRANSIENT );
		$is_failed = is_array( $failed )
			&& isset( $failed['user_id'] )
			&& (int) $failed['user_id'] === get_current_user_id();

		$status  = $this->token_store()->status();
		$payload = [
			'status'         => $status,
			'connect_failed' => $is_failed,
		];

		if ( 'connected' === $status ) {
			// Property + match state are resolved and cached server-side by the sync
			// (no API call here). The UI uses these to choose between the data table
			// and the "no matching site" notice.
			$property = (string) get_option( 'burst_gsc_property', '' );
			$checked  = (bool) get_option( 'burst_gsc_property_checked', false );

			$payload['property']        = $property;
			$payload['property_status'] = '' !== $property ? 'matched' : ( $checked ? 'none' : 'pending' );
		}

		return $payload;
	}

	/**
	 * Render a static, self-closing popup page. No request data is echoed.
	 *
	 * @param string $message Already-translated, human-readable status message.
	 * @param bool   $success Whether the connection succeeded.
	 */
	private function render_popup( string $message, bool $success ): void {
		nocache_headers();
		header( 'Content-Type: text/html; charset=utf-8' );
		?>
		<!doctype html>
		<html lang="<?php echo esc_attr( get_bloginfo( 'language' ) ); ?>">
			<head><meta charset="utf-8"><title>Burst &ndash; Google Search Console</title></head>

			<body style="font-family:sans-serif;padding:2rem;text-align:center;">
				<p><?php echo esc_html( $message ); ?></p>
				<script>setTimeout( function () { window.close(); }, <?php echo $success ? 300 : 2500; ?> );</script>
			</body>
		</html>
		<?php
		exit;
	}

	/**
	 * Prepend a Google Search Console group to the Integrations settings page,
	 * so it renders above the plugin integrations group. Runs after
	 * Integrations_Settings has added the Integrations menu item.
	 *
	 * @param array $menu Menu items.
	 */
	public function add_menu( array $menu ): array {
		foreach ( $menu as $key => $item ) {
			if ( ! isset( $item['id'] ) || 'settings' !== $item['id'] ) {
				continue;
			}

			foreach ( $menu[ $key ]['menu_items'] as $i => $menu_item ) {
				if ( isset( $menu_item['id'] ) && 'integrations' === $menu_item['id'] ) {
					array_unshift(
						$menu[ $key ]['menu_items'][ $i ]['groups'],
						[
							'id'    => 'search_console',
							'title' => __( 'Google Search Console', 'burst-statistics' ),
						]
					);
					break;
				}
			}

			break;
		}

		return $menu;
	}

	/**
	 * Register the connect field that renders in the Search Console group on the
	 * Integrations settings page.
	 *
	 * @param array $fields Field definitions.
	 */
	public function add_field( array $fields ): array {
		$fields[] = [
			'id'       => 'enable_search_console',
			'menu_id'  => 'integrations',
			'group_id' => 'search_console',
			'type'     => 'checkbox',
			'label'    => __( 'Enable Google Search Console', 'burst-statistics' ),
			'context'  => __( 'Show Google Search Console search query data in your statistics. When disabled, no Search Console code runs.', 'burst-statistics' ),
			'disabled' => false,
			'default'  => false,
		];

		// The connect field is always registered so the form's field set stays
		// constant across saves; otherwise it would appear only after saving and
		// leave react-hook-form permanently dirty. It is rendered only once the
		// option is actually saved on (visible), because the connect handlers only
		// run for the saved option and the live toggle value would reveal it before
		// a save.
		$fields[] = [
			'id'       => 'gsc_connect',
			'menu_id'  => 'integrations',
			'group_id' => 'search_console',
			'type'     => 'gsc_connect',
			'label'    => __( 'Connect Google Search Console', 'burst-statistics' ),
			'disabled' => false,
			'default'  => '',
			'visible'  => $this->get_option_bool( 'enable_search_console' ),
		];
		return $fields;
	}

	/**
	 * Seed the initial connection state so the field renders without a flash.
	 *
	 * @param array $data Localized script data.
	 */
	public function add_to_localize_script( array $data ): array {
		$data['gsc_status'] = $this->token_store()->status();
		return $data;
	}
}
