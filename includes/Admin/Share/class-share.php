<?php
namespace Burst\Admin\Share;

use Burst\Admin\App\App;
use Burst\Admin\Capability\Capability;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Sanitize;
use Burst\Traits\Save;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

class Share {
	use Admin_Helper;
	use Save;
	use Sanitize;

	/**
	 * Expiration options in seconds.
	 *
	 * @var array<string, int>
	 */
	private const EXPIRATION_MAP = [
		'never' => 0,
		'24h'   => DAY_IN_SECONDS,
		'7d'    => 7 * DAY_IN_SECONDS,
		'30d'   => 30 * DAY_IN_SECONDS,
	];

	/**
	 * Default permissions for share links.
	 *
	 * @var array<string, bool>
	 */
	private const DEFAULT_PERMISSIONS = [
		'can_change_date' => false,
		'can_filter'      => false,
	];

	/**
	 * Default initial state for share links.
	 *
	 * @var array<string, array>
	 */
	private const DEFAULT_INITIAL_STATE = [
		'date_range' => [
			'start' => '',
			'end'   => '',
		],
		'filters'    => [],
	];

	/**
	 * Initialize the Share class.
	 */
	public function init(): void {
		add_action( 'burst_do_action', [ $this, 'do_rest_action' ], 10, 3 );
		add_action( 'template_redirect', [ $this, 'check_for_share_token' ] );
		add_action( 'init', [ $this, 'add_rewrite_rules' ] );
		add_action( 'admin_init', [ $this, 'lock_viewer_user_capabilities' ] );
		add_filter( 'query_vars', [ $this, 'add_query_vars' ] );
		add_filter( 'burst_verify_nonce', [ $this, 'verify_nonce_for_shared_links' ], 10, 3 );
		add_filter( 'burst_share_link_permissions', [ $this, 'get_current_share_link_permissions' ] );
		add_filter( 'burst_menu', [ $this, 'shareable_menu_items' ] );
		add_action( 'admin_init', [ $this, 'maybe_flush_rewrite_rules' ] );
	}

	/**
	 * Filter menu items to only include shareable items for share link viewers.
	 *
	 * @param array $menu_items The original menu items.
	 * @return array The filtered menu items.
	 */
	public function shareable_menu_items( array $menu_items ): array {

		$user_has_burst_viewer_role = self::is_shareable_link_viewer();
		if ( ! $user_has_burst_viewer_role ) {
			return $menu_items;
		}

		$shared_tab_slugs = $this->get_current_share_link_allowed_tabs();
		// remove items where capabilities are not met.
		foreach ( $menu_items as $key => $menu_item ) {
			// remove any menu items that are not shareable.
			if ( ! isset( $menu_item['shareable'] ) || ! $menu_item['shareable'] ) {
				unset( $menu_items[ $key ] );
				continue;
			}

			// remove any menu items not in the allowed tabs.
			if ( ! in_array( $menu_item['id'], $shared_tab_slugs, true ) ) {
				unset( $menu_items[ $key ] );
			}
		}

		return $menu_items;
	}

	/**
	 * If headers contain X-Burst-Share-Token, verify that token against stored share tokens.
	 *
	 * @param bool        $nonce_is_valid Whether the nonce is valid.
	 * @param string|null $nonce          The nonce value.
	 * @param string      $action         The action being performed.
	 * @return bool Whether the nonce is valid.
	 */
	public function verify_nonce_for_shared_links( bool $nonce_is_valid, ?string $nonce, string $action ): bool {
		unset( $nonce );

		// Only use override if current user is a burst_viewer.
		$user = wp_get_current_user();
		if ( ! in_array( 'burst_viewer', (array) $user->roles, true ) ) {
			return $nonce_is_valid;
		}

		// Only use override if $action === burst_nonce.
		if ( $action !== 'burst_nonce' ) {
			return $nonce_is_valid;
		}

		if ( isset( $_SERVER['HTTP_X_BURST_SHARE_TOKEN'] ) ) {
			$token = sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_BURST_SHARE_TOKEN'] ) );
			if ( $this->validate_share_token( $token ) ) {
				return true;
			}
		}
		return $nonce_is_valid;
	}

