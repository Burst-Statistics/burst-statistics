<?php
namespace Burst\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Burst\Admin\Capability\Capability;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Save;
use Burst\Frontend\Goals\Goals;
use Burst\Admin\Share\Share;
use Burst\Admin\Search_Console\State_Store;


class Upgrade {
	use Admin_Helper;
	use Database_Helper;
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

		if ( $prev_version === $new_version ) {
			return;
		}

		// Once per version change: drop burst_db_upgrade_* options whose task
		// slug no longer exists in the dispatcher registry, so leftovers from
		// removed upgrade routines cannot linger in wp_options forever.
		( new \Burst\Admin\DB_Upgrade\DB_Upgrade() )->delete_orphaned_upgrade_options();

		// Every version change re-arms the autoloaded pending flag, whether or
		// not this version arms a task: a task left pending from an earlier
		// version (armed before the flag existed, or stalled) must keep the
		// read paths on the slow-but-correct fallback until the dispatcher
		// confirms everything is done and clears the flag itself.
		update_option( 'burst_has_db_upgrade', true );

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

		// Version 1.3.5.
		// - Upgrade to new bounce table.
		// - Upgrade to remove `event` and `action` columns from `burst_statistics` table.
		if ( $prev_version
			&& version_compare( $prev_version, '1.4.2.1', '<' ) ) {
			$this->arm_db_upgrade( 'bounces' );
			$this->arm_db_upgrade( 'goals_remove_columns' );
		}
		if ( $prev_version
			&& version_compare( $prev_version, '1.5.2', '<' ) ) {
			$this->arm_db_upgrade( 'goals_set_conversion_metric' );
		}

