<?php
namespace Burst\Pro;

use Burst\Pro\Languages\Languages;
use Burst\Admin\Mailer\Mail_Reports;
use Burst\Pro\Licensing\Licensing;
use Burst\Pro\Tracking\Tracking_GeoIp;
use Burst\Traits\Admin_Helper;
use Burst\Pro\DB_Upgrade_Pro\DB_Upgrade_Pro;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}
class Pro {
	use Admin_Helper;

	/**
	 * Initialize hooks and classes
	 */
	public function init(): void {
		add_filter( 'burst_mail_reports_blocks', [ $this, 'burst_premium_email_blocks' ], 10, 3 );
		add_action( 'burst_activation', [ $this, 'remove_free_plugin' ] );
		add_action( 'burst_upgrade_after', [ $this, 'upgrade_premium' ] );
		add_filter( 'burst_all_tables', [ $this, 'burst_all_tables' ] );
		add_filter( 'burst_tasks', [ $this, 'add_bf_and_cm_notices' ] );
		add_filter( 'burst_email_blocks', [ $this, 'add_pro_email_blocks' ] );

		add_filter( 'burst_debug_fields', [ $this, 'add_debug_fields' ] );
		add_filter( 'burst_all_tables', [ $this, 'add_pro_tables' ] );
		$pro_statistics = new Pro_Statistics();
		$pro_statistics->init();
		$geo_ip = new Geo_Ip();
		$geo_ip->init();

		if ( $this->has_admin_access() ) {
			$archive = new Archive();
			$archive->init();

			$licensing = new Licensing();
			$licensing->init();

			$languages = new Languages();
			$languages->init();

			$db_upgrade_pro = new DB_Upgrade_Pro();
			$db_upgrade_pro->init();

			$ab_tests = new AB_Tests\AB_Tests();
			$ab_tests->init();
		}
	}

	/**
	 * Add Pro tables.
	 */
	public function add_pro_tables( array $tables ): array {
		$pro_tables = [
			'burst_campaigns',
			'burst_locations',
			'burst_archived_months',
			'burst_parameters',
		];

		return array_merge( $tables, $pro_tables );
	}

	/**
	 * Add premium debug fields to the debug information in site health.
	 */
	public function add_debug_fields( array $fields ): array {
		$location_data                    = Tracking_GeoIp::get_location_data();
		$fields['location_data']['value'] = $location_data;
		$geo_ip_file                      = get_option( 'burst_geo_ip_file' );
		$fields['geo_ip']['value']        = $geo_ip_file ?: 'No Geo IP file set';
		$licensing                        = new Licensing();
		$fields['license_valid']          = [
			'label' => __( 'License status', 'burst-statistics' ),
			'value' => $licensing->get_license_status(),
		];
		return $fields;
	}
	/**
	 * Add campaigns block to the email blocks.
	 *
	 * @param array<int, array<string, mixed>> $blocks Existing email blocks.
	 * @return array<int, array<string, mixed>> Modified blocks including campaign stats.
	 */
	public function add_pro_email_blocks( array $blocks ): array {
		$campaigns = [
			'title'    => __( 'Top campaigns', 'burst-statistics' ),
			'select'   => [ 'campaign', 'source', 'medium', 'conversion_rate' ],
			'order_by' => 'conversion_rate DESC',
			'group_by' => 'campaign, source, medium',
			'url'      => '#/statistics',
		];
		return array_merge( $blocks, [ $campaigns ] );
	}