	/**
	 * Validate and fix burst_statistics_viewer user.
	 * Ensures user has ONLY burst_viewer role and ONLY view_burst_statistics capability.
	 */
	public function lock_viewer_user_capabilities(): void {
		if ( ! self::is_shareable_link_viewer() ) {
			return;
		}
		$username = 'burst_statistics_viewer';
		$user     = get_user_by( 'login', $username );
		if ( ! $user ) {
			return;
		}

		$needs_fix = false;

		// Only one role allowed: burst_viewer.
		if ( count( $user->roles ) !== 1 || ! in_array( 'burst_viewer', (array) $user->roles, true ) ) {
			$needs_fix = true;
		}

		// Check 2: check allowed capabilities.
		$user_caps    = array_keys( array_filter( (array) $user->allcaps ) );
		$allowed_caps = [
			'view_burst_statistics',
			'view_sales_burst_statistics',
			'burst_viewer',
		];

		// Remove all other capabilities.
		$extra_caps = array_diff( $user_caps, $allowed_caps );
		if ( ! empty( $extra_caps ) ) {
			$needs_fix = true;
		}

		if ( $needs_fix ) {
			foreach ( $user->roles as $role ) {
				$user->remove_role( $role );
			}

			foreach ( $extra_caps as $cap ) {
				$user->remove_cap( $cap );
			}

			$user->add_role( 'burst_viewer' );
			Capability::add_capability( 'view', [ 'burst_viewer' ] );
			Capability::add_capability( 'view_sales', [ 'burst_viewer' ] );
		}
	}

	/**
	 * Add custom query var.
	 *
	 * @param array $vars Query vars.
	 * @return array Modified query vars.
	 */
	public function add_query_vars( array $vars ): array {
		$vars[] = 'burst_share_page';
		$vars[] = 'burst_share_token';
		return $vars;
	}

	/**
	 * Add custom rewrite rule for /burst/dashboard.
	 */
	public function add_rewrite_rules(): void {
		add_rewrite_rule(
			'^burst-dashboard/?$',
			'index.php?burst_share_page=1',
			'top'
		);
	}

	/**
	 * Check for share token in URL and log in viewer user if valid.
	 */
	public function check_for_share_token(): void {
		if ( ! get_query_var( 'burst_share_page' ) &&
            // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Not using the value, just an exists check.
			( ! isset( $_SERVER['REQUEST_URI'] ) || strpos( wp_unslash( $_SERVER['REQUEST_URI'] ), '/burst-dashboard' ) === false ) ) {
			return;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( ! isset( $_GET['burst_share_token'] ) ) {
			return;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$token = sanitize_text_field( wp_unslash( $_GET['burst_share_token'] ) );
		// This is a "just in case" check, if the token is invalid, we should never end up here anyway. It's already validated by this point.
		if ( ! $this->validate_share_token( $token ) ) {
			wp_die( esc_html__( 'This share link has expired or is invalid.', 'burst-statistics' ) );
		}

		// Only log in if user is not already logged in.
		if ( ! is_user_logged_in() ) {
			$viewer_user_id = $this->get_viewer_user();
			wp_set_current_user( $viewer_user_id );
			wp_set_auth_cookie( $viewer_user_id, false );
		}

		if ( ! self::is_shareable_link_viewer() && ! $this->user_can_view() ) {
			wp_die( esc_html__( 'You are already logged in, but with a user account with insufficient permissions to view this page. Log out first, or use this link in a private window.', 'burst-statistics' ) );
		}

		$this->load_statistics_template();
		exit;
	}

	/**
	 * Load the shared statistics template.
	 */
	private function load_statistics_template(): void {
		// Set query var so WordPress doesn't try to load theme.
		global $wp_query;
		$wp_query->is_404 = false;
		status_header( 200 );

		$app = new App();
		$app->init();
		$app->plugin_admin_scripts();
		$user_lang = get_user_locale();
		?>
		<!DOCTYPE html>
		<html <?php language_attributes(); ?> lang="<?php echo esc_attr( $user_lang ); ?>">
		<head>
			<meta charset="<?php bloginfo( 'charset' ); ?>">
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<title><?php esc_html_e( 'Burst Statistics', 'burst-statistics' ); ?></title>
			<style>
				body.burst-shared-view {
					background-color:#f0f0f1;
				}
				#burst-statistics {
					padding-left:23px;
				}
		</style>
		</head>
		<body class="burst-shared-view">
		<?php
			$app->dashboard();
			wp_print_footer_scripts();
		?>
		</body>
		</html>
		<?php
		exit;
	}

	/**
	 * If the viewer user does not exist, create it.
	 */
	public function create_viewer_user(): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}

