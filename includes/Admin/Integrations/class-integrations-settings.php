<?php
namespace Burst\Admin\Integrations;

defined( 'ABSPATH' ) || die();

use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;

use function Burst\burst_loader;

/**
 * Registers the Integrations settings tab under Settings.
 *
 * Adds a menu entry with a single group, then dynamically registers one
 * `integration_row` field per detected (installed + user-enabled) integration,
 * plus a persistent `integrations_intro` field that owns the page-level intro
 * copy and the empty-state / discovery link.
 */
class Integrations_Settings {
	use Helper;
	use Admin_Helper;

	/**
	 * Option key for the cached list of installed integration slugs.
	 */
	private const INSTALLED_CACHE_OPTION = 'burst_installed_integrations';

	/**
	 * Register hooks.
	 */
	public function init(): void {
		add_filter( 'burst_menu', [ $this, 'add_menu' ] );
		add_filter( 'burst_fields', [ $this, 'add_fields' ] );
		// Correct the default for integration_row fields: when an option has never been
		// saved, burst_get_option returns false, but our default is "enabled" (true).
		add_filter( 'burst_field', [ $this, 'set_integration_default' ], 10, 2 );
		add_action( 'admin_init', [ $this, 'refresh_installed_integrations_cache' ] );
	}

	/**
	 * Splice the Integrations submenu into the Settings menu, immediately before
	 * the Advanced item. Search Console appends its own group to this menu item
	 * via a later burst_menu filter.
	 *
	 * @param array $menu The full menu configuration.
	 * @return array Modified menu configuration.
	 */
	public function add_menu( array $menu ): array {
		$integrations_item = [
			'id'       => 'integrations',
			'title'    => __( 'Integrations', 'burst-statistics' ),
			'group_id' => 'integrations',
			'icon'     => 'plug',
			'groups'   => [
				[
					'id'    => 'integrations',
					'title' => __( 'Plugin integrations', 'burst-statistics' ),
				],
			],
		];

		foreach ( $menu as $key => $item ) {
			if ( ! isset( $item['id'] ) || 'settings' !== $item['id'] ) {
				continue;
			}

			// Find advanced as the insertion anchor.
			$anchor_index = null;
			foreach ( $menu[ $key ]['menu_items'] as $i => $menu_item ) {
				if ( isset( $menu_item['id'] ) && 'advanced' === $menu_item['id'] ) {
					$anchor_index = $i;
					break;
				}
			}

			if ( null !== $anchor_index ) {
				array_splice( $menu[ $key ]['menu_items'], $anchor_index, 0, [ $integrations_item ] );
			} else {
				$menu[ $key ]['menu_items'][] = $integrations_item;
			}

			break;
		}

		return $menu;
	}

	/**
	 * Register the integrations intro field and one row field per active integration.
	 *
	 * Does not instantiate a new Integrations object or load scripts; it reads the
	 * raw integration definitions and checks detection via the loader's Integrations
	 * instance (Integrations::plugin_is_detected()), keeping field registration lightweight.
	 *
	 * @param array $fields Current field definitions.
	 * @return array Modified field definitions.
	 */
	public function add_fields( array $fields ): array {
		$all_integrations = $this->get_all_integrations();
		$active_rows      = $this->build_active_rows( $all_integrations );

		// The intro field is always present so the group is always visible.
		$fields[] = [
			'id'       => 'integrations_intro',
			'menu_id'  => 'integrations',
			'group_id' => 'integrations',
			'type'     => 'integrations_intro',
			'label'    => __( 'Integrations', 'burst-statistics' ),
			'default'  => '',
			'meta'     => [
				'has_integrations' => ! empty( $active_rows ),
			],
		];

		foreach ( $active_rows as $row ) {
			$fields[] = [
				'id'       => 'enable_integration_' . $row['slug'],
				'menu_id'  => 'integrations',
				'group_id' => 'integrations',
				'type'     => 'integration_row',
				'label'    => $row['label'],
				'default'  => true,
				'meta'     => $row,
			];
		}

		return $fields;
	}

	/**
	 * Refresh the installed-integrations cache when all plugins are loaded in admin.
	 */
	public function refresh_installed_integrations_cache(): void {
		$slugs = $this->detect_installed_slugs( $this->get_all_integrations() );
		if ( empty( $slugs ) ) {
			return;
		}

		update_option( self::INSTALLED_CACHE_OPTION, $slugs, false );
	}

	/**
	 * When an integration_row field has never been saved, burst_get_option returns
	 * false (its internal fallback for missing options). Override it to 1 (enabled)
	 * because the correct default for all integrations is "on".
	 *
	 * @param array  $field The field definition (already has 'value' set by Fields::get()).
	 * @param string $id    The field id.
	 * @return array Modified field definition.
	 */
	public function set_integration_default( array $field, string $id ): array {
		if ( 'integration_row' !== ( $field['type'] ?? '' ) ) {
			return $field;
		}

		$options = get_option( 'burst_options_settings', [] );
		if ( ! array_key_exists( $id, $options ) ) {
			$field['value'] = 1;
		}

		return $field;
	}