	/**
	 * Remove the free plugin if it's active
	 * This is done on activation of the premium plugin
	 */
	public function remove_free_plugin(): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}

		if ( ! function_exists( 'is_plugin_active' ) ) {
			include_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		if ( is_plugin_active( 'burst-statistics/burst.php' ) ) {
			$free = 'burst-statistics/burst.php';
			// Always deactivate then delete. Only delete when in live mode. Otherwise, deactivate.
			deactivate_plugins( $free );
			// @phpstan-ignore-next-line.
			if ( ! defined( 'WP_DEBUG' ) || ! WP_DEBUG ) {
				delete_plugins( [ $free ] );
			}
		}

		if ( get_option( 'burst_run_premium_upgrade' ) ) {
			do_action( 'burst_on_premium_upgrade' );

			// set a transient, so we can prevent some errors showing in the first 5 minutes.
			update_option( 'burst_import_geo_ip_on_activation', true );
			set_transient( 'burst_recently_activated', true, 5 * MINUTE_IN_SECONDS );
			delete_option( 'burst_run_premium_upgrade' );
		}
	}

	/**
	 * Only for admin and/or cron filters and actions.
	 *
	 * @param array<int, array<string, mixed>> $blocks Existing email blocks.
	 * @param int                              $start  Unix timestamp for start date.
	 * @param int                              $end    Unix timestamp for end date.
	 * @return array<int, array<string, mixed>> Modified blocks including country stats.
	 */
	public function burst_premium_email_blocks( array $blocks, int $start, int $end ): array {
		$args      = [
			'date_start' => $start,
			'date_end'   => $end,
			'metrics'    => [ 'country_code', 'pageviews' ],
			'group_by'   => [ 'country_code' ],
		];
		$data      = \Burst\burst_loader()->admin->statistics->get_datatables_data( $args );
		$data      = $data['data'];
		$countries = [
			'header' => [ __( 'Country', 'burst-statistics' ), __( 'Pageviews', 'burst-statistics' ) ],
		];
		// limit $data to 10.
		$data = array_slice( $data, 0, 5 );
		foreach ( $data as $country ) {
			$ccountry_code = empty( $country['country_code'] ) ? '' : $country['country_code'];
			$countries[]   = [ Pro_Statistics::get_country_nice_name( $ccountry_code ), $country['pageviews'] ];
		}
		$blocks[] = [
			'title' => __( 'Countries', 'burst-statistics' ),
			'table' => Mail_Reports::format_array_as_table( $countries ),
			'url'   => $this->admin_url( 'burst#/statistics' ),
		];
		return $blocks;
	}


	/**
	 * Add tables to the list of tables to be burst.
	 *
	 * @param array<int, string> $tables List of table names.
	 * @return array<int, string> Updated list of table names.
	 */
	public function burst_all_tables( array $tables ): array {
		$tables[] = 'burst_parameters';
		$tables[] = 'burst_campaigns';
		return $tables;
	}

	/**
	 * Add notices for Black Friday and Cyber Monday.
	 *
	 * @param array $notices Existing notices.
	 * @return array<int, array{
	 *     id: string,
	 *     condition: array{type: string, function: string},
	 *     msg: string,
	 *     icon: string,
	 *     url: string,
	 *     dismissible: bool,
	 *     plusone: bool
	 * }>
	 */
	public function add_bf_and_cm_notices( array $notices ): array {
		return array_merge(
			$notices,
			[
				[
					'id'                  => 'bf_notice',
					'condition'           => [
						'type'     => 'serverside',
						'function' => 'Burst\Admin\Admin::is_bf()',
					],
					'msg'                 => __( 'Black Friday', 'burst-statistics' ) . ': ' . __( '40% Off Extra Websites! Expand to more sites', 'burst-statistics' ) . ' — ' . __( 'Limited time offer!', 'burst-statistics' ),
					'icon'                => 'sale',
					'url'                 => 'pricing/',
					'dismissible'         => true,
					'plusone'             => true,
					'dismiss_permanently' => true,
				],
				[
					'id'                  => 'cm_notice',
					'condition'           => [
						'type'     => 'serverside',
						'function' => 'Burst\Admin\Admin::is_cm()',
					],
					'msg'                 => __( 'Cyber Monday', 'burst-statistics' ) . ': ' . __( '40% Off Extra Websites! Expand to more sites', 'burst-statistics' ) . ' — ' . __( 'Last chance!', 'burst-statistics' ),
					'icon'                => 'sale',
					'url'                 => 'pricing/',
					'dismissible'         => true,
					'plusone'             => true,
					'dismiss_permanently' => true,
				],
			]
		);
	}

	/**
	 * Update version numbers and run upgrade procedures
	 */
	public function upgrade_premium( string $prev_version ): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}

		// Setup Pro-specific database upgrades when needed.
		if ( version_compare( $prev_version, '2.2.0', '<' ) ) {
			update_option( 'burst_db_upgrade_pro_to_city_database', true, false );
			update_option( 'burst_db_upgrade_pro_country_code_to_lookup_table', true, false );
		}
	}
}