		$username = 'burst_statistics_viewer';
		$user     = get_user_by( 'login', $username );
		if ( ! $user ) {
			if ( get_role( 'burst_viewer' ) === null ) {
				add_role(
					'burst_viewer',
					__( 'Burst Statistics Viewer', 'burst-statistics' ),
					// No capabilities needed for frontend-only.
					[]
				);
			}

			wp_insert_user(
				[
					'user_login'           => $username,
					'user_pass'            => wp_generate_password( 64, true, true ),
					'user_email'           => 'noreply@' . wp_parse_url( home_url(), PHP_URL_HOST ),
					'role'                 => 'burst_viewer',
					'show_admin_bar_front' => 'false',
				]
			);
			Capability::add_capability( 'view', [ 'burst_viewer' ] );
			Capability::add_capability( 'view_sales', [ 'burst_viewer' ] );
		}
	}

	/**
	 * Get the viewer user.
	 *
	 * @return int The User ID of the viewer user.
	 */
	public function get_viewer_user(): int {
		$username = 'burst_statistics_viewer';
		$user     = get_user_by( 'login', $username );

		if ( ! $user ) {
			return 0;
		}

		return $user->ID;
	}

	/**
	 * Get shareable tabs from the menu configuration.
	 * Reads from burst_menu filter and returns only items with shareable => true.
	 *
	 * @return array Array of shareable tab configurations with id and title.
	 */
	public static function get_shareable_tabs(): array {
		$menu_items = apply_filters( 'burst_menu', require BURST_PATH . 'includes/Admin/App/config/menu.php' );

		$shareable_tabs = [];
		foreach ( $menu_items as $item ) {
			if ( ! empty( $item['shareable'] ) && ! empty( $item['id'] ) ) {
				$shareable_tabs[] = [
					'id'    => $item['id'],
					'title' => $item['title'] ?? $item['id'],
				];
			}
		}

		return $shareable_tabs;
	}

	/**
	 * Get array of shareable tab IDs.
	 *
	 * @return array Array of shareable tab IDs.
	 */
	private static function get_shareable_tab_ids(): array {
		$menu_items = require BURST_PATH . 'includes/Admin/App/config/menu.php';

		$shareable_ids = [];
		foreach ( $menu_items as $item ) {
			if ( ! empty( $item['shareable'] ) && ! empty( $item['id'] ) ) {
				$shareable_ids[] = $item['id'];
			}
		}

		return $shareable_ids;
	}

	/**
	 * Add token creation to REST actions.
	 *
	 * @param array      $output The output array.
	 * @param string     $action The action being performed.
	 * @param array|null $data   The request data.
	 * @return array The modified output array.
	 */
	public function do_rest_action( array $output, string $action, ?array $data ): array {
		if ( ! $this->user_can_manage() ) {
			return $output;
		}
		if ( $action === 'get_share_token' ) {
			// Flush rewrite rules only once when the first token is created.
			if ( ! is_array( get_option( 'burst_share_tokens', false ) ) ) {
				set_transient( 'burst_flush_rewrite_rules', true, 60 );
			}
			$this->create_viewer_user();

			$expiration    = isset( $data['expiration'] ) ? sanitize_text_field( $data['expiration'] ) : '7d';
			$view_url      = isset( $data['view_url'] ) ? $this->sanitize_view_url( $data['view_url'] ) : '';
			$permissions   = self::sanitize_permissions( $data['permissions'] ?? [] );
			$shared_tabs   = self::sanitize_shared_tabs( $data['shared_tabs'] ?? [] );
			$initial_state = $this->sanitize_initial_state( $data['initial_state'] ?? [] );
			$report_id     = (int) ( $data['report_id'] ?? 0 );
			$token         = $this->generate_token( $expiration, $view_url, $permissions, $shared_tabs, $initial_state, $report_id );
			$url           = self::build_share_url( $token, $view_url, $report_id );
			$output        = [
				'share_token' => $token,
				'share_url'   => $url,
			];
		}

		if ( $action === 'get_share_links' ) {
			$output = [
				'share_links'    => self::get_share_links(),
				'shareable_tabs' => self::get_shareable_tabs(),
			];
		}

		if ( $action === 'revoke_share_link' ) {
			$token = isset( $data['token'] ) ? sanitize_text_field( $data['token'] ) : '';
			$this->revoke_token( $token );
			$output = [
				'success'     => true,
				'share_links' => self::get_share_links(),
			];
		}

		return $output;
	}

	/**
	 * Flush rewrite rules if the transient is set.
	 */
	public function maybe_flush_rewrite_rules(): void {
		if ( get_transient( 'burst_flush_rewrite_rules' ) ) {
			flush_rewrite_rules();
			delete_transient( 'burst_flush_rewrite_rules' );
		}
	}

	/**
	 * Get all valid share links with their metadata.
	 *
	 * @param string $token Optional token to filter by.
	 * @param int    $report_id Optional report_id to filter by.
	 * @return array Array of share link data.
	 */
	public static function get_share_links( string $token = '', int $report_id = 0 ): array {
		$tokens       = get_option( 'burst_share_tokens', [] );
		$share_links  = [];
		$current_time = time();
		// Clean up expired tokens while we're at it.
		$valid_tokens = [];

		foreach ( $tokens as $token_data ) {
			// Skip expired tokens (0 means never expires).
			if ( $token_data['expires'] !== 0 && $token_data['expires'] < $current_time ) {
				continue;
			}

			$valid_tokens[] = $token_data;

			// Build share URL using the token and stored view_url.
			$share_url     = $token_data['view_url'] ?? '';
			$share_url     = self::build_share_url( $token_data['token'], $share_url );
			$permissions   = self::sanitize_permissions( $token_data['permissions'] ?? self::DEFAULT_PERMISSIONS );
			$tabs          = self::sanitize_shared_tabs( $token_data['shared_tabs'] ?? [] );
			$share_links[] = [
				'token'         => $token_data['token'] ?? '',
				'url'           => $share_url,
				'expires'       => $token_data['expires'],
				'created'       => $token_data['created'] ?? 0,
				'report_id'     => $token_data['report_id'] ?? 0,
				'permissions'   => $permissions,
				'shared_tabs'   => $tabs,
				'initial_state' => $token_data['initial_state'] ?? self::DEFAULT_INITIAL_STATE,
			];
		}

		// Update option with only valid tokens.
		if ( count( $valid_tokens ) !== count( $tokens ) ) {
			update_option( 'burst_share_tokens', $valid_tokens );
		}

		// Sort by expiry: soonest first, never-expiring (0) last.
		usort(
			$share_links,
			function ( $a, $b ) {
				// Treat 0 (never expires) as a very large number so it sorts last.
				$a_expires = $a['expires'] === 0 ? PHP_INT_MAX : $a['expires'];
				$b_expires = $b['expires'] === 0 ? PHP_INT_MAX : $b['expires'];

				return $a_expires <=> $b_expires;
			}
		);

		// if a token is passed, we're looking for a share link for the story view. In that case we don't filter out the report_ids.
		if ( ! empty( $token ) ) {
			return array_filter(
				$share_links,
				function ( $link ) use ( $token ) {
					return $link['token'] === $token;
				}
			);
		}

		if ( $report_id > 0 ) {
			return array_filter(
				$share_links,
				function ( $link ) use ( $report_id ) {
					return $link['report_id'] === $report_id;
				}
			);
		}

		// filter out tokens where report_id >0.
		return array_filter(
			$share_links,
			function ( $link ) {
				return $link['report_id'] === 0;
			}
		);
	}

	/**
	 * Get permissions for the current share link based on the token in the URL.
	 *
	 * @return array The permissions for the current share link.
	 */
	public function get_current_share_link_permissions( array $permissions ): array {
		unset( $permissions );
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- The token is our nonce, and is sanitized.
		$token          = isset( $_GET['burst_share_token'] ) ? self::sanitize_token( wp_unslash( $_GET['burst_share_token'] ) ) : '';
		$no_permissions = [
			'can_change_date'          => false,
			'can_filter'               => false,
			'is_shareable_link_viewer' => false,
		];
		$share_links    = self::get_share_links();
		if ( ! empty( $token ) ) {
			foreach ( $share_links as $link ) {
				if ( $link['token'] === $token ) {
					$permissions                             = $link['permissions'] ?? $no_permissions;
					$permissions['is_shareable_link_viewer'] = self::is_shareable_link_viewer();
					return $permissions;
				}
			}
		}
		return $no_permissions;
	}

	/**
	 * Get allowed tabs for the current share link based on the token in the URL.
	 *
	 * @return array The allowed tab IDs for the current share link.
	 */
	public function get_current_share_link_allowed_tabs(): array {
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- The token is our nonce, and is sanitized.
		$token       = isset( $_GET['burst_share_token'] ) ? self::sanitize_token( wp_unslash( $_GET['burst_share_token'] ) ) : '';
		$share_links = self::get_share_links();
		foreach ( $share_links as $link ) {
			if ( $link['token'] === $token ) {
				return $link['shared_tabs'] ?? [];
			}
		}
		return [];
	}


	/**
	 * Revoke a share token.
	 *
	 * @param string $token The token to revoke.
	 */
	private function revoke_token( string $token ): void {
		if ( ! $this->user_can_manage() || empty( $token ) ) {
			return;
		}

		$tokens = get_option( 'burst_share_tokens', [] );
		$tokens = array_filter(
			$tokens,
			function ( $token_data ) use ( $token ) {
				return $token_data['token'] !== $token;
			}
		);

		update_option( 'burst_share_tokens', array_values( $tokens ) );
	}

	/**
	 * Sanitize view URL while preserving hash fragment.
	 * esc_url_raw strips the hash, so we need custom sanitization.
	 *
	 * @param mixed $view_url The view URL to sanitize.
	 * @return string Sanitized view URL with hash preserved.
	 */
	private function sanitize_view_url( mixed $view_url ): string {
		if ( ! is_string( $view_url ) || empty( $view_url ) ) {
			return '';
		}

		// Split URL and hash.
		$hash_position = strpos( $view_url, '#' );
		$url_part      = false !== $hash_position ? substr( $view_url, 0, $hash_position ) : $view_url;
		$hash_part     = false !== $hash_position ? substr( $view_url, $hash_position ) : '';

		// Sanitize the URL part (without hash).
		$url_part = esc_url_raw( $url_part );

		// Sanitize hash fragment.
		if ( ! empty( $hash_part ) ) {
			$hash_part = self::sanitize_hash_fragment( $hash_part );
		}

		return $url_part . $hash_part;
	}



	/**
	 * Build the share URL for a given token.
	 * All share URLs use the /burst-dashboard/ format.
	 * If view_url contains a hash fragment, it will be appended to the share URL.
	 *
	 * @param string      $token    The share token.
	 * @param string|null $view_url Optional view URL to extract hash from.
	 * @param int         $report_id Optional, the report id.
	 * @return string The complete share URL.
	 */
	private static function build_share_url( string $token, ?string $view_url = null, int $report_id = 0 ): string {
		$base_url  = home_url( '/burst-dashboard/' );
		$share_url = add_query_arg( 'burst_share_token', $token, $base_url );

		// in case of the report id, filter data and date ranges are pulled from the report.
		if ( $report_id > 0 ) {
			return $share_url . '#/story';
		}
		// Extract hash fragment from view_url if present.
		if ( ! empty( $view_url ) ) {
			$hash_position = strpos( $view_url, '#' );
			if ( false !== $hash_position ) {
				$hash       = substr( $view_url, $hash_position );
				$share_url .= self::sanitize_hash_fragment( $hash );
			}
		}

		return $share_url;
	}

	/**
	 * Sanitize permissions array.
	 *
	 * @param array $permissions The permissions to sanitize.
	 * @return array Sanitized permissions array.
	 */
	private static function sanitize_permissions( array $permissions ): array {
		return apply_filters( 'burst_share_permissions', self::DEFAULT_PERMISSIONS, $permissions );
	}

	/**
	 * Sanitize shared tabs array.
	 * Validates tabs against available shareable tabs from menu config.
	 *
	 * @param mixed $tabs The tabs to sanitize.
	 * @return array Sanitized array of tab IDs.
	 */
	private static function sanitize_shared_tabs( mixed $tabs ): array {
		if ( ! is_array( $tabs ) ) {
			return [];
		}

		$valid_tab_ids = self::get_shareable_tab_ids();
		$sanitized     = [];

		foreach ( $tabs as $tab ) {
			$tab = sanitize_text_field( $tab );
			if ( in_array( $tab, $valid_tab_ids, true ) ) {
				$sanitized[] = $tab;
			}
		}

		return array_unique( $sanitized );
	}

	/**
	 * Sanitize initial state array.
	 *
	 * @param mixed $initial_state The initial state to sanitize.
	 * @return array Sanitized initial state array.
	 */
	private function sanitize_initial_state( mixed $initial_state ): array {
		if ( ! is_array( $initial_state ) ) {
			return self::DEFAULT_INITIAL_STATE;
		}

		$sanitized = self::DEFAULT_INITIAL_STATE;

		// Sanitize date range.
		if ( isset( $initial_state['date_range'] ) && is_array( $initial_state['date_range'] ) ) {
			$sanitized['date_range'] = [
				'start' => isset( $initial_state['date_range']['start'] )
					? sanitize_text_field( $initial_state['date_range']['start'] )
					: '',
				'end'   => isset( $initial_state['date_range']['end'] )
					? sanitize_text_field( $initial_state['date_range']['end'] )
					: '',
			];
		}

		// Sanitize filters.
		if ( isset( $initial_state['filters'] ) && is_array( $initial_state['filters'] ) ) {
			$filters = [];
			foreach ( $initial_state['filters'] as $key => $value ) {
				$key = sanitize_key( $key );
				if ( ! empty( $key ) && ! empty( $value ) ) {
					$filters[ $key ] = sanitize_text_field( $value );
				}
			}
			$sanitized['filters'] = $filters;
		}

		return $sanitized;
	}

	/**
	 * Generate a unique share token.
	 *
	 * @param string $expiration    The expiration setting (never, 24h, 7d, 30d).
	 * @param string $view_url      The view URL this token is for.
	 * @param array  $permissions   The permissions for this token.
	 * @param array  $shared_tabs   The tabs that are shared with this token.
	 * @param array  $initial_state The initial state (date_range, filters).
	 * @param int    $report_id Optional, the report ID this token is for.
	 * @return string The generated token.
	 */
	private function generate_token(
		string $expiration = '7d',
		string $view_url = '',
		array $permissions = [],
		array $shared_tabs = [],
		array $initial_state = [],
		int $report_id = 0
	): string {
		if ( ! $this->user_can_manage() ) {
			return '';
		}

		$token           = '';
		$existing_tokens = get_option( 'burst_share_tokens', [] );

		// Calculate expiration time.
		$expiration_seconds = self::EXPIRATION_MAP[ $expiration ] ?? self::EXPIRATION_MAP['7d'];
		$expires            = $expiration_seconds > 0 ? time() + $expiration_seconds : 0;

		// Merge with defaults to ensure all keys exist.
		$permissions   = array_merge( self::DEFAULT_PERMISSIONS, $permissions );
		$initial_state = array_merge( self::DEFAULT_INITIAL_STATE, $initial_state );
		$token_data    = [
			'expires'       => $expires,
			// always update created date, to update expiration.
			'created'       => time(),
			'view_url'      => $view_url,
			'permissions'   => $permissions,
			'shared_tabs'   => $shared_tabs,
			'initial_state' => $initial_state,
			'report_id'     => $report_id,
		];

		// if we have a report id, check if a token with this report_id already exists. If so, use that token.
		if ( $report_id > 0 ) {
			foreach ( $existing_tokens as $key => $existing_token ) {
				if ( $existing_token['report_id'] === $report_id ) {
					$token                   = $existing_token['token'];
					$token_data['token']     = $token;
					$existing_tokens[ $key ] = $token_data;
				}
			}
		}

		// if we haven't found it, generate a new one.
		if ( empty( $token ) ) {
			$token               = bin2hex( random_bytes( 16 ) );
			$token_data['token'] = $token;
			$existing_tokens[]   = $token_data;
		}

		update_option( 'burst_share_tokens', $existing_tokens );
		return $token;
	}

	/**
	 * Sanitize a share token.
	 *
	 * @param string $token The token to sanitize.
	 * @return string A valid token.
	 */
	private static function sanitize_token( string $token ): string {
		$token = trim( $token );

		// Token must be exactly 32 hexadecimal characters (16 bytes * 2).
		// Based on bin2hex(random_bytes(16)) which always generates 32 hex chars.
		if ( ! preg_match( '/^[a-f0-9]{32}$/', $token ) ) {
			return '';
		}

		return $token;
	}
}
