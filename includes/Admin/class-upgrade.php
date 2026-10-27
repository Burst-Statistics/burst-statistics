<?php
namespace Burst\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Burst\Admin\Capability\Capability;
use Burst\Admin\DomainTypes\Admin_Option_Category;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Save;
use Burst\Frontend\Goals\Goals;
use Burst\Admin\Search_Console\State_Store;


class Upgrade {
	use Admin_Helper;
	use Database_Helper;
	use Save;

	/**
	 * The plugin version this file belongs to. See check_upgrade().
	 *
	 * @var string
	 */
	public const BUILD = '3.7.4';

	/**
	 * How often one version may postpone the upgrade for a table that does not
	 * match its definition, before the upgrade completes on the schema as it is.
	 *
	 * @var int
	 */
	private const MAX_UPGRADE_ATTEMPTS = 3;

	/**
	 * Tables that did not match their definition after the install ran in this
	 * request, reported by Database_Helper::install_schema(), per blog id: on
	 * multisite one install run covers every site of the network, and a
	 * subsite's table must not hold back the upgrade of another site.
	 *
	 * @var array<int, string[]>
	 */
	private static array $schema_install_failures = [];

	/**
	 * Whether the table install bailed out in this request because another
	 * request held the upgrade lock, reported by Admin::run_table_init_hook().
	 */
	private static bool $install_lock_unavailable = false;

	/**
	 * Standalone backend options folded into the category rows, as category =>
	 * [ option name in the row => standalone option name without the burst_
	 * prefix ]. Free and Pro keys live together: a standalone option that does
	 * not exist is skipped, so free has nothing to migrate for the Pro
	 * categories.
	 */
	private const LEGACY_ADMIN_OPTIONS = [
		Admin_Option_Category::CORE           => [
			'auto_installed'                  => 'auto_installed',
			'current_pageviews_milestone'     => 'current_pageviews_milestone',
			'js_write_error'                  => 'js_write_error',
			'last_pageviews_milestone'        => 'last_pageviews_milestone',
			'last_telemetry_send'             => 'last_telemetry_send',
			'telemetry_offset'                => 'telemetry_offset',
			'ajax_fallback_active'            => 'ajax_fallback_active',
			'ajax_fallback_active_timestamp'  => 'ajax_fallback_active_timestamp',
			'missing_tables'                  => 'missing_tables',
			'rest_api_optimizer_not_writable' => 'rest_api_optimizer_not_writable',
			'review_notice_shown'             => 'review_notice_shown',
			'attempt_database_fix'            => 'attempt_database_fix',
			'tour_completed'                  => 'tour_completed',
			'tour_last_section'               => 'tour_last_section',
			// The onboarding state (burst_start_onboarding, _skipped_, _completed_,
			// the telemetry copies and burst_onboarding_free_completed) stays in
			// standalone options: the shared TeamUpdraft onboarding reads and
			// writes them by prefix.
			'archive_table_size'              => 'table_size',
			'installed_integrations'          => 'installed_integrations',
			'last_auto_update_run'            => 'low_traffic_last_auto_update_run',
			'search_terms_version'            => 'search_terms_version',
		],
		Admin_Option_Category::DIAGNOSTICS    => [
			'tracking_health'                   => 'tracking_health',
			'tracking_health_last_email'        => 'tracking_health_last_email',
			'tracking_health_last_notification' => 'tracking_health_last_notification',
			'settings_last_changed'             => 'settings_last_changed',
			'plugins_last_updated'              => 'plugins_last_updated',
		],
		Admin_Option_Category::DIAGNOSTIC_RUN => [ 'results' => 'tracking_diagnostics' ],
		Admin_Option_Category::NOTIFICATIONS  => [ 'slack_webhook_url' => 'slack_webhook_url' ],
		Admin_Option_Category::TASKS          => [
			'active'                => 'tasks',
			'permanently_dismissed' => 'tasks_permanently_dismissed',
			'active_drip'           => 'active_drip_task',
			'drip_last_dismissed'   => 'drip_last_dismissed_time',
		],
		Admin_Option_Category::LANGUAGES      => [
			'clean_languages'       => 'clean_languages',
			'install_user_language' => 'install_user_language',
		],
		Admin_Option_Category::QUICK_WINS     => [
			'processed'  => 'quick_wins',
			'date_range' => 'quick_wins_date_range',
			'dismissed'  => 'quick_win_dismissed_wins',
			'snoozed'    => 'quick_win_snoozed_wins',
		],
		Admin_Option_Category::ANOMALY        => [
			'spikes'    => 'anomaly_spikes',
			'dips'      => 'anomaly_dips',
			'good_days' => 'anomaly_good_days',
		],
	];