		if ( $prev_version
			&& version_compare( $prev_version, '1.5.3', '<' ) ) {
			$this->arm_db_upgrade( 'strip_domain_names_from_entire_page_url' );
			$this->arm_db_upgrade( 'empty_referrer_when_current_domain' );
			$this->arm_db_upgrade( 'drop_user_agent' );

			// remove the endpoint file from the old location.
			if ( file_exists( ABSPATH . '/burst-statistics-endpoint.php' ) ) {
				wp_delete_file( ABSPATH . '/burst-statistics-endpoint.php' );
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
		$lookup_table_incomplete = version_compare( $prev_version, '1.7.1', '=' ) && ! $this->column_exists( 'burst_statistics', 'device_id' );
		if ( $lookup_table_incomplete || $is_version_upgrade ) {
			update_option( 'burst_last_cron_hit', time(), false );
			// this option is used in the tracking, so should autoload until completed.
			$this->arm_db_upgrade( 'create_lookup_tables' );
			$this->arm_db_upgrade( 'init_lookup_ids' );
			$this->arm_db_upgrade( 'upgrade_lookup_tables' );
			$this->arm_db_upgrade( 'upgrade_lookup_tables_drop_columns' );

			// for each table separately, for fine grained control.
			$this->arm_db_upgrade( 'create_lookup_tables_browser' );
			$this->arm_db_upgrade( 'create_lookup_tables_browser_version' );
			$this->arm_db_upgrade( 'create_lookup_tables_platform' );
			$this->arm_db_upgrade( 'create_lookup_tables_device' );
			$this->arm_db_upgrade( 'upgrade_lookup_tables_browser' );
			$this->arm_db_upgrade( 'upgrade_lookup_tables_browser_version' );
			$this->arm_db_upgrade( 'upgrade_lookup_tables_platform' );
			$this->arm_db_upgrade( 'upgrade_lookup_tables_device' );

			// drop post_meta feature.
			$this->arm_db_upgrade( 'drop_page_id_column' );

			wp_schedule_single_event( time() + 300, 'burst_upgrade_iteration' );

			$mu_plugin = trailingslashit( WPMU_PLUGIN_DIR ) . 'burst_rest_api_optimizer.php';
			if ( file_exists( $mu_plugin ) ) {
				wp_delete_file( $mu_plugin );
			}
		}

		if ( $prev_version
			&& version_compare( $prev_version, '1.7.3', '<' ) ) {
			wp_clear_scheduled_hook( 'burst_every_5_minutes' );
			$this->arm_db_upgrade( 'rename_entire_page_url_column' );
			$this->arm_db_upgrade( 'drop_path_from_parameters_column' );

			wp_schedule_single_event( time() + 300, 'burst_upgrade_iteration' );
		}

		if ( $prev_version && version_compare( $prev_version, '2.0.0', '<' ) ) {
			add_action( 'plugins_loaded', [ $this, 'upgrade_goals' ], 30 );
		}

		// upgrade missing session_ids.
		// in the stats table, find the oldest session_id = 1 that is preceded with a higher sesssion_id.
		if ( $prev_version && version_compare( $prev_version, '2.0.4', '<' ) && ! defined( 'BURST_FREE' ) ) {
			update_option( 'burst_fix_incorrect_bounces', true, false );
			$this->arm_db_upgrade( 'fix_missing_session_ids' );
			$this->arm_db_upgrade( 'clean_orphaned_session_ids' );
		}

		// ensure the onboarding doesn't start again if users already had the plugin activated.
		if ( $prev_version && version_compare( $prev_version, '2.1.0', '<' ) ) {
			if ( ! defined( 'BURST_FREE' ) ) {
				update_option( 'burst_activation_time_pro', time(), false );
			}
		}

		if ( $prev_version && version_compare( $prev_version, '2.2.3', '<' ) ) {
			$mu_plugin = trailingslashit( WPMU_PLUGIN_DIR ) . 'burst_rest_api_optimizer.php';
			if ( file_exists( $mu_plugin ) ) {
				wp_delete_file( $mu_plugin );
			}

			// Remove duplicates before dbDelta adds UNIQUE constraint.
			// Keep only the row with the lowest ID for each (goal_id, statistic_id) pair.
			// this is an old upgrade, moving it here to clean up the install_goal_statistics_table() function and ensure it only runs once.
			if ( $this->table_exists( 'burst_goal_statistics' ) ) {
				global $wpdb;
				$wpdb->query(
					"DELETE gs1 FROM {$wpdb->prefix}burst_goal_statistics gs1
                INNER JOIN {$wpdb->prefix}burst_goal_statistics gs2
                WHERE gs1.goal_id = gs2.goal_id
                AND gs1.statistic_id = gs2.statistic_id
                AND gs1.ID > gs2.ID"
				);
			}
		}

		if ( $prev_version && version_compare( $prev_version, '2.2.6', '<' ) ) {
			$this->arm_db_upgrade( 'add_page_ids' );
			delete_post_meta_by_key( 'burst_total_pageviews_count' );
		}

		if ( $prev_version && version_compare( $prev_version, '3.0.0', '<' ) ) {
			\Burst\burst_loader()->admin->tasks->add_task( 'ecommerce_integration' );
			burst_reinstall_rest_api_optimizer();
		}

		if ( $prev_version && version_compare( $prev_version, '3.0.1', '<' ) ) {
			update_option( 'burst_is_multi_domain', false );
			$plugin_activated_time = get_option( 'burst_activation_time', 0 );
			$cutoff_date           = strtotime( '2025-11-24 00:00:00' );
			if ( $plugin_activated_time > 0 && $plugin_activated_time < $cutoff_date ) {
				if ( ! defined( 'BURST_PRO' ) ) {
					\Burst\burst_loader()->admin->tasks->undismiss_task( 'bf_notice' );
					\Burst\burst_loader()->admin->tasks->undismiss_task( 'cm_notice' );
				}
			}
		}

        // phpcs:disable
        if ( $prev_version && version_compare( $prev_version, '3.1.0', '<' ) ) {
            global $wpdb;
            $sql = "DROP TABLE IF EXISTS {$wpdb->prefix}burst_summary";
            $wpdb->query( $sql );
            // The historical known_uids one-time fill was removed: the table no
            // longer exists on current versions (first_time_visit is set at
            // session creation via the uid dictionary), and a site jumping from
            // <3.1.0 straight to current runs the uid migration anyway.
        }

        //phpcs:enable
		if ( $prev_version && version_compare( $prev_version, '3.1.0.4', '<' ) ) {
			$plugin_activated_time = get_option( 'burst_activation_time', 0 );
			$cutoff_date           = strtotime( '2025-11-24 00:00:00' );
			if ( $plugin_activated_time > 0 && $plugin_activated_time < $cutoff_date ) {
				// free already dismissed in 3.0.1.
				if ( defined( 'BURST_PRO' ) ) {
					\Burst\burst_loader()->admin->tasks->undismiss_task( 'bf_notice' );
					\Burst\burst_loader()->admin->tasks->undismiss_task( 'cm_notice' );
					\Burst\burst_loader()->admin->tasks->schedule_task_validation();
				}
			}
		}

		if ( $prev_version && version_compare( $prev_version, '3.1.1', '<' ) ) {
			// reinstall with permalink for woocommerce exclusion.
			burst_reinstall_rest_api_optimizer();
		}

		if ( $prev_version && version_compare( $prev_version, '3.1.4', '<' ) ) {
			\Burst\burst_loader()->admin->tasks->add_task( 'filters_in_url' );
			$this->arm_db_upgrade( 'move_referrers_to_sessions' );
			delete_option( 'burst_pageviews_to_update' );
			// clear old referrers table.
			\Burst\burst_loader()->admin->app->weekly_clear_referrers_table();
		}

		if ( $prev_version && version_compare( $prev_version, '3.2.0', '<' ) ) {
			burst_reinstall_rest_api_optimizer();
			$installed_by = get_option( 'teamupdraft_installation_source_burst-statistics' );
			if ( ! empty( $installed_by ) ) {
				update_site_option( 'teamupdraft_installation_source_burst-statistics', $installed_by );
			}
			$this->arm_db_upgrade( 'move_reports_to_new_tables' );
			\Burst\burst_loader()->admin->tasks->add_task( 'join-discord' );
		}

		if ( $prev_version && version_compare( $prev_version, '3.2.1', '<' ) ) {
			if ( ! $this->get_option_bool( 'anonymous_usage_data' ) ) {
				\Burst\burst_loader()->admin->tasks->add_task( 'opt-in-sharing' );
			}

			$cookieless = $this->get_option_bool( 'enable_cookieless_tracking' ) || ( $this->get_option( 'privacy_level', 'cookie' ) !== 'cookie' );
			if ( $cookieless && ! $this->get_option_bool( 'enable_turbo_mode' ) ) {
				\Burst\burst_loader()->admin->tasks->add_task( 'turbo_mode_recommended' );
			}
		}

		if ( $prev_version && version_compare( $prev_version, '3.3.0-beta1', '<' ) ) {
			$this->arm_db_upgrade( 'move_columns_to_sessions' );
		}

		if ( $prev_version && version_compare( $prev_version, '3.4.0', '<' ) ) {
			// Truncate query_stats table because SQL normalization changed (timestamps are now replaced with placeholders).
			if ( $this->table_exists( 'burst_query_stats' ) ) {
				global $wpdb;
				$wpdb->query( "TRUNCATE TABLE {$wpdb->prefix}burst_query_stats" );
			}

			// Reinstalling rest API optimizer for new REST API endpoint `get_action/ecommerce/<action>`.
			burst_reinstall_rest_api_optimizer();
		}

		if ( $prev_version && version_compare( $prev_version, '3.4.2', '<' ) ) {
			global $wpdb;
			$oldest_timestamp = (int) $wpdb->get_var( "SELECT MIN(time) FROM {$wpdb->prefix}burst_statistics" );
			$activation_time  = (int) get_option( 'burst_activation_time', 0 );

			if ( $oldest_timestamp > 0
				&& $activation_time > 0
				&& $oldest_timestamp < ( $activation_time - WEEK_IN_SECONDS )
			) {
				update_option( 'burst_activation_time', $oldest_timestamp, false );
			}
			burst_reinstall_rest_api_optimizer();

			if ( class_exists( '\WP_Application_Passwords' ) ) {
				$viewer = get_user_by( 'login', 'burst_statistics_viewer' );
				if ( $viewer ) {
					\WP_Application_Passwords::delete_all_application_passwords( $viewer->ID );
				}
			}

			flush_rewrite_rules();
		}

		if ( $prev_version && version_compare( $prev_version, '3.4.2.1', '<' ) ) {
			// No-op code to pass the unit test when no upgrade required.
			$prev_version .= '';
		}

		if ( $prev_version && version_compare( $prev_version, '3.4.3', '<' ) ) {
			// Drop burst_plugin_path and store only the validated
			// plugin directory slug instead. The MU optimizer now builds the
			// integration path from WP_PLUGIN_DIR + slug.
			delete_option( 'burst_plugin_path' );
			$burst_plugin_slug = basename( untrailingslashit( BURST_PATH ) );
			if ( preg_match( '/^[a-zA-Z0-9_-]+$/', $burst_plugin_slug ) ) {
				update_option( 'burst_plugin_slug', $burst_plugin_slug, true );
			}
			// Reinstall the optimizer so the on-disk MU plugin matches the new loader logic.
			burst_reinstall_rest_api_optimizer();
			delete_transient( 'burst_use_fallback_licensing_domain' );
		}

		if ( $prev_version && version_compare( $prev_version, '3.5.0', '<' ) ) {
			burst_reinstall_rest_api_optimizer();
		}

		if ( $prev_version && version_compare( $prev_version, '3.5.1', '<' ) ) {
			// Convert oversized/string report columns to fitted/native types.
			$this->arm_db_upgrade( 'report_table_types' );
		}

		if ( $prev_version && version_compare( $prev_version, '3.6.0', '<' ) ) {
			// Remove historic spam/invalid browsers left over from before the
			// user agent allowlist was tightened.
			$this->arm_db_upgrade( 'clean_spam_browsers' );

			// Country GeoIP tracking ships in free as of 3.6. Download the database
			// (the burst_locations country lookup is seeded by install_locations_table
			// via the run_table_init_hook below). The "available from" timestamp is set
			// only here — i.e. on an upgrade from an existing install — so a fresh
			// install, which has country data from its first hit, shows no notice.
			update_option( 'burst_import_geo_ip_on_activation', true, false );
			// Stored via the settings system (not a standalone option) so the React
			// world-map notice can read it through getValue().
			$this->update_option( 'country_geo_database_available_time', time() );
		}

		if ( $prev_version && version_compare( $prev_version, '3.6.1', '<' ) ) {
			// Reinstall the optimizer so fields/get keeps other plugins loaded,
			// which the integrations settings page needs for plugin detection.
			burst_reinstall_rest_api_optimizer();
			if ( defined( 'BURST_FREE' ) ) {
				burst_delete_option( 'track_external_links' );
			}

			// Backfill the descriptive bio and website link on the existing viewer
			// user so admins understand why the account exists.
			( new Share() )->auth->backfill_viewer_profile();

			// Migrate privacy_level based on current enable_cookieless_tracking value.
			$cookieless = $this->get_option_bool( 'enable_cookieless_tracking' );
			$this->update_option( 'privacy_level', $cookieless ? 'fingerprint' : 'cookie' );

			if ( defined( 'BURST_FREE' ) ) {
				delete_option( 'burst_trial_offered' );
				\Burst\burst_loader()->admin->tasks->dismiss_task( 'trial_offer_loyal_users' );
			}
			\Burst\burst_loader()->admin->tasks->add_task( 'search_console_integration' );
		}

		if ( $prev_version && version_compare( $prev_version, '3.6.2', '<' ) ) {
			// Enable the low-traffic plugin update suggestions for existing
			// installs. Free feature; fresh installs get it via setup_defaults().
			$this->update_option( 'plugin_update_suggestions', true );
			// Calculate the low-traffic window shortly after the upgrade, so the
			// update-timing hints on plugins.php have data on their first render.
			wp_schedule_single_event( time() + 10 * MINUTE_IN_SECONDS, 'burst_calculate_low_traffic_time' );
		}

		if ( $prev_version && version_compare( $prev_version, '3.6.3', '<' ) ) {
			$this->mark_noop_upgrade( '3.6.3', $prev_version );
		}

		if ( $prev_version && version_compare( $prev_version, '3.6.3.1', '<' ) ) {
			$this->mark_noop_upgrade( '3.6.3.1', $prev_version );
		}

		if ( $prev_version && version_compare( $prev_version, '3.7.0', '<' ) ) {
			if ( ! State_Store::migrate_legacy_options() ) {
				return;
			}

			// uid dictionary migration pipeline. The DB_Upgrade dispatcher runs
			// one task at a time in registry order: seed the dictionary, backfill
			// statistics.uid_id, backfill sessions (start_time + uid_id), then
			// finalize (build the uid_id indexes online — the legacy varchar uid
			// column is left untouched until 3.7.1 drops it — and convert the
			// other visitor-keyed tables to uid_id). From the table init below on,
			// the tracker writes uid_id only (see tracking_schema_current());
			// the read paths switch to uid_id as well, so historic rows count
			// as visitors only once the statistics backfill has reached them.
			$this->arm_db_upgrade( 'seed_uid_dictionary' );
			$this->arm_db_upgrade( 'statistics_uid_id' );
			$this->arm_db_upgrade( 'sessions_first_time' );
			$this->arm_db_upgrade( 'finalize_uid_id' );
			// The malicious-data scan stored a pre-migration uid string; it cannot survive the migration to dictionary ids.
			delete_option( 'burst_cleanup_uid' );
			// Marks the start of the migration window: sessions created while
			// the pipeline runs get no first_time_visit flag from tracking yet
			// ("created in the dictionary" does not mean "new" while the seed
			// is still inserting historic uids); finalize backstops the window
			// with one bounded sweep from this timestamp.
			update_option( 'burst_uid_migration_started', time(), false );

			// page dictionary pipeline: seed burst_page_urls (url → WP post id,
			// initial canonical flag), then backfill the historic page_id = 0
			// rows with negative dictionary ids. Page queries keep grouping on
			// the page_url string until both tasks complete (see
			// page_dictionary_ready()).
			$this->arm_db_upgrade( 'seed_page_urls' );
			$this->arm_db_upgrade( 'statistics_page_id' );

			// first/last_visited_url on sessions were write-only (entry/exit
			// pages come from burst_statistics); tracking no longer writes
			// them. Dropping the columns is deliberately deferred: the
			// previous version writes them on every session create/update, so
			// keeping them lets a rollback to that version run without
			// database errors.
			// @todo 3.7.1: arm burst_db_upgrade_drop_session_visited_urls here
			// (in the 3.7.1 upgrade block) and re-register the task under the
			// 3.7.1 group in DB_Upgrade::get_db_upgrades().
		}

		if ( '' !== $prev_version && version_compare( $prev_version, '3.7.0.1', '<' ) ) {
			// The page_id repair of this release is Pro-only (see
			// Pro::upgrade_premium()): free never shipped 3.7.0, and the 3.7.0
			// pipeline above now seeds and backfills the clean key space.
			$this->mark_noop_upgrade( '3.7.0.1', $prev_version );
		}

		// bump-version.sh inserts new release versions above this line — do not remove.
		$admin = new Admin();
		$admin->run_table_init_hook();
		$admin->create_js_file();
		wp_schedule_single_event( time() + 60, 'burst_upgrade_iteration' );
		do_action( 'burst_upgrade_after', $prev_version );
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
	}
}
