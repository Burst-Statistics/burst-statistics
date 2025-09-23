<?php
namespace Burst\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Burst\Admin\Capability\Capability;
use Burst\Admin\DB_Upgrade\DB_Upgrade;
use Burst\Admin\Statistics\Summary;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Save;
use Burst\Frontend\Goals\Goals;


class Upgrade {
	use Admin_Helper;
	use Save;

	/**
	 * Constructor
	 */
	public function init(): void {
		add_action( 'init', [ $this, 'check_upgrade' ], 10, 2 );
	}

	/**
	 * Run an upgrade procedure if the version has changed
	 */
	public function check_upgrade(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		$prev_version = get_option( 'burst-current-version', false );
		$new_version  = BURST_VERSION;

		// strip off everything after '#'.
		if ( strpos( $new_version, '#' ) !== false ) {
			$new_version = substr( $new_version, 0, strpos( $new_version, '#' ) );
		}

		if ( $prev_version === $new_version ) {
			return;
		}

		// install the tables, so we can access new columns below if necessary.
		do_action( 'burst_upgrade_before', $prev_version );

		// no upgrade.
		// add burst capabilities.
		if ( $prev_version
			&& version_compare( $prev_version, '1.1.1', '<' )
		) {
			Capability::add_capability( 'view', [ 'administrator', 'editor' ] );
			Capability::add_capability( 'manage' );
		}

		if ( $prev_version
			&& version_compare( $prev_version, '1.3.0', '<' ) ) {
			if ( is_multisite() ) {
				$tour_shown = get_site_option( 'burst_tour_shown_once', false );
			} else {
				$tour_shown = get_option( 'burst_tour_shown_once', false );
			}

			if ( $tour_shown ) {
				$this->update_option( 'burst_tour_shown_once', $tour_shown );
			}
		}

		// add capability to multisite as well.
		if ( is_multisite() ) {
			if ( $prev_version
				&& version_compare( $prev_version, '1.3.4', '<' )
			) {
				Capability::add_capability( 'view', [ 'administrator', 'editor' ] );
				Capability::add_capability( 'manage' );
			}
		}

		// Version 1.3.5.
		// - Upgrade to new bounce table.
		// - Upgrade to remove `event` and `action` columns from `burst_statistics` table.
		if ( $prev_version
			&& version_compare( $prev_version, '1.4.2.1', '<' ) ) {
			update_option( 'burst_db_upgrade_bounces', true );
			update_option( 'burst_db_upgrade_goals_remove_columns', true );
		}
		if ( $prev_version
			&& version_compare( $prev_version, '1.5.2', '<' ) ) {
			update_option( 'burst_db_upgrade_goals_set_conversion_metric', true );
		}

		if ( $prev_version
			&& version_compare( $prev_version, '1.5.3', '<' ) ) {
			update_option( 'burst_db_upgrade_strip_domain_names_from_entire_page_url', true );
			update_option( 'burst_db_upgrade_empty_referrer_when_current_domain', true );
			update_option( 'burst_db_upgrade_drop_user_agent', true );

			// remove the endpoint file from the old location.
			if ( file_exists( ABSPATH . '/burst-statistics-endpoint.php' ) ) {
				wp_delete_file( ABSPATH . '/burst-statistics-endpoint.php' );
			}
		}

		if ( $prev_version
			&& version_compare( $prev_version, '1.6.0', '<' ) ) {
			( new Summary() )->restart_update_summary_table_alltime();
		}
		if ( $prev_version
			&& version_compare( $prev_version, '1.6.1', '<' ) ) {
			// add the admin to the email reports mailing list.
			$mailinglist = burst_get_option( 'email_reports_mailinglist' );
			if ( ! $mailinglist ) {
				$defaults = [
					[
						'email'     => get_option( 'admin_email' ),
						'frequency' => 'monthly',
					],
				];
				$this->update_option( 'email_reports_mailinglist', $defaults );
			}
		}

		if ( $prev_version
			&& version_compare( $prev_version, '1.6.1', '<' ) ) {
			// add the admin to the email reports mailing list.
			$mailinglist = burst_get_option( 'email_reports_mailinglist' );
			if ( ! $mailinglist ) {
				$defaults = [
					[
						'email'     => get_option( 'admin_email' ),
						'frequency' => 'monthly',
					],
				];
				$this->update_option( 'email_reports_mailinglist', $defaults );
			}
		}

		// check if column 'device_id' exists in the table 'burst_statistics'.
		$is_version_upgrade      = $prev_version && version_compare( $prev_version, '1.7.0', '<' );
		$lookup_table_incomplete = version_compare( $prev_version, '1.7.1', '=' ) && ! ( new DB_Upgrade() )->column_exists( 'burst_statistics', 'device_id' );
		if ( $lookup_table_incomplete || $is_version_upgrade ) {
			update_option( 'burst_last_cron_hit', time(), false );
			// this option is used in the tracking, so should autoload until completed.
			update_option( 'burst_db_upgrade_create_lookup_tables', true, true );
			update_option( 'burst_db_upgrade_init_lookup_ids', true, false );
			update_option( 'burst_db_upgrade_upgrade_lookup_tables', true, false );
			update_option( 'burst_db_upgrade_upgrade_lookup_tables_drop_columns', true, false );

			// for each table separately, for fine grained control.
			update_option( 'burst_db_upgrade_create_lookup_tables_browser', true, false );
			update_option( 'burst_db_upgrade_create_lookup_tables_browser_version', true, false );
			update_option( 'burst_db_upgrade_create_lookup_tables_platform', true, false );
			update_option( 'burst_db_upgrade_create_lookup_tables_device', true, false );
			update_option( 'burst_db_upgrade_upgrade_lookup_tables_browser', true, false );
			update_option( 'burst_db_upgrade_upgrade_lookup_tables_browser_version', true, false );
			update_option( 'burst_db_upgrade_upgrade_lookup_tables_platform', true, false );
			update_option( 'burst_db_upgrade_upgrade_lookup_tables_device', true, false );

			// drop post_meta feature.
			update_option( 'burst_db_upgrade_drop_page_id_column', true, false );

			wp_schedule_single_event( time() + 300, 'burst_upgrade_iteration' );

			$mu_plugin = trailingslashit( WPMU_PLUGIN_DIR ) . 'burst_rest_api_optimizer.php';
			if ( file_exists( $mu_plugin ) ) {
				wp_delete_file( $mu_plugin );
			}
		}

		if ( $prev_version
			&& version_compare( $prev_version, '1.7.3', '<' ) ) {
			wp_clear_scheduled_hook( 'burst_every_5_minutes' );
			update_option( 'burst_db_upgrade_rename_entire_page_url_column', true, false );
			update_option( 'burst_db_upgrade_drop_path_from_parameters_column', true, false );

			wp_schedule_single_event( time() + 300, 'burst_upgrade_iteration' );
		}

		if ( $prev_version && version_compare( $prev_version, '1.8.1', '<' ) ) {
			\Burst\burst_loader()->admin->tasks->add_task( 'including_bounces' );
		}

		if ( $prev_version && version_compare( $prev_version, '2.0.0', '<' ) ) {
			add_action( 'plugins_loaded', [ $this, 'upgrade_goals' ], 30 );
		}

		// upgrade missing session_ids.
		// in the stats table, find the oldest session_id = 1 that is preceded with a higher sesssion_id.
		if ( $prev_version && version_compare( $prev_version, '2.0.4', '<' ) && ! defined( 'BURST_FREE' ) ) {
			update_option( 'burst_fix_incorrect_bounces', true, false );
			update_option( 'burst_db_upgrade_fix_missing_session_ids', true, false );
			update_option( 'burst_db_upgrade_clean_orphaned_session_ids', true, false );
		}

		// ensure the onboarding doesn't start again if users already had the plugin activated.
		if ( $prev_version && version_compare( $prev_version, '2.1.0', '<' ) ) {
			if ( defined( 'BURST_PRO' ) ) {
				update_option( 'burst_activation_time_pro', time(), false );
			}
		}

		if ( $prev_version && version_compare( $prev_version, '2.2.3', '<' ) ) {
			$mu_plugin = trailingslashit( WPMU_PLUGIN_DIR ) . 'burst_rest_api_optimizer.php';
			if ( file_exists( $mu_plugin ) ) {
				wp_delete_file( $mu_plugin );
			}
		}

		if ( $prev_version && version_compare( $prev_version, '2.2.6', '<' ) ) {
			update_option( 'burst_db_upgrade_add_page_ids', true, false );
			delete_post_meta_by_key( 'burst_total_pageviews_count' );
		}

		do_action( 'burst_upgrade_after', $prev_version );

		// ensure that we schedule at least one database upgrade.
		$admin = new Admin();
		$admin->run_table_init_hook();
		$admin->create_js_file();

		update_option( 'burst-current-version', $new_version );
	}

	/**
	 * Run upgrade for goals after 2.0 update
	 */
	public function upgrade_goals(): void {
		// upgrade all goals to use the new selector field.
		$goal_object = new Goals();
		$goals       = $goal_object->get_goals();
		foreach ( $goals as $goal ) {
			if ( $goal->type === 'clicks' || $goal->type === 'views' ) {
				if ( isset( $goal->attribute_value ) && $goal->attribute_value !== '' ) {
					$goal->selector = $goal->attribute === 'id' ? '#' . $goal->attribute_value : '.' . $goal->attribute_value;
				}
			}
			$goal->save();
		}

		// delete the setup, attribute and attribute_value fields from the db.
		global $wpdb;
		$table_name = $wpdb->prefix . 'burst_goals';

		// Check if columns exist before querying them.
		$columns = $wpdb->get_results( "SHOW COLUMNS FROM {$table_name}" );

		foreach ( $columns as $column ) {
            //phpcs:ignore
            if ( $column->Field === 'setup' || $column->Field === 'attribute' || $column->Field === 'attribute_value' ) {
				$wpdb->query( "ALTER TABLE {$table_name} DROP COLUMN {$column->Field}" );
			}
		}
	}
}
