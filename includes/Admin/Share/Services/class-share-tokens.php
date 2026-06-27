<?php

namespace Burst\Admin\Share\Services;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Save;
use Burst\Traits\Sanitize;
use Burst\Admin\Share\Share;

use function Burst\burst_loader;

class Share_Tokens {
	use Admin_Helper;
	use Save;
	use Sanitize;

	public Share $share;

	/**
	 * Constructor.
	 *
	 * @param Share $share The main Share class instance.
	 */
	public function __construct( Share $share ) {
		$this->share = $share;
	}

	/**
	 * Expiration options in seconds.
	 *
	 * @var array<string, int>
	 */
	public const EXPIRATION_MAP = [
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
	public const DEFAULT_PERMISSIONS = [
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
	 * Get all valid share links with their metadata.
	 *
	 * @param string $type Type of token. all, report or link.
	 * @param string $token Optional token to filter by.
	 * @param int    $report_id Optional report_id to filter by.
	 * @return array Array of share link data.
	 */
	public function get_share_links( string $type = 'all', string $token = '', int $report_id = 0 ): array {
		$tokens = get_option( 'burst_share_tokens', [] );
		// if this is requested for a report, we should check if it has a connected share url. If not, generate the token.
		if ( $type === 'report' && $report_id > 0 ) {
			$tokens = array_filter(
				$tokens,
				function ( $link ) use ( $report_id ) {
					return $link['report_id'] === $report_id;
				}
			);
			// if there are no tokens for this report, we should generate them now.
			if ( empty( $tokens ) ) {
				$burst_scheme = wp_parse_url( BURST_URL, PHP_URL_SCHEME );
				$view_url     = set_url_scheme( site_url( '/burst-dashboard/story/' ), $burst_scheme );
				$this->generate_token( '7d', $view_url, [], [], [], $report_id );
				$tokens = get_option( 'burst_share_tokens', [] );
			}
		}

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
			$tabs          = $this->share->sanitize_tabs( $token_data['shared_tabs'] ?? [] );
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
			return array_values(
				array_filter(
					$share_links,
					function ( $link ) use ( $token ) {
						return $link['token'] === $token;
					}
				)
			);
		}

		if ( $report_id !== 0 ) {
			return array_values(
				array_filter(
					$share_links,
					function ( $link ) use ( $report_id ) {
						return $link['report_id'] === $report_id;
					}
				)
			);
		}

		// If we only need link types, filter out tokens where report_id >0.
		if ( $type === 'link' ) {
			return array_values(
				array_filter(
					$share_links,
					function ( $link ) {
						return $link['report_id'] === 0;
					}
				)
			);
		}

		if ( $type === 'report' ) {
			return array_values(
				array_filter(
					$share_links,
					function ( $link ) {
						return $link['report_id'] !== 0;
					}
				)
			);
		}

		// type===all, return all items.
		return $share_links;
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
	 *
	 * Mixed $view_url: untrusted value from token-payload data that may not be a string; the is_string guard rejects anything else.
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
	 * Generates URLs like /burst-dashboard/<tab>/?burst_share_token=...
	 * Query parameters that used to live in the hash route are moved into the
	 * real query string so shared links work without hash-based routing.
	 *
	 * For reports: /burst-dashboard/story/?burst_share_token=...
	 * For dashboard: /burst-dashboard/<tab>/?burst_share_token=...&range=custom...
	 *
	 * @param string      $token    The share token.
	 * @param string|null $view_url Optional view URL to extract hash from.
	 * @param int         $report_id Optional, the report id.
	 * @return string The complete share URL.
	 */
	private function build_share_url( string $token, ?string $view_url = null, int $report_id = 0 ): string {
		// During cron, home_url() may return http:// while the site runs on https://.
		// Normalize to the same scheme as BURST_URL to ensure the link is correct.
		$burst_scheme = wp_parse_url( BURST_URL, PHP_URL_SCHEME );
		$base_url     = set_url_scheme( home_url( '/burst-dashboard/' ), $burst_scheme );

		// Extract hash fragment from view_url if present.
		// default hash.
		$hash = '#/dashboard';
		if ( ! empty( $view_url ) ) {
			$hash_position = strpos( $view_url, '#' );
			if ( false !== $hash_position ) {
				$hash = substr( $view_url, $hash_position );
			}
		}
		$hash = self::sanitize_hash_fragment( $hash );

		// Derive tab from hash for the path segment. Use whitelist sanitization.
		$tab = $report_id > 0 ? 'story' : '';
		// Regex: `/^#\\/([\\w-]+)/` captures the first segment after `#/` in a legacy hash route.
		// Example: `#/statistics?range=custom` -> `statistics`.
		if ( $report_id <= 0 && preg_match( '/^#\/([\w-]+)/', $hash, $matches ) ) {
			$candidate = $this->share->sanitize_tab( $matches[1] );
			if ( '' !== $candidate ) {
				$tab = $candidate;
			}
		} elseif ( ! empty( $view_url ) ) {
			$view_path = wp_parse_url( $view_url, PHP_URL_PATH );
			// Regex: `#/burst-dashboard/([^/]+)/?$#` captures a single path segment after `/burst-dashboard/`.
			// Example: `/burst-dashboard/insights/` -> `insights` (rejects `/burst-dashboard/insights/foo/`).
			if ( is_string( $view_path ) && preg_match( '#/burst-dashboard/([^/]+)/?$#', $view_path, $matches ) ) {
				$candidate = $this->share->sanitize_tab( $matches[1] );
				if ( '' !== $candidate ) {
					$tab = $candidate;
				}
			}
		}

		// Fallback to a sensible default shareable tab when none was derived.
		if ( '' === $tab ) {
			$tab = 'statistics';
		}

		$query_args = [
			'burst_share_token' => $token,
		];

		// Preserve route search params from old hash-based URLs by moving them into
		// the real query string for browser-history based shared links.
		// Regex: `/^#\\/[\\w-]+\\?(.*)$/` captures the query string after `?` in a legacy hash route.
		// Example: `#/statistics?range=custom&start=2026-01-01` -> `range=custom&start=2026-01-01`.
		if ( preg_match( '/^#\/[\w-]+\?(.*)$/', $hash, $matches ) && ! empty( $matches[1] ) ) {
			parse_str( $matches[1], $route_query_args );

			foreach ( $route_query_args as $key => $value ) {
				$sanitized_key = sanitize_key( (string) $key );

				if ( '' === $sanitized_key ) {
					continue;
				}

				if ( is_string( $value ) ) {
					if ( is_numeric( $value ) && ! str_contains( $value, '.' ) ) {
						$query_args[ $sanitized_key ] = intval( $value );
					} elseif ( is_numeric( $value ) ) {
						$query_args[ $sanitized_key ] = floatval( $value );
					} else {
						$query_args[ $sanitized_key ] = sanitize_text_field( $value );
					}
				}
			}
		}

		// Build URL with token and route state in the real query string so the
		// server can read the token and the frontend can route without hashes.
		return add_query_arg( $query_args, $base_url . $tab . '/' );
	}

	/**
	 * Sanitize the permissions array.
	 *
	 * @param array $permissions The permissions to sanitize.
	 * @return array Sanitized permissions array.
	 */
	private function sanitize_permissions( array $permissions ): array {
		return apply_filters( 'burst_share_permissions', self::DEFAULT_PERMISSIONS, $permissions );
	}

	/**
	 * Sanitize initial state array.
	 *
	 * @param mixed $initial_state The initial state to sanitize.
	 * @return array Sanitized initial state array.
	 *
	 * Mixed $initial_state: untrusted value from token-payload data that may not be an array; the is_array guard falls back to the default state.
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

		// Flush rewrite rules only once when the first token is created.
		// Covers both manually created share links and auto-generated report tokens.
		if ( ! is_array( get_option( 'burst_share_tokens', false ) ) ) {
			set_transient( 'burst_flush_rewrite_rules', true, 60 );
		}

		$token           = '';
		$existing_tokens = get_option( 'burst_share_tokens', [] );

		// Calculate expiration time.
		$expiration_seconds = self::EXPIRATION_MAP[ $expiration ] ?? self::EXPIRATION_MAP['7d'];
		$expires            = $expiration_seconds > 0 ? time() + $expiration_seconds : 0;

		// Merge with defaults to ensure all keys exist.
		$permissions   = array_merge( self::DEFAULT_PERMISSIONS, $permissions );
		$initial_state = array_merge( self::DEFAULT_INITIAL_STATE, $initial_state );

		if ( isset( $permissions['can_change_date_range'] ) && ! $permissions['can_change_date_range'] ) {
			if ( empty( $initial_state['date_range']['start'] ) ) {
				$initial_state['date_range']['start'] = gmdate( 'Y-m-d', strtotime( '-30 days' ) );
			}
			if ( empty( $initial_state['date_range']['end'] ) ) {
				$initial_state['date_range']['end'] = gmdate( 'Y-m-d' );
			}
		}

		$token_data = [
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
	 * Get the current share token from either HTTP header or query parameter.
	 * Token is passed via:
	 * - HTTP_X_BURST_SHARE_TOKEN header (for API calls)
	 * - burst_share_token query param (for URL navigation)
	 *
	 * Validates token format using the existing sanitize_token() method.
	 *
	 * @return string Empty string if no token found, otherwise the token.
	 */
	public function get_current_token(): string {
		// Check header first (for API/REST calls).
		if ( isset( $_SERVER['HTTP_X_BURST_SHARE_TOKEN'] ) ) {
			// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Sanitized by sanitize_token()
			$token = self::sanitize_token( wp_unslash( $_SERVER['HTTP_X_BURST_SHARE_TOKEN'] ) );
			if ( ! empty( $token ) ) {
				return $token;
			}
		}

		// Check URL query param (as fallback).
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Not using the value, just checking existence
		if ( isset( $_GET['burst_share_token'] ) ) {
			// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized, WordPress.Security.NonceVerification.Recommended -- Sanitized by sanitize_token()
			$token = self::sanitize_token( wp_unslash( $_GET['burst_share_token'] ) );
			if ( ! empty( $token ) ) {
				return $token;
			}
		}

		return '';
	}

	/**
	 * Sanitize a share token.
	 *
	 * @param string $token The token to sanitize.
	 * @return string A valid token.
	 */
	private function sanitize_token( string $token ): string {
		$token = trim( $token );

		// Token must be exactly 32 hexadecimal characters (16 bytes * 2).
		// Based on bin2hex(random_bytes(16)) which always generates 32 hex chars.
		// Regex: `/^[a-f0-9]{32}$/` matches exactly 32 lowercase hex characters.
		// Example: `e4b0c44298fc1c149afbf4c8996fb924` -> valid, `E4...` or shorter/longer -> invalid.
		if ( ! preg_match( '/^[a-f0-9]{32}$/', $token ) ) {
			return '';
		}

		return $token;
	}

	/**
	 * Get the current share link data for the active token.
	 *
	 * @return array The share link data, or an empty array when unavailable.
	 */
	public function get_current_share_link_data(): array {
		// Get the current share token. sanitize_token applies a strict 32-char hex regex.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$token = isset( $_SERVER['HTTP_X_BURST_SHARE_TOKEN'] ) ? self::sanitize_token( wp_unslash( $_SERVER['HTTP_X_BURST_SHARE_TOKEN'] ) ) : ( isset( $_GET['burst_share_token'] ) ? self::sanitize_token( wp_unslash( $_GET['burst_share_token'] ) ) : '' );

		if ( empty( $token ) ) {
			return [];
		}

		$share_links = $this->get_share_links( 'all', $token );
		if ( empty( $share_links ) ) {
			return [];
		}

		return $share_links[0];
	}

	/**
	 * Get permissions for the current share link based on the token.
	 *
	 * @return array The permissions for the current share link.
	 */
	public function get_current_share_link_permissions(): array {
		$token          = $this->get_current_token();
		$no_permissions = [
			'can_change_date'          => false,
			'can_filter'               => false,
			'is_shareable_link_viewer' => false,
		];

		if ( empty( $token ) ) {
			return $no_permissions;
		}

		$share_links = $this->get_share_links( 'all' );

		foreach ( $share_links as $link ) {
			if ( $link['token'] === $token ) {
				$permissions                             = $link['permissions'] ?? $no_permissions;
				$permissions['is_shareable_link_viewer'] = self::is_shareable_link_viewer();
				return $permissions;
			}
		}

		return $no_permissions;
	}

	/**
	 * Get allowed tabs for the current share link.
	 *
	 * @return array The allowed tab IDs for the current share link.
	 */
	public function get_current_share_link_allowed_tabs(): array {
		$token = $this->get_current_token();

		if ( empty( $token ) ) {
			return [];
		}

		$share_links = $this->get_share_links( 'all' );
		foreach ( $share_links as $link ) {
			if ( $link['token'] === $token ) {
				return $link['shared_tabs'] ?? [];
			}
		}
		return [];
	}

	/**
	 * Filter callback for 'burst_share_link_permissions' filter.
	 * Returns the current share link permissions from the token.
	 *
	 * @return array The current share link permissions.
	 */
	public function filter_share_link_permissions(): array {
		return $this->get_current_share_link_permissions();
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
			$this->share->auth->create_viewer_user();

			$expiration    = isset( $data['expiration'] ) ? sanitize_text_field( $data['expiration'] ) : '7d';
			$view_url      = isset( $data['view_url'] ) ? $this->sanitize_view_url( $data['view_url'] ) : '';
			$permissions   = self::sanitize_permissions( $data['permissions'] ?? [] );
			$shared_tabs   = $this->share->sanitize_tabs( $data['shared_tabs'] ?? [] );
			$initial_state = $this->sanitize_initial_state( $data['initial_state'] ?? [] );
			$report_id     = (int) ( $data['report_id'] ?? 0 );
			$token         = $this->generate_token( $expiration, $view_url, $permissions, $shared_tabs, $initial_state, $report_id );
			$url           = self::build_share_url( $token, $view_url, $report_id );
			$output        = [
				'share_token' => $token,
				'share_url'   => $url,
			];
		}

		if ( $action === 'revoke_share_link' ) {
			$token = isset( $data['token'] ) ? self::sanitize_token( $data['token'] ) : '';
			$this->revoke_token( $token );
			$output = [
				'success'     => true,
				'share_links' => $this->get_share_links( 'link' ),
			];
		}

		if ( $action === 'list_share_links' ) {
			// Keep this logic here intentionally. Calling the shared helper from within.
			// The menu loading process can introduce a recursive loop and potentially crash the app.
			$menu_items = burst_loader()->admin->app->menu->get();

			$shareable_tabs = [];
			foreach ( $menu_items as $item ) {
				if ( ! empty( $item['shareable'] ) && ! empty( $item['id'] ) ) {
					$shareable_tabs[] = [
						'id'    => $item['id'],
						'title' => $item['title'] ?? $item['id'],
					];
				}
			}

			$output = [
				'share_links'    => $this->get_share_links( 'link' ),
				'shareable_tabs' => $shareable_tabs,
			];
		}

		return $output;
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
		if ( ! in_array( 'burst_viewer', $user->roles, true ) ) {
			return $nonce_is_valid;
		}

		// Only use override if $action === burst_nonce.
		if ( $action !== 'burst_nonce' ) {
			return $nonce_is_valid;
		}

		if ( isset( $_SERVER['HTTP_X_BURST_SHARE_TOKEN'] ) ) {
			// sanitize_token applies a strict 32-char hex regex.
			// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
			$token = self::sanitize_token( wp_unslash( $_SERVER['HTTP_X_BURST_SHARE_TOKEN'] ) );
			if ( self::validate_share_token( $token ) ) {
				return true;
			}
		}
		return $nonce_is_valid;
	}
}