	/**
	 * Constructor
	 */
	public function init(): void {
		add_action( 'init', [ $this, 'check_upgrade' ], 10, 2 );
	}

	/**
	 * Record that a table does not match its definition after its install ran.
	 *
	 * Static, because the installers are spread over every feature class and
	 * the install can be fired by any of the burst_install_tables callers, not
	 * only by check_upgrade().
	 *
	 * @param string $table_name The table without prefix.
	 */
	public static function record_schema_install_failure( string $table_name ): void {
		$blog_id = get_current_blog_id();
		if ( ! in_array( $table_name, self::$schema_install_failures[ $blog_id ] ?? [], true ) ) {
			self::$schema_install_failures[ $blog_id ][] = $table_name;
		}
	}

	/**
	 * The tables of the current blog that did not match their definition in
	 * the last install run of this request.
	 *
	 * @return string[]
	 */
	private static function failed_tables_of_current_blog(): array {
		return self::$schema_install_failures[ get_current_blog_id() ] ?? [];
	}

	/**
	 * Record that the table install could not run because the upgrade lock was
	 * held by another request.
	 *
	 * Static for the same reason as record_schema_install_failure(): the
	 * install runs through an action, so its result cannot be returned to
	 * check_upgrade().
	 */
	public static function record_install_lock_contention(): void {
		self::$install_lock_unavailable = true;
	}

	/**
	 * Forget what an earlier install run reported.
	 *
	 * Called when an install run starts (Admin::run_table_init_hook()) and when
	 * check_upgrade() starts its own, so each reads the result of its own run.
	 */
	public static function reset_install_state(): void {
		self::$schema_install_failures  = [];
		self::$install_lock_unavailable = false;
	}

	/**
	 * Close an install run that left every table of the current blog matching.
	 *
	 * Clears the attempt counter of this version and the incomplete-upgrade
	 * notice. This is what lets the advice of the upgrade_incomplete task work:
	 * reactivating Burst runs the install, and once the tables are fixed, the
	 * notice goes and a postponed upgrade runs again on the next request.
	 * Called by Admin::run_table_init_hook() after every install run, after it
	 * has restored the blog it started on.
	 */
	public static function finish_install_run(): void {
		if ( [] !== self::failed_tables_of_current_blog() ) {
			return;
		}

		self::clear_failed_upgrade_attempts();
		self::clear_upgrade_incomplete();
	}

	/**
	 * The failed upgrade attempts of this version.
	 *
	 * Stored with the version they belong to, so a new release always starts
	 * with a full set of attempts.
	 */
	private static function failed_upgrade_attempts(): int {
		$attempts = Admin_Options::get( Admin_Option_Category::CORE, 'upgrade_attempts', [] );
		if ( ! is_array( $attempts ) || BURST_VERSION !== ( $attempts['version'] ?? '' ) ) {
			return 0;
		}

		return (int) ( $attempts['count'] ?? 0 );
	}

	/**
	 * Forget the failed upgrade attempts.
	 *
	 * Checked against the request cache first: the key is absent on the normal
	 * path, and Admin_Options::delete() reads the stored row on every call.
	 */
	private static function clear_failed_upgrade_attempts(): void {
		if ( Admin_Options::has( Admin_Option_Category::CORE, 'upgrade_attempts' ) ) {
			Admin_Options::delete( Admin_Option_Category::CORE, 'upgrade_attempts' );
		}
	}