	/**
	 * Build the list of row data for every detected + displayable integration.
	 *
	 * Skips easy-digital-downloads-pro (temporary EDD duplicate; see integrations.php).
	 *
	 * @param array<string, array<string, mixed>> $all_integrations All integration definitions.
	 * @return array<int, array<string, mixed>> Row metadata, one entry per visible integration.
	 */
	private function build_active_rows( array $all_integrations ): array {
		$rows            = [];
		$options         = get_option( 'burst_options_settings', [] );
		$installed_slugs = $this->get_installed_slugs( $all_integrations );

		foreach ( $all_integrations as $slug => $details ) {
			if ( ! in_array( $slug, $installed_slugs, true ) ) {
				continue;
			}

			$status         = $this->translate_integration_status( $details['status'] ?? '' );
			$requires       = ! empty( $details['required_plugins'] ) ? $details['required_plugins'][0] : null;
			$requires_label = null;

			if ( null !== $requires && isset( $all_integrations[ $requires ]['label'] ) ) {
				$requires_label = $all_integrations[ $requires ]['label'];
			}

			// Build the wp.org icon URL, respecting an optional override slug.
			$wporg_slug = $details['wporg_slug'] ?? $slug;
			$icon_url   = 'https://ps.w.org/' . rawurlencode( $wporg_slug ) . '/assets/icon-128x128.png';

			// Determine whether the parent integration is currently enabled.
			// React uses this to set the correct initial disabled state before the parent
			// Controller has registered its field value in the form.
			$parent_enabled = true;
			if ( null !== $requires ) {
				$parent_key     = 'enable_integration_' . sanitize_key( $requires );
				$parent_enabled = ! array_key_exists( $parent_key, $options ) || (bool) $options[ $parent_key ];
			}

			$rows[] = [
				'slug'           => $slug,
				'label'          => $details['label'] ?? $slug,
				'icon_url'       => $icon_url,
				'status'         => $status,
				'requires'       => $requires,
				'requires_label' => $requires_label,
				'parent_enabled' => $parent_enabled,
			];
		}

		return $rows;
	}

	/**
	 * Load the integrations registry.
	 *
	 * @return array<string, array<string, mixed>> Integration definitions keyed by slug.
	 */
	private function get_all_integrations(): array {
		return (array) apply_filters( 'burst_integrations', require BURST_PATH . 'includes/Integrations/integrations.php' );
	}

	/**
	 * Resolve installed integration slugs, falling back to a cached list when runtime
	 * detection is unavailable (e.g. REST requests where other plugins are not loaded).
	 *
	 * @param array<string, array<string, mixed>> $all_integrations All integration definitions.
	 * @return array<int, string> Installed integration slugs.
	 */
	private function get_installed_slugs( array $all_integrations ): array {
		$slugs = $this->detect_installed_slugs( $all_integrations );

		if ( ! empty( $slugs ) ) {
			update_option( self::INSTALLED_CACHE_OPTION, $slugs, false );
			return $slugs;
		}

		$cached = get_option( self::INSTALLED_CACHE_OPTION, [] );

		return is_array( $cached ) ? $cached : [];
	}

	/**
	 * Detect which integrations are installed on this site.
	 *
	 * @param array<string, array<string, mixed>> $all_integrations All integration definitions.
	 * @return array<int, string> Installed integration slugs.
	 */
	private function detect_installed_slugs( array $all_integrations ): array {
		$slugs = [];

		foreach ( $all_integrations as $slug => $details ) {
			// Skip the EDD pro duplicate; it maps to the same constant as EDD free.
			if ( 'easy-digital-downloads-pro' === $slug ) {
				continue;
			}

			if ( ! burst_loader()->integrations->plugin_is_detected( $details ) ) {
				continue;
			}

			$slugs[] = $slug;
		}

		return $slugs;
	}

	/**
	 * Translate an integration status id for display in the settings UI.
	 *
	 * Status ids in integrations.php are stable keys, so the source text can be
	 * reworded here without breaking the mapping. The labels must not be built
	 * at registry load time because integrations.php is required before init.
	 *
	 * @param string $status Status id from integrations.php.
	 * @return string Translated status when init has run, otherwise the status id.
	 */
	private function translate_integration_status( string $status ): string {
		if ( '' === $status || 0 === did_action( 'init' ) ) {
			return $status;
		}

		$labels = [
			'enhances_consent_compatibility'             => __( 'Enhances consent compatibility', 'burst-statistics' ),
			'prevents_duplicate_tracking_data'           => __( 'Prevents duplicating tracking data', 'burst-statistics' ),
			'tracks_form_and_popup_submissions'          => __( 'Tracks form and popup submissions', 'burst-statistics' ),
			'tracks_sales_and_revenue'                   => __( 'Tracking sales and revenue', 'burst-statistics' ),
			'tracks_woocommerce_payments_transactions'   => __( 'Tracks WooCommerce Payments transactions', 'burst-statistics' ),
			'tracks_multi_currency_transactions'         => __( 'Tracks multi-currency transactions', 'burst-statistics' ),
			'tracks_donations'                           => __( 'Tracking donations', 'burst-statistics' ),
			'tracks_form_submissions'                    => __( 'Tracks form submissions', 'burst-statistics' ),
			'enhances_caching_compatibility'             => __( 'Enhances compatibility with caching', 'burst-statistics' ),
			'tracks_signups_and_renewals'                => __( 'Tracks sign-ups and renewals', 'burst-statistics' ),
			'tracks_recurring_payments'                  => __( 'Tracks recurring payments', 'burst-statistics' ),
			'tracks_woocommerce_subscription_management' => __( 'Tracks WooCommerce subscription management', 'burst-statistics' ),
		];

		return $labels[ $status ] ?? $status;
	}
}
