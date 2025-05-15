<?php
namespace Burst\Pro;

use Burst\Pro\Languages\Languages;
use Burst\Admin\Mailer\Mail_Reports;
use Burst\Admin\Statistics\Statistics;
use Burst\Pro\Licensing\Licensing;
use Burst\Traits\Admin_Helper;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

class Pro {
	use Admin_Helper;

	/**
	 * Constructor
	 */
	public function __construct() {
		add_filter( 'burst_mail_reports_blocks', [ $this, 'burst_premium_email_blocks' ], 10, 3 );
		add_action( 'burst_activation', [ $this, 'remove_free_plugin' ] );
		add_filter( 'burst_all_tables', [ $this, 'burst_all_tables' ] );
		add_filter( 'burst_tasks', [ $this, 'add_bf_and_cm_notices' ] );

		new Pro_Statistics();
		new Geo_Ip();
		new Archive();
		new Licensing();
		new Languages();
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
			update_option( 'burst_import_geo_ip_on_activation', true, false );
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
					'id'          => 'bf_notice2024',
					'condition'   => [
						'type'     => 'serverside',
						'function' => 'Burst\Admin\Admin::is_bf()',
					],
					'msg'         => __( 'Black Friday', 'burst-statistics' ) . ': ' . __( '40% Off Extra Websites! Expand to more sites', 'burst-statistics' ) . ' — ' . __( 'Limited time offer!', 'burst-statistics' ),
					'icon'        => 'sale',
					'url'         => 'pricing/',
					'dismissible' => true,
					'plusone'     => true,
				],
				[
					'id'          => 'cm_notice2024',
					'condition'   => [
						'type'     => 'serverside',
						'function' => 'Burst\Admin\Admin::is_cm()',
					],
					'msg'         => __( 'Cyber Monday', 'burst-statistics' ) . ': ' . __( '40% Off Extra Websites! Expand to more sites', 'burst-statistics' ) . ' — ' . __( 'Last chance!', 'burst-statistics' ),
					'icon'        => 'sale',
					'url'         => 'pricing/',
					'dismissible' => true,
					'plusone'     => true,
				],
			]
		);
	}
}