	/**
	 * Remove the incomplete-upgrade notice, see clear_failed_upgrade_attempts().
	 */
	private static function clear_upgrade_incomplete(): void {
		if ( Admin_Options::has( Admin_Option_Category::CORE, 'upgrade_incomplete' ) ) {
			Admin_Options::delete( Admin_Option_Category::CORE, 'upgrade_incomplete' );
		}
	}

	/**
	 * Whether the last upgrade completed with tables that do not match their
	 * definition. Condition of the upgrade_incomplete task.
	 */
	public static function is_upgrade_incomplete(): bool {
		return '' !== self::incomplete_upgrade_tables();
	}

	/**
	 * The tables the last upgrade could not bring in line with their definition.
	 *
	 * @return string Comma separated table names, empty when the upgrade completed.
	 */
	public static function incomplete_upgrade_tables(): string {
		return (string) Admin_Options::get( Admin_Option_Category::CORE, 'upgrade_incomplete', '' );
	}

	/**
	 * Run an upgrade procedure if the version has changed.
	 *
	 * The upgrade only runs when all the code it uses belongs to this version,
	 * and its routines only run once every table of this site has the columns
	 * of its definition. Otherwise burst-current-version keeps the previous
	 * version and the next admin request tries again; a retry repeats the
	 * install, never the routines, which are not safe to run twice. A table
	 * that still does not match after MAX_UPGRADE_ATTEMPTS completes the
	 * upgrade on the schema as it is, with the upgrade_incomplete task, so a
	 * table that needs a look cannot hold back the whole release.
	 *
	 * The reason is a request that runs files from two plugin versions at once:
	 * on hosts with OPcache (WP Engine) the cache is invalidated per file, so
	 * right after an update one request can load, say, the new Upgrade with the
	 * old installer. The upgrade then fails while the version option says it
	 * succeeded, leaving the site on a schema the new code does not expect.
	 * Every class of the upgrade path therefore carries a BUILD constant with
	 * the version of its own file (bump-version.sh updates them), and a stale
	 * file postpones the upgrade instead of half-running it.
	 */
	public function check_upgrade(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		$prev_version = get_option( 'burst-current-version', null );
		$new_version  = BURST_VERSION;

		if ( $prev_version === $new_version ) {
			return;
		}

		// The upgrade installs the tables, and add_index() does nothing for a
		// user who cannot manage Burst: their request would leave the schema
		// half-installed. Cron and WP-CLI can manage, so the upgrade does not
		// wait for an administrator to open wp-admin.
		if ( ! $this->user_can_manage() ) {
			return;
		}

		$stale_classes = $this->stale_build_classes();
		if ( [] !== $stale_classes ) {
			self::error_log( 'Upgrade postponed, code of another version is loaded: ' . implode( ', ', $stale_classes ) );
			return;
		}

		// Only the install of this upgrade decides whether its routines run.
		self::reset_install_state();

		// install the tables, so we can access new columns below if necessary.
		do_action( 'burst_upgrade_before', $prev_version );

		// The install bailed out on the lock of another request, so no table was
		// verified and the upgrade routines below would read columns the install
		// was supposed to add. Postpone the whole upgrade to the next admin
		// request. Not a failed attempt: no install ran, so there is nothing to
		// give up on.
		if ( self::$install_lock_unavailable ) {
			self::error_log( 'Upgrade postponed, another request holds the install lock' );
			return;
		}

		$failed_tables = self::failed_tables_of_current_blog();
		if ( [] !== $failed_tables ) {
			$attempts = $this->count_failed_upgrade_attempt( $failed_tables );
			if ( $attempts < self::MAX_UPGRADE_ATTEMPTS ) {
				return;
			}
			$this->flag_upgrade_incomplete( $failed_tables );
		}

		// Once per version change: drop burst_db_upgrade_* options whose task
		// slug no longer exists in the dispatcher registry, so leftovers from
		// removed upgrade routines cannot linger in wp_options forever.
		( new \Burst\Admin\DB_Upgrade\DB_Upgrade() )->delete_orphaned_upgrade_options();

		// Every version change re-arms the autoloaded pending flag, whether or
		// not this version arms a task: a task left pending from an earlier
		// version (armed before the flag existed, or stalled) must keep the
		// read paths on the slow-but-correct fallback until the dispatcher
		// confirms everything is done and clears the flag itself. A fresh
		// install has no earlier version and nothing pending; arm_db_upgrade()
		// sets the flag itself should activation arm a task.
		if ( null !== $prev_version ) {
			update_option( 'burst_has_db_upgrade', true );
		}

		// no upgrade.
		// add burst capabilities.
		if ( null !== $prev_version
			&& version_compare( $prev_version, '1.1.1', '<' )
		) {
			Capability::add_capability( 'view', [ 'administrator', 'editor' ] );
			Capability::add_capability( 'manage' );
		}

		// Version 1.3.5.
		// - Upgrade to new bounce table.
		// - Upgrade to remove `event` and `action` columns from `burst_statistics` table.
		if ( null !== $prev_version
			&& version_compare( $prev_version, '1.4.2.1', '<' ) ) {
			$this->arm_db_upgrade( 'bounces' );
			$this->arm_db_upgrade( 'goals_remove_columns' );
		}
		if ( null !== $prev_version
			&& version_compare( $prev_version, '1.5.2', '<' ) ) {
			$this->arm_db_upgrade( 'goals_set_conversion_metric' );
		}

		if ( null !== $prev_version
			&& version_compare( $prev_version, '1.5.3', '<' ) ) {
			$this->arm_db_upgrade( 'strip_domain_names_from_entire_page_url' );
			$this->arm_db_upgrade( 'empty_referrer_when_current_domain' );
			$this->arm_db_upgrade( 'drop_user_agent' );

			// remove the endpoint file from the old location.
			if ( file_exists( ABSPATH . '/burst-statistics-endpoint.php' ) ) {
				wp_delete_file( ABSPATH . '/burst-statistics-endpoint.php' );
			}
		}

		if ( null !== $prev_version
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
		$is_version_upgrade      = null !== $prev_version && version_compare( $prev_version, '1.7.0', '<' );
		$lookup_table_incomplete = null !== $prev_version && version_compare( $prev_version, '1.7.1', '=' ) && ! $this->column_exists( 'burst_statistics', 'device_id' );
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

		if ( null !== $prev_version
			&& version_compare( $prev_version, '1.7.3', '<' ) ) {
			wp_clear_scheduled_hook( 'burst_every_5_minutes' );
			$this->arm_db_upgrade( 'rename_entire_page_url_column' );
			$this->arm_db_upgrade( 'drop_path_from_parameters_column' );

			wp_schedule_single_event( time() + 300, 'burst_upgrade_iteration' );
		}

		if ( null !== $prev_version && version_compare( $prev_version, '2.0.0', '<' ) ) {
			add_action( 'plugins_loaded', [ $this, 'upgrade_goals' ], 30 );
		}

		// upgrade missing session_ids.
		// in the stats table, find the oldest session_id = 1 that is preceded with a higher sesssion_id.
		if ( null !== $prev_version && version_compare( $prev_version, '2.0.4', '<' ) && ! defined( 'BURST_FREE' ) ) {
			update_option( 'burst_fix_incorrect_bounces', true, false );
			$this->arm_db_upgrade( 'fix_missing_session_ids' );
			$this->arm_db_upgrade( 'clean_orphaned_session_ids' );
		}

		// ensure the onboarding doesn't start again if users already had the plugin activated.
		if ( null !== $prev_version && version_compare( $prev_version, '2.1.0', '<' ) ) {
			if ( ! defined( 'BURST_FREE' ) ) {
				update_option( 'burst_activation_time_pro', time(), false );
			}
		}

		if ( null !== $prev_version && version_compare( $prev_version, '2.2.3', '<' ) ) {
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

		if ( null !== $prev_version && version_compare( $prev_version, '2.2.6', '<' ) ) {
			$this->arm_db_upgrade( 'add_page_ids' );
			delete_post_meta_by_key( 'burst_total_pageviews_count' );
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.0.0', '<' ) ) {
			\Burst\burst_loader()->admin->tasks->add_task( 'ecommerce_integration' );
			burst_reinstall_rest_api_optimizer();
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.0.1', '<' ) ) {
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
        if ( null !== $prev_version && version_compare( $prev_version, '3.1.0', '<' ) ) {
            global $wpdb;
            $sql = "DROP TABLE IF EXISTS {$wpdb->prefix}burst_summary";
            $wpdb->query( $sql );
            // The historical known_uids one-time fill was removed: the table no
            // longer exists on current versions (first_time_visit is set at
            // session creation via the uid dictionary), and a site jumping from
            // <3.1.0 straight to current runs the uid migration anyway.
        }

        //phpcs:enable
		if ( null !== $prev_version && version_compare( $prev_version, '3.1.0.4', '<' ) ) {
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

		if ( null !== $prev_version && version_compare( $prev_version, '3.1.1', '<' ) ) {
			// reinstall with permalink for woocommerce exclusion.
			burst_reinstall_rest_api_optimizer();
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.1.4', '<' ) ) {
			\Burst\burst_loader()->admin->tasks->add_task( 'filters_in_url' );
			$this->arm_db_upgrade( 'move_referrers_to_sessions' );
			delete_option( 'burst_pageviews_to_update' );
			// clear old referrers table.
			\Burst\burst_loader()->admin->app->weekly_clear_referrers_table();
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.2.0', '<' ) ) {
			burst_reinstall_rest_api_optimizer();
			$installed_by = get_option( 'teamupdraft_installation_source_burst-statistics' );
			if ( ! empty( $installed_by ) ) {
				update_site_option( 'teamupdraft_installation_source_burst-statistics', $installed_by );
			}
			$this->arm_db_upgrade( 'move_reports_to_new_tables' );
			\Burst\burst_loader()->admin->tasks->add_task( 'join-discord' );
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.2.1', '<' ) ) {
			if ( ! $this->get_option_bool( 'anonymous_usage_data' ) ) {
				\Burst\burst_loader()->admin->tasks->add_task( 'opt-in-sharing' );
			}

			$cookieless = $this->get_option_bool( 'enable_cookieless_tracking' ) || ( $this->get_option( 'privacy_level', 'cookie' ) !== 'cookie' );
			if ( $cookieless && ! $this->get_option_bool( 'enable_turbo_mode' ) ) {
				\Burst\burst_loader()->admin->tasks->add_task( 'turbo_mode_recommended' );
			}
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.3.0-beta1', '<' ) ) {
			$this->arm_db_upgrade( 'move_columns_to_sessions' );
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.4.0', '<' ) ) {
			// Truncate query_stats table because SQL normalization changed (timestamps are now replaced with placeholders).
			if ( $this->table_exists( 'burst_query_stats' ) ) {
				global $wpdb;
				$wpdb->query( "TRUNCATE TABLE {$wpdb->prefix}burst_query_stats" );
			}

			// Reinstalling rest API optimizer for new REST API endpoint `get_action/ecommerce/<action>`.
			burst_reinstall_rest_api_optimizer();
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.4.2', '<' ) ) {
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

		if ( null !== $prev_version && version_compare( $prev_version, '3.4.2.1', '<' ) ) {
			// No-op code to pass the unit test when no upgrade required.
			$prev_version .= '';
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.4.3', '<' ) ) {
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

		if ( null !== $prev_version && version_compare( $prev_version, '3.5.0', '<' ) ) {
			burst_reinstall_rest_api_optimizer();
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.5.1', '<' ) ) {
			// Convert oversized/string report columns to fitted/native types.
			$this->arm_db_upgrade( 'report_table_types' );
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.6.0', '<' ) ) {
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

		if ( null !== $prev_version && version_compare( $prev_version, '3.6.1', '<' ) ) {
			// Reinstall the optimizer so fields/get keeps other plugins loaded,
			// which the integrations settings page needs for plugin detection.
			burst_reinstall_rest_api_optimizer();
			if ( defined( 'BURST_FREE' ) ) {
				burst_delete_option( 'track_external_links' );
			}

			// Backfill the descriptive bio and website link on the existing viewer
			// user so admins understand why the account exists.
			\Burst\burst_loader()->admin->share->auth->backfill_viewer_profile();

			// Migrate privacy_level based on current enable_cookieless_tracking value.
			$cookieless = $this->get_option_bool( 'enable_cookieless_tracking' );
			$this->update_option( 'privacy_level', $cookieless ? 'fingerprint' : 'cookie' );

			if ( defined( 'BURST_FREE' ) ) {
				delete_option( 'burst_trial_offered' );
				\Burst\burst_loader()->admin->tasks->dismiss_task( 'trial_offer_loyal_users' );
			}
			\Burst\burst_loader()->admin->tasks->add_task( 'search_console_integration' );
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.6.2', '<' ) ) {
			// Enable the low-traffic plugin update suggestions for existing
			// installs. Free feature; fresh installs get it via setup_defaults().
			$this->update_option( 'plugin_update_suggestions', true );
			// Calculate the low-traffic window shortly after the upgrade, so the
			// update-timing hints on plugins.php have data on their first render.
			wp_schedule_single_event( time() + 10 * MINUTE_IN_SECONDS, 'burst_calculate_low_traffic_time' );
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.6.3', '<' ) ) {
			$this->mark_noop_upgrade( '3.6.3', $prev_version );
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.6.3.1', '<' ) ) {
			$this->mark_noop_upgrade( '3.6.3.1', $prev_version );
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.7.0', '<' ) ) {
			if ( ! State_Store::migrate_legacy_options() ) {
				return;
			}

			// uid dictionary migration pipeline. The DB_Upgrade dispatcher runs
			// one task at a time in registry order: seed the dictionary, backfill
			// statistics.uid_id, backfill sessions (start_time + uid_id), then
			// finalize (build the uid_id indexes online — the legacy varchar uid
			// column is left untouched until 3.7.3 drops it — and convert the
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
			// them. The columns are dropped in 3.7.3, see below.
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.7.0.1', '<' ) ) {
			// The page_id repair of this release is Pro-only (see
			// Pro::upgrade_premium()): free never shipped 3.7.0, and the 3.7.0
			// pipeline above now seeds and backfills the clean key space.
			$this->mark_noop_upgrade( '3.7.0.1', $prev_version );
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.7.1', '<' ) ) {
			// Posts first seen after the 3.7.0 seed had no dictionary row
			// (the tracker registered rows for page_id 0 urls only) and
			// displayed as an empty url in the page tables when the read path
			// could not resolve their permalink (plugin post types such as
			// WooCommerce products are unregistered on Burst REST requests).
			// The tracker now registers every hit url; this backfills the
			// rows of the hits already stored.
			$this->arm_db_upgrade( 'backfill_page_urls' );

			// sessions.has_pageview (created by the table init below) marks
			// sessions with at least one non-404 hit; flag the historic rows
			// so session grain applies the hit-grain 404 rule. Session grain
			// stays off until the task completes (db_upgrades_complete()).
			$this->arm_db_upgrade( 'sessions_has_pageview' );

			// Reinstall the REST API optimizer (1.1.0): the request body is now
			// inspected once per request and capped at 64 KB, and active_plugins
			// writes during an optimized request keep the full plugin list.
			burst_reinstall_rest_api_optimizer();

			// The "import your statistics" task is for new installs, where the
			// previous tool's data is still worth bringing over; a site that has
			// been on Burst for a while gets no upgrade notice for it. The task
			// is added by the cron validation, so it is dismissed for good here,
			// before that validation runs (see Tasks::dismiss_task_permanently()).
			\Burst\burst_loader()->admin->tasks->dismiss_task_permanently( 'import_statistics_data' );
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.7.2', '<' ) ) {
			// The MaxMind database moved from the predictable
			// uploads/burst/maxmind/ directory to a random-token directory so
			// it cannot be downloaded from a guessable url. Move an existing
			// database and re-point burst_geo_ip_file; the daily cron keeps
			// catching files that are still placed in the legacy directory.
			( new \Burst\Admin\Geo_Ip\Geo_Ip() )->maybe_migrate_database_directory();

			// Share-link recipients could edit the viewer account's own profile
			// (password, email) through the core users/me endpoint, now blocked
			// by Viewer_Lockdown. Reset the account as a precaution.
			( new \Burst\Admin\Share\Share() )->auth->reset_viewer_account();
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.7.3', '<' ) ) {
			// Drop what 3.7.0 kept only so a rollback to 3.6.x would run
			// without database errors: the legacy uid columns, the unused
			// session entry/exit url columns and the known_uids table. The
			// columns are NOT NULL without a default and no longer written,
			// so every tracking insert raised a MySQL 1364 warning for them.
			// The task waits behind the uid pipeline in the dispatcher.
			$this->arm_db_upgrade( 'drop_legacy_columns' );

			// Settings › Notifications: the diagnostic email switch moves into the
			// alert grid, alert emails get their own recipients list (starting
			// with the admin email) and the default report channel setting is
			// replaced by the burst_default_report_channels filter. Email for
			// traffic spikes and drops stays off, so an update does not start
			// sending emails nobody asked for.
			( new \Burst\Admin\Notifications\Alert_Preferences() )->migrate_legacy_settings();
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.7.3.1', '<' ) ) {
			// Hits stranded under a post id the page dictionary no longer
			// carries — a migration that renumbered the posts while the paths
			// stayed the same — render with an empty page name and split the
			// page's history off its current traffic. The task finds the
			// affected ids with one indexed probe and only touches their
			// rows, so a site without the problem does no work.
			$this->arm_db_upgrade( 'repair_superseded_page_ids' );
		}

		if ( null !== $prev_version && version_compare( $prev_version, '3.7.4', '<' ) ) {
			// Fold the standalone backend options into the category rows the
			// Admin_Options API reads from.
			$this->migrate_admin_options();

			// The load-failure catch in the main plugin file that wrote these
			// is gone, and so is the task that reported them.
			delete_option( 'burst_php_error_time' );
			delete_option( 'burst_php_error_count' );
			delete_option( 'burst_php_error_detected' );

			// Reinstall the REST API optimizer (1.2.0): it now only acts on
			// requests through index.php with the REST prefix at the start of
			// the path, so /wp-login.php/wp-json/burst/v1/... and similar
			// PATH_INFO URLs can no longer switch off other plugins.
			burst_reinstall_rest_api_optimizer();
		}

		// bump-version.sh inserts new release versions above this line — do not remove.
		$admin = new Admin();
		$admin->run_table_init_hook();
		$admin->create_js_file();
		// Re-evaluate the serverside task conditions after every upgrade; they
		// run on cron only, so a task a new release adds appears without
		// waiting for the daily validation.
		\Burst\burst_loader()->admin->tasks->schedule_task_validation();
		wp_schedule_single_event( time() + 60, 'burst_upgrade_iteration' );
		do_action( 'burst_upgrade_after', $prev_version );

		self::clear_failed_upgrade_attempts();
		if ( [] === $failed_tables ) {
			self::clear_upgrade_incomplete();
		}
		update_option( 'burst-current-version', $new_version, true );
	}

	/**
	 * Fold the standalone backend options into the category-specific
	 * burst_admin_options_* rows (see Admin_Options).
	 *
	 * Runs inside the version change itself, so there is no window in which a
	 * reader has to fall back to the standalone option. Safe to run twice and
	 * from two requests at once: the values are merged into the row under the
	 * category lock, and the standalone options are only deleted after that
	 * write succeeded. The standalone value wins over the key already in the
	 * row, because that row can only hold what a request wrote while the
	 * standalone option was still the stored state — so a key an earlier
	 * upgrade block of this same run stored (the 3.7.1 task dismissal) is
	 * replaced by the pre-upgrade list it was appended to.
	 */
	private function migrate_admin_options(): void {
		$legacy_names = [];
		foreach ( self::LEGACY_ADMIN_OPTIONS as $names ) {
			foreach ( $names as $legacy_name ) {
				$legacy_names[] = 'burst_' . $legacy_name;
			}
		}
		wp_prime_option_caches( $legacy_names );

		$missing = new \stdClass();
		foreach ( self::LEGACY_ADMIN_OPTIONS as $category => $names ) {
			$values = [];
			foreach ( $names as $name => $legacy_name ) {
				$value = get_option( 'burst_' . $legacy_name, $missing );
				if ( $missing !== $value ) {
					$values[ $name ] = $value;
				}
			}

			if ( [] === $values || ! Admin_Options::merge( $category, $values ) ) {
				continue;
			}

			foreach ( array_keys( $values ) as $name ) {
				delete_option( 'burst_' . $names[ $name ] );
			}
		}
	}

	/**
	 * The classes of the upgrade path whose BUILD stamp is not BURST_VERSION.
	 *
	 * Checked are this class, DB_Upgrade and every class hooked to
	 * burst_install_tables, plus the Database_Helper trait through its own
	 * build method. Callbacks from outside Burst carry no stamp and are
	 * skipped: a third-party installer must not be able to block the upgrade.
	 *
	 * Code that takes part in the upgrade without installing a table adds
	 * itself through the burst_stale_builds filter when its own stamp is not
	 * BURST_VERSION. Pro does so for its upgrade routine, which runs on
	 * burst_upgrade_after inside this upgrade.
	 *
	 * @return string[] The stale classes, empty when all of the code is of this version.
	 */
	private function stale_build_classes(): array {
		global $wp_filter;

		$classes = [ self::class, \Burst\Admin\DB_Upgrade\DB_Upgrade::class ];
		if ( isset( $wp_filter['burst_install_tables'] ) ) {
			foreach ( $wp_filter['burst_install_tables']->callbacks as $callbacks ) {
				foreach ( $callbacks as $callback ) {
					if ( is_array( $callback['function'] ) && is_object( $callback['function'][0] ) ) {
						$classes[] = get_class( $callback['function'][0] );
					}
				}
			}
		}

		$stale = [];
		foreach ( array_unique( $classes ) as $class ) {
			if ( ! str_starts_with( $class, 'Burst\\' ) ) {
				continue;
			}
			if ( ! defined( $class . '::BUILD' ) || constant( $class . '::BUILD' ) !== BURST_VERSION ) {
				$stale[] = $class;
			}
		}

		if ( $this->database_helper_build() !== BURST_VERSION ) {
			$stale[] = Database_Helper::class;
		}

		return (array) apply_filters( 'burst_stale_builds', $stale );
	}

	/**
	 * Count an upgrade run that left a table not matching its definition.
	 *
	 * The counter is per version, so a new release always gets its full set of
	 * attempts.
	 *
	 * @param string[] $failed_tables The tables that do not match.
	 * @return int The number of failed attempts of this version, this one included.
	 */
	private function count_failed_upgrade_attempt( array $failed_tables ): int {
		$attempts = self::failed_upgrade_attempts() + 1;
		Admin_Options::update(
			Admin_Option_Category::CORE,
			'upgrade_attempts',
			[
				'version' => BURST_VERSION,
				'count'   => $attempts,
			]
		);
		self::error_log( 'Upgrade incomplete, tables not matching their definition: ' . implode( ', ', $failed_tables ) . " (attempt {$attempts})" );

		return $attempts;
	}

	/**
	 * Tell the user the upgrade completed with tables that do not match.
	 *
	 * The upgrade_incomplete task stays until an install run leaves every table
	 * matching, see finish_install_run().
	 *
	 * @param string[] $failed_tables The tables that do not match.
	 */
	private function flag_upgrade_incomplete( array $failed_tables ): void {
		self::error_log( 'Upgrade completed with tables not matching their definition: ' . implode( ', ', $failed_tables ) );
		Admin_Options::update( Admin_Option_Category::CORE, 'upgrade_incomplete', implode( ', ', $failed_tables ) );
		\Burst\burst_loader()->admin->tasks->add_task( 'upgrade_incomplete' );
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
