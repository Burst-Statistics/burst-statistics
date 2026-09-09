<?php
namespace Burst\Admin\DB_Upgrade;

use Burst\Admin\Reports\DomainTypes\Report_Content_Block;
use Burst\Admin\Reports\DomainTypes\Report_Day_Of_Week;
use Burst\Admin\Reports\DomainTypes\Report_Format;
use Burst\Admin\Reports\DomainTypes\Report_Frequency;
use Burst\Admin\Reports\DomainTypes\Report_Week_Of_Month;
use Burst\Admin\Reports\Report;
use Burst\Admin\Statistics\Visitor_Bitmaps;
use Burst\Frontend\Tracking\Tracking;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Sanitize;

defined( 'ABSPATH' ) || die();
class DB_Upgrade {
	use Admin_Helper;
	use Database_Helper;
	use Helper;
	use Sanitize;

	private int $cron_interval = MINUTE_IN_SECONDS;

	/**
	 * Retry budget of the finalize step (straggler conversion + index build)
	 * before it is marked stalled and backed off to one attempt per day.
	 */
	private const FINALIZE_MAX_ATTEMPTS = 3;
	private int $batch                  = 100000;

	/**
	 * Lookup item => id column on burst_sessions (and on burst_statistics for
	 * installs that still carry the pre-3.1.4.1 legacy columns).
	 */
	private const LOOKUP_TABLES = [
		'browser'         => 'browser_id',
		'browser_version' => 'browser_version_id',
		'platform'        => 'platform_id',
		'device'          => 'device_id',
	];

	/**
	 * Lookup items whose ids key a dimension scope in the visitor bitmap store.
	 * Re-pointing sessions to another id invalidates those day sets.
	 */
	private const LOOKUP_BITMAP_ITEMS = [ 'browser', 'platform', 'device' ];

	/**
	 * Length of the lookup tables' `name` column since 3.6.3.
	 */
	private const LOOKUP_NAME_LENGTH = 191;

	/**
	 * The burst_install_tables firing the lookup dedupe last ran for. In Pro both
	 * DB_Upgrade and DB_Upgrade_Pro are initialised, so the hook is registered
	 * twice; the second callback of the same firing must not run the scan again.
	 */
	private static int $lookup_dedupe_action_count = -1;

	/**
	 * DB_Upgrade constructor.
	 */
	public function init(): void {
		add_action( 'burst_daily', [ $this, 'upgrade' ] );
		add_action( 'admin_init', [ $this, 'ensure_upgrade_scheduled' ] );
		add_action( 'burst_upgrade_iteration', [ $this, 'upgrade' ] );
		add_filter( 'burst_tasks', [ $this, 'add_progress_notice' ] );
		// Priority 9: duplicate lookup names must be gone before
		// Statistics::install_statistics_table() (10) adds the unique index.
		add_action( 'burst_install_tables', [ $this, 'dedupe_lookup_tables' ], 9 );
	}

	/**
	 * Keep the upgrade pipeline moving when WP-Cron is unreliable — without
	 * ever running a task inside the page request. Upgrade tasks can take
	 * minutes (index builds on large tables) and must not land in an admin's
	 * page load; instead a Burst dashboard page load checks, early and cheaply
	 * (one autoloaded option), whether a pending pipeline still has an
	 * iteration coming. If the iteration event is missing or overdue it is
	 * re-scheduled for now and cron is spawned: WP-Cron then runs it in a
	 * detached loopback request, a system cron picks it up on its next tick,
	 * and a stalled task's daily backoff (see upgrade()) is respected because
	 * a future-dated event counts as "coming".
	 */
	public function ensure_upgrade_scheduled(): void {
		// Burst dashboard page loads only (as the old dashboard fallback was):
		// keep this off every other admin request, and never inside a cron
		// run, which is already the thing we are trying to start.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only comparison, no form data used.
		if ( ! isset( $_GET['page'] ) || 'burst' !== $_GET['page'] || wp_doing_cron() ) {
			return;
		}
		if ( ! $this->has_pending_db_upgrade() || ! $this->has_admin_access() ) {
			return;
		}
		if ( get_transient( 'burst_upgrade_running' ) ) {
			return;
		}
		$next = (int) wp_next_scheduled( 'burst_upgrade_iteration' );
		if ( $next > 0 && $next > time() - $this->cron_interval ) {
			return;
		}
		if ( $next > 0 ) {
			wp_unschedule_event( $next, 'burst_upgrade_iteration' );
		}
		wp_schedule_single_event( time() - 1, 'burst_upgrade_iteration' );

		// Spawn only when spawning is a detached, non-blocking loopback POST
		// to wp-cron.php — the current request is not touched. Under
		// ALTERNATE_WP_CRON, spawn_cron() would instead redirect THIS request
		// (?doing_wp_cron) and run the cron jobs inline in it, and under
		// DISABLE_WP_CRON the site relies on a system cron that a loopback
		// must not bypass. When no cron can be spawned and the iteration is
		// overdue anyway, run one iteration right here — the original
		// dashboard fallback — so a site whose cron is not firing at all still
		// makes progress on every Burst page load (the advisory lock in
		// upgrade() keeps it from overlapping a late cron run).
		$can_spawn = ! ( defined( 'ALTERNATE_WP_CRON' ) && ALTERNATE_WP_CRON ) && ! ( defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON );
		if ( $can_spawn ) {
			spawn_cron();
			return;
		}
		$this->upgrade();
	}

	/**
	 * Take a MySQL advisory lock for the dispatcher run. Unlike the
	 * burst_upgrade_running transient, the lock is released by the server the
	 * moment the holding connection dies, so a PHP process killed mid-task
	 * (gateway timeout, host limits) never leaves the pipeline parked behind
	 * a stale flag. Non-blocking: a second runner simply skips its turn.
	 */
	private function acquire_upgrade_lock(): bool {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return 1 === (int) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK( %s, 0 )', $this->upgrade_lock_name() ) );
	}

	/**
	 * Release the dispatcher lock taken by acquire_upgrade_lock().
	 */
	private function release_upgrade_lock(): void {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query( $wpdb->prepare( 'SELECT RELEASE_LOCK( %s )', $this->upgrade_lock_name() ) );
	}

	/**
	 * Per-blog lock name (the table prefix is per blog on multisite).
	 */
	private function upgrade_lock_name(): string {
		global $wpdb;
		return substr( $wpdb->prefix . 'burst_db_upgrade', 0, 64 );
	}

	/**
	 * A task that keeps failing: [ 'slug' => …, 'error' => …, 'attempts' => … ].
	 * Written by a task after its retry budget is spent (see
	 * upgrade_finalize_uid_id()), cleared by that task on success. While set,
	 * upgrade() backs off to one attempt per day instead of one per minute and
	 * the task notice shows the error.
	 *
	 * @return array<string, mixed>
	 */
	public function stalled_task(): array {
		$stalled = get_option( 'burst_db_upgrade_stalled', [] );
		return is_array( $stalled ) ? $stalled : [];
	}

	/**
	 * If there is any upgrade running
	 */
	public function progress_complete(): bool {
		return $this->get_progress( 'all', 'all' ) >= 100;
	}

	/**
	 * Every task slug the dispatcher knows about (free + pro, all versions).
	 * The authoritative list of what "a pending upgrade" can be — used by
	 * db_upgrades_complete() so it ignores stray burst_db_upgrade_* options
	 * that are state flags, not migration tasks.
	 *
	 * @return string[]
	 */
	public function get_all_upgrade_slugs(): array {
		return $this->get_db_upgrades( 'all', 'all' );
	}

	/**
	 * Delete burst_db_upgrade_* options whose task slug no longer exists in the
	 * registry: leftovers from removed upgrade routines would linger in
	 * wp_options forever. Options belonging to a registered slug are kept —
	 * the task flag itself and its derived state (`{slug}_last_id` watermarks,
	 * `{slug}_attempts` retry counters). Called once per version change, from
	 * Upgrade::check_upgrade().
	 */
	public function delete_orphaned_upgrade_options(): void {
		global $wpdb;
		$prefix = 'burst_db_upgrade_';
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- one-time cleanup on version change.
		$option_names = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s",
				$wpdb->esc_like( $prefix ) . '%'
			)
		);
		if ( empty( $option_names ) ) {
			return;
		}

		$slugs = $this->get_all_upgrade_slugs();
		// Derived state stored under a legacy, non-slug-prefixed name: keep it
		// as long as its owning slug is registered.
		$legacy_aliases = [
			'column_offset' => 'drop_path_from_parameters_column',
		];

		foreach ( $option_names as $option_name ) {
			$candidate = substr( $option_name, strlen( $prefix ) );
			if ( isset( $legacy_aliases[ $candidate ] ) && in_array( $legacy_aliases[ $candidate ], $slugs, true ) ) {
				continue;
			}
			$keep = false;
			foreach ( $slugs as $slug ) {
				if ( $candidate === $slug || 0 === strpos( $candidate, $slug . '_' ) ) {
					$keep = true;
					break;
				}
			}
			if ( ! $keep ) {
				delete_option( $option_name );
			}
		}
	}

	/**
	 * Add a notice about the progress to the admin dashboard in burst.
	 * phpcs:ignore
     * @param array $warnings //array of warnings in burst.
     * phpcs:ignore
     * @return array
	 */
	public function add_progress_notice( array $warnings ): array {
		// All registered slugs, not just the ones keyed >= BURST_VERSION: a
		// stuck older task disables the fast paths (db_upgrades_complete())
		// just the same, so anything pending must be visible here and run to
		// completion — the notice and db_upgrades_complete() agree.
		$progress = $this->get_progress( 'all', 'all' );
		if ( $progress < 100 ) {
			$progress   = round( $progress, 2 );
			$warnings[] = [
				'id'          => 'upgrade_progress',
				'condition'   => [
					'type'     => 'serverside',
					'function' => '!(new \Burst\Admin\DB_Upgrade\DB_Upgrade() )->progress_complete()',
				],
				'status'      => 'all',
				'msg'         => $this->sprintf(
					// translators: %s: progress of the upgrade.
					__( 'An upgrade is running in the background, and is currently at %s.', 'burst-statistics' ),
					$progress . '%'
				) . ' ' .
					__( 'For large databases this process may take a while. Your data will be tracked as usual.', 'burst-statistics' ),
				'icon'        => 'open',
				'dismissible' => false,
			];
		}

		$stalled = $this->stalled_task();
		if ( ! empty( $stalled['slug'] ) ) {
			$warnings[] = [
				'id'          => 'upgrade_stalled',
				'condition'   => [
					'type'     => 'serverside',
					'function' => '!empty( (new \Burst\Admin\DB_Upgrade\DB_Upgrade() )->stalled_task() )',
				],
				'status'      => 'all',
				'msg'         => $this->sprintf(
					// translators: 1: upgrade task name, 2: number of attempts, 3: last database error.
					__( 'The database upgrade step "%1$s" failed %2$s times and is now retried once a day. Last error: %3$s', 'burst-statistics' ),
					(string) $stalled['slug'],
					(string) ( $stalled['attempts'] ?? '' ),
					(string) ( $stalled['error'] ?? '' )
				),
				'icon'        => 'warning',
				'dismissible' => false,
			];
		}

		return $warnings;
	}

	/**
	 * Get progress of the upgrade process
	 */
	public function get_progress( string $type, string $version ): float {
		$total_upgrades     = $this->get_db_upgrades( $type, $version );
		$remaining_upgrades = $total_upgrades;
		// check if all upgrades are done.
		$count_remaining_upgrades = 0;
		$intermediate_percentage  = 0;
		$intermediates            = [];
		foreach ( $remaining_upgrades as $upgrade ) {
			// if any upgrade is not done.
			if ( get_option( "burst_db_upgrade_$upgrade" ) ) {
				++$count_remaining_upgrades;
				// check if there's an intermediate progress count. If so, we add it as a percentage to the progress.
				$has_intermediate = get_transient( "burst_progress_$upgrade" );
				if ( $has_intermediate ) {
					$intermediates[ $upgrade ] = $has_intermediate;
				}
			}
		}
		$intermediate         = reset( $intermediates );
		$count_total_upgrades = count( $total_upgrades );
		// upgrade percentage for one upgrade is 100 / total upgrades.
		$upgrade_percentage_one_upgrade = $count_total_upgrades === 0 ? 100 : 100 / $count_total_upgrades;
		if ( $intermediate ) {
			$intermediate_percentage = $intermediate * $upgrade_percentage_one_upgrade;
		}
		$count_total_upgrades = 0 === $count_total_upgrades ? 1 : $count_total_upgrades;

		$percentage = 100 - ( $count_remaining_upgrades / $count_total_upgrades ) * 100;
		$percentage = $percentage + $intermediate_percentage;
		if ( $percentage > 100 ) {
			$percentage = 100;
		}

		return $percentage;
	}

	/**
	 * Init the upgrades
	 * - upgrade only if admin is logged in
	 * - only one upgrade at a time
	 */
	public function upgrade(): void {
		if ( defined( 'BURST_NO_UPGRADE' ) && BURST_NO_UPGRADE ) {
			return;
		}
		if ( ! $this->has_admin_access() ) {
			return;
		}
		$upgrade_running = get_transient( 'burst_upgrade_running' );
		if ( $upgrade_running ) {
			return;
		}
		// The transient is the cheap cross-request flag; the advisory lock is
		// the guarantee (server-released when the runner dies), so a task
		// outrunning the 60 seconds cannot be joined by a second runner.
		if ( ! $this->acquire_upgrade_lock() ) {
			return;
		}
		set_transient( 'burst_upgrade_running', true, 60 );
		// check if we need to upgrade.
		$db_upgrades = $this->get_db_upgrades( 'free', 'all' );
		// check if all upgrades are done.
		$do_upgrade = false;
		foreach ( $db_upgrades as $upgrade ) {
			// if any upgrade is not done.
			if ( get_option( "burst_db_upgrade_$upgrade" ) ) {
				$do_upgrade = $upgrade;
				// if we need to upgrade break the loop.
				break;
			}
		}

		// @phpstan-ignore-next-line.
		if ( WP_DEBUG ) {
			// log all upgrades that still need to be done.
			foreach ( $db_upgrades as $upgrade ) {
				if ( get_option( "burst_db_upgrade_$upgrade" ) ) {
					self::error_log( "Upgrade $upgrade still needs to be done." );
				}
			}
		}

		// ensure that the tasks get updated with the continuing upgrade process.
		if ( $do_upgrade ) {
			\Burst\burst_loader()->admin->tasks->schedule_task_validation();
		}
		// only one upgrade at a time.
		if ( 'bounces' === $do_upgrade ) {
			$this->upgrade_bounces();
		}
		if ( 'goals_remove_columns' === $do_upgrade ) {
			$this->upgrade_goals_remove_columns();
		}
		if ( 'goals_set_conversion_metric' === $do_upgrade ) {
			$this->upgrade_goals_set_conversion_metric();
		}
		if ( 'drop_user_agent' === $do_upgrade ) {
			$this->upgrade_drop_user_agent();
		}
		if ( 'empty_referrer_when_current_domain' === $do_upgrade ) {
			$this->upgrade_empty_referrer_when_current_domain();
		}
		if ( 'strip_domain_names_from_entire_page_url' === $do_upgrade ) {
			$this->upgrade_strip_domain_names_from_entire_page_url();
		}

		if ( 'create_lookup_tables' === $do_upgrade ) {
			$this->create_lookup_tables();
		}
		if ( 'init_lookup_ids' === $do_upgrade ) {
			$this->initialize_lookup_ids();
		}
		if ( 'upgrade_lookup_tables' === $do_upgrade ) {
			$this->upgrade_lookup_tables();
		}
		if ( 'upgrade_lookup_tables_drop_columns' === $do_upgrade ) {
			$this->upgrade_lookup_tables_drop_columns();
		}

		if ( 'drop_page_id_column' === $do_upgrade ) {
			$this->upgrade_drop_page_id_column();
		}

		if ( 'rename_entire_page_url_column' === $do_upgrade ) {
			$this->change_column_name_entire_page_url();
		}

		if ( 'drop_path_from_parameters_column' === $do_upgrade ) {
			$this->drop_path_from_parameters_column();
		}

		if ( 'fix_missing_session_ids' === $do_upgrade ) {
			delete_option( 'burst_db_upgrade_fix_missing_session_ids' );
		}

		if ( 'clean_orphaned_session_ids' === $do_upgrade ) {
			delete_option( 'burst_db_upgrade_clean_orphaned_session_ids' );
		}

		if ( 'report_table_types' === $do_upgrade ) {
			$this->upgrade_report_table_types();
		}

		if ( 'add_page_ids' === $do_upgrade ) {
			$this->upgrade_add_page_ids();
		}

		if ( 'move_referrers_to_sessions' === $do_upgrade ) {
			$this->upgrade_referrers();
		}

		if ( 'fix_trailing_slash_on_referrers' === $do_upgrade ) {
			$this->fix_trailing_slash_on_referrers();
		}

		if ( 'move_reports_to_new_tables' === $do_upgrade ) {
			$this->move_reports_to_new_tables();
		}

		if ( 'move_columns_to_sessions' === $do_upgrade ) {
			$this->upgrade_move_columns_to_sessions();
		}

		if ( 'clean_spam_browsers' === $do_upgrade ) {
			$this->clean_spam_browsers();
		}

		if ( 'seed_uid_dictionary' === $do_upgrade ) {
			$this->upgrade_seed_uid_dictionary();
		}

		if ( 'statistics_uid_id' === $do_upgrade ) {
			$this->upgrade_statistics_uid_id();
		}

		if ( 'sessions_first_time' === $do_upgrade ) {
			$this->upgrade_sessions_first_time();
		}

		if ( 'finalize_uid_id' === $do_upgrade ) {
			$this->upgrade_finalize_uid_id();
		}

		if ( 'seed_page_urls' === $do_upgrade ) {
			$this->upgrade_seed_page_urls();
		}

		if ( 'statistics_page_id' === $do_upgrade ) {
			$this->upgrade_statistics_page_id();
		}

		if ( 'drop_session_visited_urls' === $do_upgrade ) {
			$this->upgrade_drop_session_visited_urls();
		}

		// check free progress, because pro upgrades are hooked to burst_upgrade_iteration.
		if ( $this->get_progress( 'free', 'all' ) < 100 ) {
			// free upgrades not finished yet. A task that spent its retry
			// budget is retried once a day instead of every minute, so a
			// structurally failing step does not burn a worker per minute.
			$interval = empty( $this->stalled_task() ) ? $this->cron_interval : DAY_IN_SECONDS;
			wp_schedule_single_event( time() + $interval, 'burst_upgrade_iteration' );
		} else {
			wp_clear_scheduled_hook( 'burst_upgrade_iteration' );
			// if pro upgrades are not finished yet, do them.
			if ( $this->get_progress( 'pro', 'all' ) < 100 ) {
				delete_transient( 'burst_upgrade_running' );
				do_action( 'burst_upgrade_pro_iteration' );
			}
			// Free and pro both done: clear the autoloaded pending flag, so the
			// read paths stop checking the per-slug task options
			// (db_upgrades_complete()). Re-armed by the next arm_db_upgrade().
			if ( $this->get_progress( 'pro', 'all' ) >= 100 ) {
				update_option( 'burst_has_db_upgrade', false );
			}
		}

		delete_transient( 'burst_upgrade_running' );
		$this->release_upgrade_lock();
	}

	/**
	 * Move reports to new tables
	 */
	private function move_reports_to_new_tables(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		if ( ! $this->table_exists( 'burst_reports' ) ) {
			return;
		}

		$option_name = 'burst_db_upgrade_move_reports_to_new_tables';
		if ( ! get_option( $option_name ) ) {
			return;
		}

		// Check if old reports table exists.
		$old_reports = $this->get_option( 'email_reports_mailinglist' );

		if ( empty( $old_reports ) ) {
			delete_option( $option_name );
			return;
		}

		$reports_to_migrate = [];

		foreach ( $old_reports as $old_report ) {

			if ( ! isset( $old_report['email'] ) ) {
				continue;
			}

			$frequency = $old_report['frequency'] ?? 'weekly';

			$reports_to_migrate[ $frequency ][] = $old_report['email'];
		}

		foreach ( $reports_to_migrate as $frequency => $emails ) {
			$report = new Report();

			$week_of_month = Report_Frequency::MONTHLY === $frequency ? Report_Week_Of_Month::FIRST : Report_Week_Of_Month::default();
			$day_of_week   = Report_Frequency::WEEKLY === $frequency || Report_Frequency::MONTHLY === $frequency ? Report_Day_Of_Week::MONDAY : Report_Day_Of_Week::default();
			$send_time     = '09:00';
			$content       = defined( 'BURST_PRO' ) ? Report_Content_Block::all() : Report_Content_Block::default();

			$report->set_format( Report_Format::default() )
					->set_frequency( $frequency )
					->set_day_of_week( $day_of_week )
					->set_week_of_month( $week_of_month )
					->set_send_time( $send_time )
					->set_content( $content )
					->set_recipients( $emails )
					->set_enabled( true )
					->set_scheduled( true );

			$report->save();
		}

		burst_delete_option( 'email_reports_mailinglist' );
		delete_option( $option_name );
	}

	/**
	 * Get the upgrades
	 *
	 * @return string[]
	 */
	protected function get_db_upgrades( string $plugin_type, string $select_version ): array {
		$upgrades = apply_filters(
			'burst_db_upgrades',
			[
				'1.4.2.1' => [
					'bounces',
					'goals_remove_columns',
				],
				'1.5.2'   => [
					'goals_set_conversion_metric',
				],
				'1.5.3'   => [
					'empty_referrer_when_current_domain',
					'strip_domain_names_from_entire_page_url',
					'drop_user_agent',
				],
				'1.7.0'   => [
					'create_lookup_tables',
					'init_lookup_ids',
					'upgrade_lookup_tables',

					// the below upgrades are handled within the create and upgrade look up tables functions, but are added here for the progress calculation.
					'create_lookup_tables_browser',
					'create_lookup_tables_browser_version',
					'create_lookup_tables_platform',
					'create_lookup_tables_device',
					'upgrade_lookup_tables_browser',
					'upgrade_lookup_tables_browser_version',
					'upgrade_lookup_tables_platform',
					'upgrade_lookup_tables_device',
					// end progress only upgrade items.

					'upgrade_lookup_tables_drop_columns',
					'drop_page_id_column',
				],
				'1.7.1'   => [
					'rename_entire_page_url_column',
					'drop_path_from_parameters_column',
				],
				'2.0.4'   => [
					'fix_missing_session_ids',
					'clean_orphaned_session_ids',
				],
				'2.2.6'   => [
					'add_page_ids',
				],
				'3.1.4'   => [
					'move_referrers_to_sessions',
				],
				'3.1.4.1' => [
					'fix_trailing_slash_on_referrers',
				],
				'3.2.0'   => [
					'move_reports_to_new_tables',
				],
				'3.2.3'   => [
					'move_columns_to_sessions',
				],
				'3.5.1'   => [
					'report_table_types',
				],
				'3.6.0'   => [
					'clean_spam_browsers',
				],
				'3.7.0'   => [
					// uid dictionary pipeline — order matters, the dispatcher
					// runs the first pending task only.
					'seed_uid_dictionary',
					'statistics_uid_id',
					'sessions_first_time',
					'finalize_uid_id',
					// page dictionary pipeline: seed burst_page_urls (with the
					// WP post id per url and an initial canonical flag), then
					// replace the historic page_id = 0 rows with negative
					// dictionary ids so page queries can group on page_id.
					'seed_page_urls',
					'statistics_page_id',
					// first/last_visited_url on sessions are no longer written
					// (entry/exit pages are derived from burst_statistics),
					// but dropping the columns is deferred one release so a
					// rollback to the previous version — which writes them on
					// every session create/update — hits no database errors.
					// @todo 3.7.1: add a '3.7.1' group here with
					// 'drop_session_visited_urls' (and the deferred legacy uid
					// column/table drops, see upgrade_finalize_uid_id() and
					// convert_uid_table_to_dictionary_ids()), and arm the task
					// from the 3.7.1 block in class-upgrade.php.
				],
			]
		);

		// Dispatch order follows version order. Pro merges its tasks in via
		// the filter: a version key core already has is merged in place, a new
		// key lands at the end of the array — so without sorting a 3.7.0 Pro
		// task would run before a 3.6.3 one and a task that waits on an
		// earlier task (pro_sessions_source_category on
		// pro_referrers_normalization) would deadlock the dispatcher, which
		// only runs the first pending task per iteration.
		uksort( $upgrades, 'version_compare' );

		// Get all upgrades from all versions.
		$all_upgrades = [];
		foreach ( $upgrades as $upgrade_version => $upgrade ) {
			$all_upgrades = array_merge( $all_upgrades, $upgrade );
		}

		if ( $plugin_type === 'all' && $select_version === 'all' ) {
			return $all_upgrades;
		}

		// Handle special selectors for pro and free upgrades.
		if ( $plugin_type === 'pro' ) {
			// Get only pro upgrades - these are determined by filter and will have 'pro_' prefix.
			$pro_upgrades = [];
			foreach ( $all_upgrades as $upgrade ) {
				if ( strpos( $upgrade, 'pro_' ) === 0 ) {
					$pro_upgrades[] = $upgrade;
				}
			}
			return $pro_upgrades;
		}

		if ( $plugin_type === 'free' ) {
			// Get only free upgrades - these don't have 'pro_' prefix.
			$free_upgrades = [];
			foreach ( $all_upgrades as $upgrade ) {
				if ( strpos( $upgrade, 'pro_' ) !== 0 ) {
					$free_upgrades[] = $upgrade;
				}
			}
			return $free_upgrades;
		}

		// Handle version-based selection (original behavior).
		$version_upgrades = [];
		foreach ( $upgrades as $upgrade_version => $upgrade ) {
			if ( version_compare( $upgrade_version, $select_version, '>=' ) ) {
				$version_upgrades = array_merge( $version_upgrades, $upgrade );
			}
		}
		return $version_upgrades;
	}

	/**
	 * Align report table column types with the data they store and drop the
	 * report-index that merely duplicates the PRIMARY KEY. Dates are stored as
	 * 'Y-m-d', send_time as 'HH:MM'; the oversized varchars become native/fitted
	 * types. Repairs malformed values before the strict type conversion so the
	 * ALTER cannot fail on a stray row.
	 */
	private function upgrade_report_table_types(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		$option_name = 'burst_db_upgrade_report_table_types';
		if ( ! get_option( $option_name ) ) {
			return;
		}

		global $wpdb;

		$date_regexp = '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';

		if ( $this->table_exists( 'burst_report_logs' ) && $this->column_exists( 'burst_report_logs', 'date' ) ) {
			// Repair any non-'Y-m-d' value from the row's own timestamp, then
			// convert the column to a native DATE.
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
			$wpdb->query( "UPDATE {$wpdb->prefix}burst_report_logs SET `date` = FROM_UNIXTIME(`time`, '%Y-%m-%d') WHERE `date` NOT REGEXP '$date_regexp'" );
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
			$wpdb->query( "ALTER TABLE {$wpdb->prefix}burst_report_logs MODIFY COLUMN `date` DATE NOT NULL" );
			$this->drop_index( 'burst_report_logs', 'report_id_index' );
		}

		if ( $this->table_exists( 'burst_reports' ) ) {
			if ( $this->column_exists( 'burst_reports', 'fixed_end_date' ) ) {
				// fixed_end_date is empty for non-scheduled reports; move those to
				// NULL before converting the column to a nullable DATE.
                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
				$wpdb->query( "ALTER TABLE {$wpdb->prefix}burst_reports MODIFY COLUMN `fixed_end_date` VARCHAR(16) NULL DEFAULT NULL" );
                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
				$wpdb->query( "UPDATE {$wpdb->prefix}burst_reports SET `fixed_end_date` = NULL WHERE `fixed_end_date` NOT REGEXP '$date_regexp'" );
                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
				$wpdb->query( "ALTER TABLE {$wpdb->prefix}burst_reports MODIFY COLUMN `fixed_end_date` DATE NULL DEFAULT NULL" );
			}

            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
			$wpdb->query( "ALTER TABLE {$wpdb->prefix}burst_reports MODIFY COLUMN `date_range` VARCHAR(32) NOT NULL" );
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
			$wpdb->query( "ALTER TABLE {$wpdb->prefix}burst_reports MODIFY COLUMN `day_of_week` VARCHAR(9) DEFAULT NULL" );
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
			$wpdb->query( "ALTER TABLE {$wpdb->prefix}burst_reports MODIFY COLUMN `send_time` VARCHAR(5) NOT NULL" );

			// ID is the PRIMARY KEY; drop the index that duplicates it.
			$this->drop_index( 'burst_reports', 'id_index' );
		}

		delete_option( $option_name );
	}

	/**
	 * Upgrade bounces
	 */
	private function upgrade_bounces(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}
		if ( ! get_option( 'burst_db_upgrade_bounces' ) ) {
			return;
		}

		global $wpdb;

		$result = $wpdb->query(
			"UPDATE {$wpdb->prefix}burst_statistics
                SET bounce = 0
                WHERE
                  (session_id IN (
                    SELECT session_id
                    FROM (
                      SELECT session_id
                      FROM {$wpdb->prefix}burst_statistics
                      GROUP BY session_id
                      HAVING COUNT(*) >= 2
                    ) as t
                  ))"
		);

		if ( $result === false ) {
			return;
		}

		$result = $wpdb->query(
			"UPDATE {$wpdb->prefix}burst_statistics
                SET bounce = 0
                WHERE bounce = 1 AND time_on_page > 5000"
		);

		// if query is successful.
		if ( $result !== false ) {
			delete_option( 'burst_db_upgrade_bounces' );
		} else {
			self::error_log( 'db upgrade bounces failed' );
		}
	}

	/**
	 * Mark a watermark-batched task complete: delete its task option, its
	 * `_last_id` watermark option and its progress transient. Also used by the
	 * per-task self-heal guards when a task turns out to have nothing to do.
	 */
	protected function complete_watermarked_task( string $slug ): void {
		delete_option( "burst_db_upgrade_{$slug}" );
		delete_option( "burst_db_upgrade_{$slug}_last_id" );
		delete_transient( "burst_progress_{$slug}" );
	}

	/**
	 * Shared mechanics for a watermark-batched upgrade task: read the
	 * `_last_id` watermark, apply the batch-size filter, run one bounded batch
	 * via $run_batch, and either advance the watermark (writing the progress
	 * transient for the dashboard notice) or clean the task up when the
	 * watermark passes MAX(ID) of $watermark_table. Per-task prerequisites and
	 * self-heal guards stay in the task methods; only the batch SQL and an
	 * optional completion step differ per task.
	 *
	 * @param string        $slug                    Task slug, without the burst_db_upgrade_ prefix.
	 * @param string        $watermark_table         Table whose MAX(ID) bounds the watermark (without the WP prefix).
	 * @param string        $batch_filter            Filter name for the per-iteration batch size.
	 * @param int           $batch_size              Default number of ids per iteration.
	 * @param callable      $run_batch               function( int $last_id, int $end_id ): int|false — runs one bounded, idempotent batch.
	 * @param callable|null $on_complete             Runs once when the watermark passes MAX(ID), before cleanup.
	 * @param bool          $schedule_next_iteration Schedule the next burst_upgrade_iteration after an advancing batch — for tasks running outside the free dispatcher loop (the pro iteration), which schedules no follow-up itself.
	 */
	protected function run_watermarked_batch( string $slug, string $watermark_table, string $batch_filter, int $batch_size, callable $run_batch, ?callable $on_complete = null, bool $schedule_next_iteration = false ): void {
		global $wpdb;
		$watermark_option = "burst_db_upgrade_{$slug}_last_id";
        // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.DynamicHooknameFound -- callers pass burst_-prefixed filter names.
		$batch_size = (int) apply_filters( $batch_filter, $batch_size );
		$last_id    = (int) get_option( $watermark_option, 0 );
		$end_id     = $last_id + $batch_size;
		$table_name = $wpdb->prefix . $this->validate_table_name( $watermark_table );
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name validated above.
		$max_id = (int) $wpdb->get_var( "SELECT MAX(ID) FROM {$table_name}" );

		$result = $run_batch( $last_id, $end_id );

		if ( $result === false ) {
			self::error_log( "db upgrade {$slug} failed: " . $wpdb->last_error );
			return;
		}

		if ( $end_id >= $max_id ) {
			if ( null !== $on_complete ) {
				$on_complete();
			}
			$this->complete_watermarked_task( $slug );
			return;
		}

		// Jump the watermark to just before the next existing row instead of
		// advancing blindly by batch size: on tables whose leading IDs were
		// archived away (or that hold large mid-table gaps) a fixed advance
		// burns thousands of empty one-minute iterations before touching a
		// real row — days in which every fast path stays disabled. One
		// indexed MIN() seek per iteration buys skipping any gap in one step.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name validated above.
		$next_id = $wpdb->get_var( $wpdb->prepare( "SELECT MIN(ID) FROM {$table_name} WHERE ID > %d", $end_id ) );
		if ( null === $next_id ) {
			// Nothing beyond this window (rows deleted since MAX(ID) was read).
			if ( null !== $on_complete ) {
				$on_complete();
			}
			$this->complete_watermarked_task( $slug );
			return;
		}
		$watermark = max( $end_id, (int) $next_id - 1 );

		update_option( $watermark_option, $watermark, false );
		// Intermediate progress for the upgrade notice (fraction of this task).
		set_transient( "burst_progress_{$slug}", min( 0.99, $watermark / max( 1, $max_id ) ), HOUR_IN_SECONDS );

		if ( $schedule_next_iteration ) {
			// More batches to go: keep the iteration loop alive. Once free and
			// pro upgrades are done, upgrade() clears this hook again.
			wp_schedule_single_event( time() + MINUTE_IN_SECONDS, 'burst_upgrade_iteration' );
		}
	}

	/**
	 * Seed the uid dictionary (burst_uids) with every historic uid string, so
	 * the later backfill and finalize mappings always find a dictionary row.
	 * Iterates by statistics-ID watermark; INSERT IGNORE makes uids that appear
	 * in multiple windows converge on one row. New hits register themselves via
	 * Tracking::resolve_uid_id() from the moment the new code runs.
	 */
	private function upgrade_seed_uid_dictionary(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}
		if ( ! get_option( 'burst_db_upgrade_seed_uid_dictionary' ) ) {
			return;
		}

		// Nothing to migrate when the legacy uid column is gone (fresh install,
		// or the 3.7.1 drop has run while a stale version option re-armed the
		// pipeline). Gated on the column, not on uid_id_active(): after a
		// rollback the older build writes new uid strings with uid_id 0, and
		// the re-upgrade must seed those even though the indexes already exist.
		if ( ! $this->legacy_uid_column_exists() ) {
			$this->complete_watermarked_task( 'seed_uid_dictionary' );
			return;
		}

		// Table init may not have created the dictionary yet — retry next iteration.
		if ( ! $this->table_exists( 'burst_uids' ) ) {
			return;
		}

		global $wpdb;
		$this->run_watermarked_batch(
			'seed_uid_dictionary',
			'burst_statistics',
			'burst_uid_dictionary_batch_size',
			100000,
			function ( int $last_id, int $end_id ) use ( $wpdb ) {
				return $wpdb->query(
					$wpdb->prepare(
						"INSERT IGNORE INTO {$wpdb->prefix}burst_uids (uid)
						SELECT DISTINCT uid FROM {$wpdb->prefix}burst_statistics
						WHERE ID > %d AND ID <= %d AND uid != ''",
						$last_id,
						$end_id
					)
				);
			},
			function () use ( $wpdb ): void {
				// Cart uids without any hit are an edge case, but register them too
				// so the finalize mapping never orphans a cart row. Pro-only table,
				// checked without validate_table_name to avoid free-tier log noise.
				$cart_table = $wpdb->prefix . 'burst_cart';
				if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $cart_table ) ) ) {
					// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table names.
					$wpdb->query( "INSERT IGNORE INTO {$wpdb->prefix}burst_uids (uid) SELECT DISTINCT uid FROM {$cart_table} WHERE uid != ''" );
				}
			}
		);
	}

	/**
	 * Backfill statistics.uid_id from the dictionary. Iterates by statistics-ID
	 * watermark; the uid_id = 0 condition makes re-runs (and the re-arm from the
	 * finalize verification) cheap and idempotent.
	 */
	private function upgrade_statistics_uid_id(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}
		if ( ! get_option( 'burst_db_upgrade_statistics_uid_id' ) ) {
			return;
		}

		// Dictionary must be complete first; column must exist.
		if ( (bool) get_option( 'burst_db_upgrade_seed_uid_dictionary' ) || ! $this->column_exists( 'burst_statistics', 'uid_id' ) ) {
			return;
		}

		// Legacy uid column gone: nothing to backfill (see the seed task) —
		// waiting on legacy string data would stall the pipeline.
		if ( ! $this->legacy_uid_column_exists() ) {
			$this->complete_watermarked_task( 'statistics_uid_id' );
			return;
		}

		global $wpdb;
		$this->run_watermarked_batch(
			'statistics_uid_id',
			'burst_statistics',
			'burst_statistics_uid_id_batch_size',
			25000,
			function ( int $last_id, int $end_id ) use ( $wpdb ) {
				return $wpdb->query(
					$wpdb->prepare(
						"UPDATE {$wpdb->prefix}burst_statistics s
						JOIN {$wpdb->prefix}burst_uids d ON s.uid = d.uid
						SET s.uid_id = d.ID
						WHERE s.ID > %d AND s.ID <= %d AND s.uid_id = 0",
						$last_id,
						$end_id
					)
				);
			}
		);
	}

	/**
	 * Backfill sessions.start_time (session start) and sessions.uid_id (the
	 * visitor's dictionary id) from the first hit of each session. Runs after
	 * the statistics backfill so uid_id is available on the hits. Iterates by
	 * session-ID watermark so every batch is bounded and idempotent; sessions
	 * without any statistics rows are skipped naturally and keep start_time = 0.
	 */
	private function upgrade_sessions_first_time(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}
		if ( ! get_option( 'burst_db_upgrade_sessions_first_time' ) ) {
			return;
		}

		// Legacy uid column gone: the tables were freshly created (see the seed
		// task) — sessions were then populated with uid_id at creation, so
		// there is nothing to backfill. Gated on the column so a re-upgrade
		// after a rollback still backfills the sessions the older build wrote.
		if ( ! $this->legacy_uid_column_exists() ) {
			$this->complete_watermarked_task( 'sessions_first_time' );
			return;
		}

		// Prerequisites: statistics backfill done, columns present.
		if ( (bool) get_option( 'burst_db_upgrade_statistics_uid_id' )
			|| ! $this->column_exists( 'burst_sessions', 'start_time' )
			|| ! $this->column_exists( 'burst_sessions', 'uid_id' ) ) {
			return;
		}

		global $wpdb;
		$this->run_watermarked_batch(
			'sessions_first_time',
			'burst_sessions',
			'burst_sessions_first_time_batch_size',
			25000,
			function ( int $last_id, int $end_id ) use ( $wpdb ) {
				return $wpdb->query(
					$wpdb->prepare(
						"UPDATE {$wpdb->prefix}burst_sessions s
						JOIN (
							SELECT session_id, MIN(time) AS start_time,
								COALESCE(MIN(NULLIF(uid_id, 0)), 0) AS uid_id
							FROM {$wpdb->prefix}burst_statistics
							WHERE session_id > %d AND session_id <= %d
							GROUP BY session_id
						) st ON st.session_id = s.ID
						SET s.start_time = st.start_time, s.uid_id = st.uid_id
						WHERE s.start_time = 0 OR s.uid_id = 0",
						$last_id,
						$end_id
					)
				);
			}
		);
	}

	/**
	 * Finalize the uid dictionary migration: convert the straggler rows, build
	 * the uid_id indexes (online index operations — the legacy varchar uid
	 * column is left untouched, see uid_id_active(); 3.7.1 drops it), convert
	 * the cart table to uid_id so identity joins stay int = int, and retire the
	 * known_uids crons. Every sub-step is idempotent, so a run that dies
	 * halfway simply continues on the next iteration, and a re-upgrade after a
	 * rollback re-converges on the string data the older build wrote.
	 *
	 * Only ever runs from cron / WP-CLI (upgrade() is never called from a page
	 * request); a run that keeps failing is capped by its retry budget and
	 * backed off to daily, with the error surfaced as a task notice.
	 */
	private function upgrade_finalize_uid_id(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}
		$option_name = 'burst_db_upgrade_finalize_uid_id';
		if ( ! get_option( $option_name ) ) {
			return;
		}

		// All previous pipeline steps must be complete.
		if ( (bool) get_option( 'burst_db_upgrade_seed_uid_dictionary' )
			|| (bool) get_option( 'burst_db_upgrade_statistics_uid_id' )
			|| (bool) get_option( 'burst_db_upgrade_sessions_first_time' ) ) {
			return;
		}

		global $wpdb;
		$stats_table = $wpdb->prefix . 'burst_statistics';

		// Retry budget for the whole step, counted BEFORE the work so a run
		// that is killed mid-way (no last_error to report) still counts. After
		// the budget the step is marked stalled: upgrade() then retries once a
		// day instead of every minute and the task notice shows the error.
		$attempts = (int) get_option( 'burst_db_upgrade_finalize_uid_id_attempts', 0 ) + 1;
		update_option( 'burst_db_upgrade_finalize_uid_id_attempts', $attempts, false );
		if ( $attempts > self::FINALIZE_MAX_ATTEMPTS && empty( $this->stalled_task() ) ) {
			$this->mark_task_stalled( 'finalize_uid_id', $attempts, 'previous attempts did not complete (process terminated?)' );
		}

		// Rows written while the pipeline ran (or restored from an archive, or
		// by an older build after a rollback) can still be unconverted — and a
		// row whose dictionary insert failed on the beacon has no dictionary
		// entry at all, so re-arming the full backfill would rescan the whole
		// table without ever converting it. Seed and convert the (bounded)
		// straggler set directly instead, on every run: the predicate is
		// cheap (uid_id = 0 range on the (uid_id, time) index once it exists)
		// and empty on a converged table.
		if ( $this->legacy_uid_column_exists() ) {
	        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table names.
			$unconverted = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$stats_table} WHERE uid != '' AND uid_id = 0" );
			if ( $unconverted > 0 ) {
				$wpdb->query( "INSERT IGNORE INTO {$wpdb->prefix}burst_uids (uid) SELECT DISTINCT uid FROM {$stats_table} WHERE uid != '' AND uid_id = 0" );
				$wpdb->query( "UPDATE {$stats_table} s JOIN {$wpdb->prefix}burst_uids d ON s.uid = d.uid SET s.uid_id = d.ID WHERE s.uid != '' AND s.uid_id = 0" );
				$unconverted = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$stats_table} WHERE uid != '' AND uid_id = 0" );
			}
	        // phpcs:enable
			if ( $unconverted > 0 ) {
				// Still unconverted after direct seeding: something structural
				// (dictionary table broken, permissions). Retry within the
				// budget, then proceed — those rows lose their identity (uid_id
				// 0), which beats a pipeline that never completes and keeps
				// integer mode, session grain and bitmaps off forever.
				if ( $attempts < self::FINALIZE_MAX_ATTEMPTS ) {
					self::error_log( "db upgrade finalize_uid_id: {$unconverted} rows still unconverted after direct seeding, retrying." );
					return;
				}
				self::error_log( "db upgrade finalize_uid_id: proceeding with {$unconverted} unconverted rows after {$attempts} attempts." );
			}
		}

		if ( ! $this->uid_id_active() ) {
			// The legacy uid indexes only served the string query paths, which
			// stop being used the moment the uid_id indexes exist; dropping
			// them is a metadata change. When the column itself is dropped in
			// 3.7.1, any index still containing it must be dropped first:
			// MySQL's DROP COLUMN silently reduces an index to its remaining
			// columns under the same name — e.g. (time, page_id, uid) shrinking
			// to (time, page_id) — which name-based probes cannot detect.
			$legacy_uid_indexes = [
				'time_uid_index',
				'uid_time_index',
				'time_page_url_uid_index',
				'time_page_id_uid_index',
			];
			foreach ( $legacy_uid_indexes as $index_name ) {
				$this->drop_index( 'burst_statistics', $index_name );
			}

			// Build the uid_id indexes in one ALTER: a single INPLACE, online
			// index build (one scan of the table, reads and writes continue),
			// never a table rebuild — the legacy column is deliberately not
			// modified. uid_id_active() flips on the first of these indexes
			// existing. Index definitions and names come from the shared
			// Database_Helper::uid_id_index_columns() / index_name_for_columns(),
			// the same source the installer uses, so the standalone add_index()
			// calls below no-op. Probe per index: on a resumed run one may
			// still exist, and ADD INDEX on an existing name would abort the
			// whole ALTER. No PHP time limit: this runs in cron / WP-CLI only.
			$add_clauses = [];
			foreach ( $this->uid_id_index_columns() as $index_columns ) {
				$index_name = $this->index_name_for_columns( $index_columns );
				if ( ! $this->index_exists( 'burst_statistics', $index_name ) ) {
					$add_clauses[] = "ADD INDEX {$index_name} (`" . implode( '`, `', array_map( 'sanitize_key', $index_columns ) ) . '`)';
				}
			}
			if ( ! empty( $add_clauses ) ) {
				if ( function_exists( 'set_time_limit' ) ) {
					// phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- some hosts disable it; a failure only shortens the budget.
					@set_time_limit( 0 );
				}
				ignore_user_abort( true );
				// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table name, fixed index definitions.
				$wpdb->query( "ALTER TABLE {$stats_table} " . implode( ', ', $add_clauses ) );
				if ( $wpdb->last_error ) {
					self::error_log( 'db upgrade finalize_uid_id index build failed: ' . $wpdb->last_error );
					if ( $attempts >= self::FINALIZE_MAX_ATTEMPTS ) {
						$this->mark_task_stalled( 'finalize_uid_id', $attempts, $wpdb->last_error );
					}
					return;
				}
			}
			// Integer mode flips with the schema: drop the cached probe so this
			// request and (via the object cache) concurrent ones see it
			// immediately instead of after the cache TTL.
			$this->flush_uid_id_active_cache();
		}

		// Ensure the uid_id indexes exist (same names as the install list);
		// no-ops when they already exist. Kept outside the combined ALTER
		// above for resume-idempotency: a run that previously died after the
		// first index committed skips the branch above (uid_id_active() is
		// already true) and still gets the remaining indexes here.
		foreach ( $this->uid_id_index_columns() as $index_columns ) {
			$this->add_index( 'burst_statistics', $index_columns );
		}

		// With the (time, page_url, uid_id) covering index in place its
		// (time, page_url) prefix is redundant; the installer performs the
		// same drop on later table inits, gated on uid_id_active().
		$this->drop_index( 'burst_statistics', 'time_page_url_index' );

		// known_uids is obsolete once the dictionary is active: first_time_visit
		// is then set at session creation (the dictionary insert is the "first
		// time ever seen" event), so its recalculation crons are unscheduled.
		// The table itself is deliberately NOT dropped in this release: the
		// previous version's ten-minute cron reads and upserts it, so keeping
		// it (stale, unused by this version) lets a rollback run without
		// database errors — the old cron simply resumes maintaining it.
		// @todo 3.7.1: add a task under the 3.7.1 registry group that runs
		// DROP TABLE IF EXISTS {$prefix}burst_known_uids.
		wp_clear_scheduled_hook( 'burst_recalculate_known_uids_cron' );
		wp_clear_scheduled_hook( 'burst_recalculate_first_time_visits_cron' );

		// Backstop for the migration window: sessions created while the
		// pipeline ran got no first_time_visit flag from tracking (a created
		// dictionary row did not mean "new" while the seed was still inserting
		// historic uids). One bounded sweep: a window session is a first visit
		// when its visitor has no hit before the session start — a point probe
		// per window session via the (uid_id, time) index, valid now that the
		// legacy uid column is dropped.
		$migration_started = (int) get_option( 'burst_uid_migration_started' );
		if ( $migration_started > 0 ) {
	        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table names, value prepared.
			$wpdb->query(
				$wpdb->prepare(
					"UPDATE {$wpdb->prefix}burst_sessions s
					SET s.first_time_visit = 1
					WHERE s.start_time >= %d AND s.first_time_visit = 0 AND s.uid_id > 0
					AND NOT EXISTS (
						SELECT 1 FROM {$stats_table} st
						WHERE st.uid_id = s.uid_id AND st.time < s.start_time
					)",
					$migration_started
				)
			);
	        // phpcs:enable
		}
		delete_option( 'burst_uid_migration_started' );
		// Bookkeeping of the removed known-uids recalculation crons.
		delete_option( 'burst_last_known_uids_sync' );
		delete_option( 'burst_last_first_time_visit_update' );

		if ( ! $this->convert_uid_table_to_dictionary_ids( 'burst_cart' ) ) {
			return;
		}

		// Integer-uid mode is NOT activated here: uid_id_active() derives its
		// state from the schema (uid_id indexes present) and flipped the moment
		// the index build above committed. Deleting the task option only marks
		// the pipeline task complete for db_upgrades_complete(); the retry
		// bookkeeping and a stalled marker for this step go with it.
		delete_option( 'burst_db_upgrade_finalize_uid_id_attempts' );
		$this->clear_task_stalled( 'finalize_uid_id' );
		delete_option( $option_name );
	}

	/**
	 * Record that a task spent its retry budget (see stalled_task()).
	 *
	 * @param string $slug     Task slug.
	 * @param int    $attempts Attempts so far.
	 * @param string $error    Last error, for the task notice.
	 */
	private function mark_task_stalled( string $slug, int $attempts, string $error ): void {
		update_option(
			'burst_db_upgrade_stalled',
			[
				'slug'     => $slug,
				'attempts' => $attempts,
				'error'    => $error,
				'time'     => time(),
			],
			false
		);
	}

	/**
	 * Clear the stalled marker once the task completes.
	 *
	 * @param string $slug Task slug.
	 */
	private function clear_task_stalled( string $slug ): void {
		$stalled = $this->stalled_task();
		if ( ( $stalled['slug'] ?? '' ) === $slug ) {
			delete_option( 'burst_db_upgrade_stalled' );
		}
	}

	/**
	 * Seed the page dictionary (burst_page_urls) from historic hits: one row
	 * per distinct page_url, carrying the WP post id (page_id) it belonged to.
	 * Iterates by statistics-ID watermark; INSERT ... ON DUPLICATE makes urls
	 * that appear in multiple windows converge on one row and keeps the
	 * highest known post id. On completion, every post id gets an initial
	 * canonical row (its most recently seen url) — save_post and the weekly
	 * permalink sweep keep those current afterwards.
	 */
	private function upgrade_seed_page_urls(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}
		if ( ! get_option( 'burst_db_upgrade_seed_page_urls' ) ) {
			return;
		}

		// Table init may not have added the new columns yet — retry next iteration.
		if ( ! $this->column_exists( 'burst_page_urls', 'is_canonical' ) ) {
			return;
		}

		global $wpdb;
		$front_id               = (int) get_option( 'page_on_front' );
		$protected              = $this->protected_front_page_paths( $front_id );
		$types                  = $this->archive_page_types();
		$type_placeholders      = implode( ', ', array_fill( 0, count( $types ), '%s' ) );
		$protected_placeholders = implode( ', ', array_fill( 0, count( $protected ), '%s' ) );
		$this->run_watermarked_batch(
			'seed_page_urls',
			'burst_statistics',
			'burst_page_urls_batch_size',
			100000,
			function ( int $last_id, int $end_id ) use ( $wpdb, $front_id, $protected, $types, $type_placeholders, $protected_placeholders ) {
				// The post id per url comes from the hits that carry a real
				// one. Two kinds of stored ids are not: archive hits (their
				// queried object id is a term or user, see
				// archive_page_types()) and the static front page id on any
				// other url (a legacy resolver fallback for unresolved urls).
				// Both count as 0 here, so such a url keeps page_id 0 and its
				// hits get the negative dictionary id in the backfill.
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- placeholder lists built from fixed-length arrays, every value prepared.
				$result = $wpdb->query(
					$wpdb->prepare(
						"INSERT INTO {$wpdb->prefix}burst_page_urls (page_url, page_id)
						SELECT page_url, MAX(GREATEST(IF(
							page_type IN ({$type_placeholders})
							OR ( %d > 0 AND page_id = %d AND page_url NOT IN ({$protected_placeholders}) ),
							0, page_id
						), 0)) FROM {$wpdb->prefix}burst_statistics
						WHERE ID > %d AND ID <= %d AND page_url != '' AND page_type != '404'
						GROUP BY page_url
						ON DUPLICATE KEY UPDATE page_id = GREATEST(page_id, VALUES(page_id))",
						array_merge( $types, [ $front_id, $front_id ], $protected, [ $last_id, $end_id ] )
					)
				);
                // phpcs:enable
				return $result;
			},
			function (): void {
				$this->assign_initial_canonical_page_urls();
			}
		);
	}

	/**
	 * Give every post id in the dictionary that has no canonical row yet one:
	 * its most recently inserted url. save_post and the weekly permalink sweep
	 * refine these with the real permalink afterwards.
	 */
	private function assign_initial_canonical_page_urls(): void {
		global $wpdb;
        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table names, integer id lists.
		$row_ids = $wpdb->get_col(
			"SELECT MAX(d.ID) FROM {$wpdb->prefix}burst_page_urls d
			WHERE d.page_id > 0 AND d.page_id NOT IN (
				SELECT page_id FROM ( SELECT page_id FROM {$wpdb->prefix}burst_page_urls WHERE is_canonical = 1 ) has_canonical
			)
			GROUP BY d.page_id"
		);
		foreach ( array_chunk( array_map( 'intval', $row_ids ), 1000 ) as $chunk ) {
			$id_list = implode( ',', $chunk );
			$wpdb->query( "UPDATE {$wpdb->prefix}burst_page_urls SET is_canonical = 1 WHERE ID IN ({$id_list})" );
		}
        // phpcs:enable
	}

	/**
	 * Rewrite the historic statistics rows that do not fit the page_id key
	 * space (see rewrite_statistics_page_ids_batch()): page_id = 0 rows get
	 * the negative dictionary id of their url so page queries can group on
	 * the integer column without a 0-bucket, archive hits drop their
	 * term/user id, and hits on other urls drop the front page id. Runs
	 * after the dictionary seed; iterates by statistics-ID watermark,
	 * idempotent. 404 rows keep 0 — they are excluded from every page query.
	 */
	private function upgrade_statistics_page_id(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}
		if ( ! get_option( 'burst_db_upgrade_statistics_page_id' ) ) {
			return;
		}

		// Dictionary must be complete first.
		if ( (bool) get_option( 'burst_db_upgrade_seed_page_urls' ) ) {
			return;
		}

		$this->run_watermarked_batch(
			'statistics_page_id',
			'burst_statistics',
			'burst_statistics_page_id_batch_size',
			25000,
			fn( int $last_id, int $end_id ) => $this->rewrite_statistics_page_ids_batch( $last_id, $end_id )
		);
	}

	/**
	 * One watermark batch of the page_id rewrite, shared by the 3.7.0
	 * backfill and the Pro 3.7.0.1 repair: every row gets the post id the
	 * dictionary knows for its url, else the negative dictionary id — the
	 * IF(d.page_id > 0, d.page_id, -d.ID) rule the tracker applies to new
	 * hits (Database_Helper::resolve_page_id()). Rows that need it:
	 *
	 * - page_id <= 0: the historic 0-bucket, and hits that got the negative
	 *   dictionary id while their url's row had no post id yet (during the
	 *   seed, or on a fresh install before the first canonical claim) — the
	 *   row carries the post id now, so they merge into it;
	 * - archive hits with a positive id: their queried object id is a term
	 *   or user, colliding with the post id key space;
	 * - hits on other urls carrying the static front page id: a legacy
	 *   resolver fallback that merges those urls into the homepage.
	 *
	 * 404 rows keep 0 — they are excluded from every page query.
	 *
	 * @param int $last_id Exclusive lower bound of the statistics ID window.
	 * @param int $end_id  Inclusive upper bound.
	 * @return int|false Rows affected, false on a database error.
	 */
	protected function rewrite_statistics_page_ids_batch( int $last_id, int $end_id ): int|false {
		global $wpdb;
		$front_id               = (int) get_option( 'page_on_front' );
		$protected              = $this->protected_front_page_paths( $front_id );
		$types                  = $this->archive_page_types();
		$type_placeholders      = implode( ', ', array_fill( 0, count( $types ), '%s' ) );
		$protected_placeholders = implode( ', ', array_fill( 0, count( $protected ), '%s' ) );

        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- placeholder lists built from fixed-length arrays, every value prepared.
		$result = $wpdb->query(
			$wpdb->prepare(
				"UPDATE {$wpdb->prefix}burst_statistics s
				JOIN {$wpdb->prefix}burst_page_urls d ON s.page_url = d.page_url
				SET s.page_id = IF(d.page_id > 0, d.page_id, -d.ID)
				WHERE s.ID > %d AND s.ID <= %d AND s.page_type != '404'
				AND (
					s.page_id <= 0
					OR s.page_type IN ({$type_placeholders})
					OR ( %d > 0 AND s.page_id = %d AND s.page_url NOT IN ({$protected_placeholders}) )
				)",
				array_merge( [ $last_id, $end_id ], $types, [ $front_id, $front_id ], $protected )
			)
		);
        // phpcs:enable
		return false === $result ? false : (int) $result;
	}

	/**
	 * The url paths that identify the static front page in the dictionary:
	 * "/" and, when it differs (subdirectory installs), the front page's
	 * permalink path. These rows keep their post id whatever hits they
	 * carry: the homepage is also rendered as an archive or search result,
	 * and stray archive-typed hits on "/" must not strip it of its id.
	 *
	 * @param int $front_id The page_on_front post id, 0 when posts show on front.
	 * @return string[]
	 */
	protected function protected_front_page_paths( int $front_id ): array {
		$protected = [ '/' ];
		if ( $front_id > 0 ) {
			$front_path = $this->canonical_page_path( $front_id );
			if ( '' !== $front_path ) {
				$protected[] = $front_path;
			}
		}
		return array_values( array_unique( $protected ) );
	}

	/**
	 * Drop the post ids the original 3.7.0 seed copied onto dictionary rows
	 * that represent no post (the corrected seed in upgrade_seed_page_urls()
	 * no longer writes them), so rewrite_statistics_page_ids_batch() keys
	 * their hits by url (negative dictionary id) instead of merging them
	 * into a post:
	 *
	 * - Archive url rows (a url with archive-typed hits) whose id is a
	 *   term/user id from those hits (the id equals the archive hits' id) or
	 *   that are not the post's canonical url anyway. A canonical row whose
	 *   id came from real post hits (a page that doubles as a post type
	 *   archive) is kept.
	 * - Non-canonical rows carrying the static front page's id: the front
	 *   page has exactly one url, every other row with its id is the legacy
	 *   fallback for an unresolved url.
	 *
	 * The front page's own rows are never touched. Bounded by the archive
	 * hits (page_type index) and the small dictionary, never by a probe per
	 * dictionary row into the hits of popular post urls.
	 */
	protected function reset_polluted_page_dictionary_ids(): void {
		global $wpdb;
		$front_id               = (int) get_option( 'page_on_front' );
		$protected              = $this->protected_front_page_paths( $front_id );
		$types                  = $this->archive_page_types();
		$type_placeholders      = implode( ', ', array_fill( 0, count( $types ), '%s' ) );
		$protected_placeholders = implode( ', ', array_fill( 0, count( $protected ), '%s' ) );

        // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- placeholder lists built from fixed-length arrays, every value prepared.
		$wpdb->query(
			$wpdb->prepare(
				"UPDATE {$wpdb->prefix}burst_page_urls d
				JOIN (
					SELECT page_url, MAX(page_id) AS archive_page_id FROM {$wpdb->prefix}burst_statistics
					WHERE page_type IN ({$type_placeholders})
					GROUP BY page_url
				) a ON a.page_url = d.page_url
				SET d.page_id = 0, d.is_canonical = 0
				WHERE d.page_id > 0 AND d.page_url NOT IN ({$protected_placeholders})
				AND ( d.is_canonical = 0 OR d.page_id = a.archive_page_id )",
				array_merge( $types, $protected )
			)
		);

		if ( $front_id > 0 ) {
			$wpdb->query(
				$wpdb->prepare(
					"UPDATE {$wpdb->prefix}burst_page_urls
					SET page_id = 0, is_canonical = 0
					WHERE page_id = %d AND is_canonical = 0 AND page_url NOT IN ({$protected_placeholders})",
					array_merge( [ $front_id ], $protected )
				)
			);
		}
        // phpcs:enable
	}

	/**
	 * Convert a visitor-keyed table's uid column from uid strings to dictionary
	 * ids. Rows whose uid never produced a dictionary entry cannot be mapped
	 * and are removed. Idempotent: skips tables that are absent or already
	 * converted.
	 *
	 * @param string $table Table name without the WordPress prefix.
	 * @return bool True when the table is absent or converted successfully.
	 */
	private function convert_uid_table_to_dictionary_ids( string $table ): bool {
		global $wpdb;
		$table_name = $wpdb->prefix . $table;

		if ( ! $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table_name ) ) ) {
			return true;
		}

        // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table names.
		$columns = $wpdb->get_col( "DESC {$table_name}" );
		if ( ! in_array( 'uid', $columns, true ) ) {
			// No legacy uid column: fresh install or already converted.
			return true;
		}

		// The uid_id column ships in the table schema; ensure it exists in case
		// the table init has not re-run yet on this blog.
		if ( ! in_array( 'uid_id', $columns, true ) ) {
			$wpdb->query( "ALTER TABLE {$table_name} ADD COLUMN `uid_id` int unsigned NOT NULL DEFAULT 0" );
		}

		// Rows whose uid never appeared in the dictionary (no hit and not
		// registered by the seed) cannot be mapped to an identity — drop them.
		// Rows written since the 3.7.0 table init carry the dictionary id and
		// an empty uid, so they never match this sweep and the UPDATE below
		// leaves them alone — which also makes a resumed or repeated run
		// harmless, so no "already converted" marker is needed.
		//
		// The legacy column itself is left untouched: making it nullable
		// would be a full table rebuild for a signal nobody reads any more
		// (the cart write paths gate on tracking_schema_current()), and a
		// rollback to the previous release finds the column exactly as it
		// left it. The legacy uid indexes stay with the column.
		// @todo 3.7.1: drop the legacy `uid` column and its indexes here for
		// real (uid_index, uid_updated_at_converted_index — drop the indexes
		// BEFORE the column: DROP COLUMN silently shrinks an index to its
		// remaining columns under the same name).
		$wpdb->query( "DELETE t FROM {$table_name} t LEFT JOIN {$wpdb->prefix}burst_uids d ON t.uid = d.uid WHERE t.uid != '' AND d.ID IS NULL" );
		$wpdb->query( "UPDATE {$table_name} t JOIN {$wpdb->prefix}burst_uids d ON t.uid = d.uid SET t.uid_id = d.ID WHERE t.uid_id = 0" );
        // phpcs:enable
		if ( $wpdb->last_error ) {
			self::error_log( "db upgrade finalize_uid_id: converting {$table} failed: " . $wpdb->last_error );
			return false;
		}

		return true;
	}

	/**
	 * Drop the unused first_visited_url / last_visited_url columns from the
	 * sessions table. They were written on every session create/update but
	 * never read back: entry and exit pages are derived from burst_statistics
	 * (MIN/MAX ID per session), so the two TEXT columns only added row weight.
	 * Tracking stopped writing them in 3.7.0; dbDelta never drops columns,
	 * hence this one-time ALTER.
	 *
	 * Currently dormant: not registered in get_db_upgrades() and not armed by
	 * any upgrade block — the drop is deferred one release so a rollback to
	 * the pre-3.7.0 version (which writes these columns) hits no database
	 * errors.
	 *
	 * @todo 3.7.1: re-register this task under the 3.7.1 registry group and
	 * arm it from the 3.7.1 block in class-upgrade.php.
	 */
	private function upgrade_drop_session_visited_urls(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}
		$option_name = 'burst_db_upgrade_drop_session_visited_urls';
		if ( ! get_option( $option_name ) ) {
			return;
		}

		// Drop only what is present: fresh installs already have the new
		// schema, and a resumed run may have dropped one column already.
		$drops = [];
		foreach ( [ 'first_visited_url', 'last_visited_url' ] as $column ) {
			if ( $this->column_exists( 'burst_sessions', $column ) ) {
				$drops[] = "DROP COLUMN `{$column}`";
			}
		}
		if ( empty( $drops ) ) {
			delete_option( $option_name );
			return;
		}

		global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared -- fixed table and column names.
		$result = $wpdb->query( "ALTER TABLE {$wpdb->prefix}burst_sessions " . implode( ', ', $drops ) );

		if ( $result !== false ) {
			delete_option( $option_name );
		} else {
			self::error_log( 'db upgrade drop_session_visited_urls failed: ' . $wpdb->last_error );
		}
	}

	/**
	 * Drop event and action columns from the goals table
	 */
	private function upgrade_goals_remove_columns(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}
		if ( ! get_option( 'burst_db_upgrade_goals_remove_columns' ) ) {
			return;
		}

		global $wpdb;
		// check if columns exist first.
		$columns = $wpdb->get_col( "DESC {$wpdb->prefix}burst_goals", 0 );
		if ( ! in_array( 'event', $columns, true ) || ! in_array( 'action', $columns, true ) ) {
			delete_option( 'burst_db_upgrade_goals_remove_columns' );
			return;
		}

		// run an sql query to remove the columns `event` and `action`.
		$remove = $wpdb->query(
			"ALTER TABLE {$wpdb->prefix}burst_goals
                DROP COLUMN `event`,
                DROP COLUMN `action`"
		);

		if ( $remove !== false ) {
			delete_option( 'burst_db_upgrade_goals_remove_columns' );
		}
	}

	/**
	 * Set the conversion metric to pageviews for all goals.
	 */
	private function upgrade_goals_set_conversion_metric(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}
		$option_name = 'burst_db_upgrade_goals_set_conversion_metric';
		if ( ! get_option( $option_name ) ) {
			return;
		}

		global $wpdb;
		// set conversion_metric to 'pageviews' for all goals.
		$add_conversion_metric = $wpdb->query(
			"UPDATE {$wpdb->prefix}burst_goals
                SET conversion_metric = 'pageviews'
                WHERE conversion_metric IS NULL OR conversion_metric = ''"
		);

		if ( $add_conversion_metric !== false ) {
			delete_option( $option_name );
		}
	}

	/**
	 * Drop the user agent column from the statistics table
	 */
	private function upgrade_drop_user_agent(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		$option_name = 'burst_db_upgrade_drop_user_agent';
		if ( ! get_option( $option_name ) ) {
			return;
		}

		global $wpdb;
		// check if columns exist first.
		$columns = $wpdb->get_col( "DESC {$wpdb->prefix}burst_statistics", 0 );
		if ( ! in_array( 'user_agent', $columns, true ) ) {
			delete_option( 'burst_db_upgrade_drop_user_agent' );
			return;
		}

		// drop user_agent column.
		$drop_user_agent = $wpdb->query( "ALTER TABLE {$wpdb->prefix}burst_statistics DROP COLUMN `user_agent`" );

		if ( $drop_user_agent !== false ) {
			delete_option( $option_name );
		}
	}

	/**
	 * Drop the page_id column from the statistics table
	 */
	private function upgrade_empty_referrer_when_current_domain(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}
		$option_name = 'burst_db_upgrade_empty_referrer_when_current_domain';
		if ( ! get_option( $option_name ) ) {
			return;
		}

		global $wpdb;
		$home_url = home_url();
		// empty referrer when starts with current domain.
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $home_url is sanitized by home_url().
		$empty_referrer_when_current_domain = $wpdb->query( "UPDATE {$wpdb->prefix}burst_statistics SET referrer = null WHERE referrer LIKE '$home_url%'" );

		if ( $empty_referrer_when_current_domain !== false ) {
			delete_option( $option_name );
		}
	}

	/**
	 * Drop the page_id column from the statistics table
	 */
	private function upgrade_strip_domain_names_from_entire_page_url(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}
		$option_name = 'burst_db_upgrade_strip_domain_names_from_entire_page_url';
		if ( ! get_option( $option_name ) ) {
			return;
		}

		if ( ! $this->column_exists( 'burst_statistics', 'entire_page_url' ) ) {
			delete_option( $option_name );
			return;
		}

		global $wpdb;
		// make sure it does not end with slash.
		$home_url = untrailingslashit( home_url() );

		// strip home url from entire_page_url where it starts with home_url.
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $home_url is sanitized by home_url().
		$strip_domain_names_from_entire_page_url = $wpdb->query( "UPDATE {$wpdb->prefix}burst_statistics SET entire_page_url = REPLACE(entire_page_url, '$home_url', '') WHERE entire_page_url LIKE '$home_url%'" );
		if ( $strip_domain_names_from_entire_page_url !== false ) {
			delete_option( $option_name );
		}
	}

	/**
	 * Upgrade statistics table to use lookup tables instead.
	 */
	private function create_lookup_tables(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}
		global $wpdb;
		$items = [ 'device', 'browser', 'browser_version', 'platform' ];
		// check if required tables exists.
		$selected_item = false;
		foreach ( $items as $item ) {
			$table = $item . 's';
			// check if table exists.
			if ( ! $this->table_exists( 'burst_' . $table ) ) {
				return;
			}

			// check if this table already was upgraded.
			if ( ! get_option( "burst_db_upgrade_create_lookup_tables_$item" ) ) {
				continue;
			}

			$selected_item = $item;
			break;
		}

		if ( $selected_item ) {
			// check if the $selected_item column exists in the wp_burst_statistics table.
			if ( ! $this->column_exists( 'burst_statistics', $selected_item ) ) {
				// already dropped, so mark this one as completed.
				delete_option( "burst_db_upgrade_create_lookup_tables_$selected_item" );

				// if all other lookup tables also have been dropped, stop all upgrades, as there's nothing to upgrade.
				if (
					! get_option( 'burst_db_upgrade_upgrade_lookup_tables_browser' ) &&
					! get_option( 'burst_db_upgrade_upgrade_lookup_tables_browser_version' ) &&
					! get_option( 'burst_db_upgrade_upgrade_lookup_tables_platform' ) &&
					! get_option( 'burst_db_upgrade_upgrade_lookup_tables_device' )
				) {
					delete_option( 'burst_db_upgrade_create_lookup_tables' );
					delete_option( 'burst_db_upgrade_init_lookup_ids' );
					delete_option( 'burst_db_upgrade_upgrade_lookup_tables' );
					delete_option( 'burst_db_upgrade_upgrade_lookup_tables_drop_columns' );
				}
				return;
			}
			$wpdb->query(
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $selected_item is selected from a predefined array.
				"INSERT INTO {$wpdb->prefix}burst_{$selected_item}s (name) SELECT DISTINCT $selected_item FROM {$wpdb->prefix}burst_statistics WHERE $selected_item IS NOT NULL AND $selected_item NOT IN (SELECT name FROM {$wpdb->prefix}burst_{$selected_item}s);"
			);
			delete_option( "burst_db_upgrade_create_lookup_tables_$selected_item" );
		}

		// check if all items have been created.
		$missing_items = [];
		foreach ( $items as $item ) {
			// check if table is updated with data yet.
			if ( ! get_option( "burst_db_upgrade_create_lookup_tables_$item" ) ) {
				continue;
			}
			$missing_items[] = $item;
		}

		// stop upgrading if all have been completed.
		if ( count( $missing_items ) === 0 ) {
			delete_option( 'burst_db_upgrade_create_lookup_tables' );
		}
	}

	/**
	 * To reliably be able to check if the upgrade is completed, we set an initial bogus value for the lookup id's.
	 */
	private function initialize_lookup_ids(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		// only start if the lookup tables have been created.
		if ( get_option( 'burst_db_upgrade_create_lookup_tables' ) ) {
			return;
		}

		if ( ! get_option( 'burst_db_upgrade_upgrade_lookup_tables' ) ) {
			return;
		}

		global $wpdb;
		$wpdb->query(
			"UPDATE {$wpdb->prefix}burst_statistics SET
                           browser_id = 999999,
                           browser_version_id = 999999,
                           platform_id = 999999,
                           device_id = 999999"
		);

		delete_option( 'burst_db_upgrade_init_lookup_ids' );
	}

	/**
	 * Upgrade existing table to load id's from lookup tables
	 */
	private function upgrade_lookup_tables(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		// only start if the lookup tables have been created.
		if ( get_option( 'burst_db_upgrade_create_lookup_tables' ) ) {
			return;
		}

		if ( get_option( 'burst_db_upgrade_init_lookup_ids' ) ) {
			return;
		}

		if ( ! get_option( 'burst_db_upgrade_upgrade_lookup_tables' ) ) {
			return;
		}

		global $wpdb;
		// check if required tables exists.
		$items         = [ 'browser', 'browser_version', 'device', 'platform' ];
		$selected_item = false;
		foreach ( $items as $item ) {
			$table = $item . 's';
			// check if table exists. If not, start the create upgrade again.
			if ( ! $this->table_exists( 'burst_' . $table ) ) {
				$this->arm_db_upgrade( "create_lookup_tables_$item" );
				$this->arm_db_upgrade( 'create_lookup_tables' );
				return;
			}

			// check if this table contains data.
			// if not, ensure that the update for this table is started again.
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $item is selected from a predefined array.
			$count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_{$item}s" );
			if ( 0 === $count ) {
				$this->arm_db_upgrade( "create_lookup_tables_$item" );
				$this->arm_db_upgrade( 'create_lookup_tables' );
				return;
			}

			// check if this table already was upgraded.
			if ( ! get_option( "burst_db_upgrade_upgrade_lookup_tables_$item" ) ) {
				continue;
			}

			// check if column exists.
			$columns = $wpdb->get_col( "DESC {$wpdb->prefix}burst_statistics" );
			if ( ! in_array( $item . '_id', $columns, true ) ) {
				// already dropped, so mark this one as completed.
				delete_option( "burst_db_upgrade_upgrade_lookup_tables_$item" );
				continue;
			}
			$selected_item = $item;
		}

		// we have lookup tables with values. Now we can upgrade the statistics table.
		if ( $selected_item ) {
			$batch         = $this->batch;
			$selected_item = $this->sanitize_lookup_table_type( $selected_item );
			$start         = microtime( true );
			// check what's still to do.
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared	 -- $selected_item is selected from a predefined array.
			$remaining_count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_statistics where {$selected_item}_id = 999999" );
			$total_count     = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_statistics" );
			$done_count      = $total_count - $remaining_count;

			// store progress for $selected_item, to show it in the progress notice.
			$progress = 0 === $total_count ? 1 : $done_count / $total_count;
			$progress = round( $progress, 2 );

			if ( ! $this->column_exists( 'burst_statistics', $selected_item ) ) {
				// already dropped, so mark this one as completed.
				delete_option( "burst_db_upgrade_upgrade_lookup_tables_$selected_item" );
				return;
			}

			set_transient( "burst_progress_upgrade_lookup_tables_$selected_item", $progress, HOUR_IN_SECONDS );
			// measure time elapsed during query.
			if ( $done_count < $total_count ) {
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $selected_item is selected from a predefined array.
				$wpdb->query(
					"UPDATE {$wpdb->prefix}burst_statistics AS t
                    JOIN (
                        SELECT p.{$selected_item}, p.ID, COALESCE(m.ID, 0) as {$selected_item}_id
                        FROM {$wpdb->prefix}burst_statistics p
                        LEFT JOIN {$wpdb->prefix}burst_{$selected_item}s m ON p.{$selected_item} = m.name
                        WHERE p.{$selected_item}_id = 999999
                        LIMIT $batch
                    ) AS s ON t.ID = s.ID
                    SET t.{$selected_item}_id = s.{$selected_item}_id;"
				);
                // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$end               = microtime( true );
				$time_elapsed_secs = $end - $start;
			} else {
				// completed upgrade.
				delete_option( "burst_db_upgrade_upgrade_lookup_tables_$selected_item" );
				delete_transient( "burst_progress_upgrade_lookup_tables_$selected_item" );
			}
		}

		// check if all items have been upgraded.
		$total_not_completed = 0;
		foreach ( $items as $item ) {
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $item is selected from a predefined array.
			$count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_statistics WHERE {$item}_id = 999999 " );
			if ( 0 === $count ) {
				delete_option( "burst_db_upgrade_upgrade_lookup_tables_$item" );
				delete_transient( "burst_progress_upgrade_lookup_tables_$item" );
			}
			$total_not_completed += $count;
		}

		// stop upgrading if all have been completed.
		if ( 0 === $total_not_completed ) {
			delete_option( 'burst_db_upgrade_upgrade_lookup_tables' );
		}
	}

	/**
	 * Upgrade the database to use page_ids for pages.
	 */
	private function upgrade_add_page_ids(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		// check if required upgrade has been completed.
		if ( ! get_option( 'burst_db_upgrade_add_page_ids' ) ) {
			return;
		}

		// check if the columsn page_id and page_type are created.
		if ( ! $this->column_exists( 'burst_statistics', 'page_id' ) || ! $this->column_exists( 'burst_statistics', 'page_type' ) ) {
			return;
		}

		// get all posts of type post or page that do not have the meta yet.
		$post_types = apply_filters( 'burst_column_post_types', get_post_types( [ 'public' => true ] ) );
		$posts      = get_posts(
			[
				'post_type'   => $post_types,
				'post_status' => 'publish',
				'numberposts' => 5,
                //phpcs:ignore
				'meta_query'  => [
					[
						'key'     => 'burst_page_id_upgraded',
						'compare' => 'NOT EXISTS',
					],
				],
			]
		);

		global $wpdb;
		$post_types   = array_values( $post_types );
		$placeholders = implode( ',', array_fill( 0, count( $post_types ), '%s' ) );
		$sql          = "SELECT COUNT(*) FROM {$wpdb->posts}
                 WHERE post_type IN ($placeholders)
                 AND post_status != 'trash'
                 AND ID NOT IN (
                     SELECT post_id FROM {$wpdb->postmeta}
                     WHERE meta_key = 'burst_page_id_upgraded')";
		// dynamic placeholder insertion with array_fill.
        //phpcs:ignore
        $sql =$wpdb->prepare($sql, ...$post_types);
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $post_types are sanitized post types.
		$total_count = (int) $wpdb->get_var( $sql );
		$done_count  = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key = 'burst_page_id_upgraded'" );

		// store progress for $selected_item, to show it in the progress notice.
		$progress = 0 === $total_count ? 1 : $done_count / $total_count;
		$progress = round( $progress, 2 );
		set_transient( 'burst_progress_add_page_ids', $progress, HOUR_IN_SECONDS );
		if ( count( $posts ) === 0 || $total_count === 0 ) {
			delete_option( 'burst_db_upgrade_add_page_ids' );
			delete_post_meta_by_key( 'burst_page_id_upgraded' );
		}
		$permalink_structure = get_option( 'permalink_structure' );
		$is_plain_permalinks = empty( $permalink_structure );
		if ( ! empty( $posts ) ) {
			foreach ( $posts as $post ) {
				update_post_meta( $post->ID, 'burst_page_id_upgraded', 1 );
				$post_id   = $post->ID;
				$page_url  = get_permalink( $post_id );
				$post_type = get_post_type( $post_id );
				// Strip home_url from page_url.
				$page_url = str_replace( home_url(), '', $page_url );
				// plain permalinks.
				if ( $is_plain_permalinks ) {
					$param_key = ( $post_type === 'page' ) ? "page_id=$post_id" : "p=$post_id";
					$wpdb->query(
						$wpdb->prepare(
							"UPDATE {$wpdb->prefix}burst_statistics
                             SET page_id = %d, page_type = %s
                             WHERE page_url='/' AND parameters LIKE %s",
							$post_id,
							$post_type,
							$wpdb->esc_like( $param_key ) . '%'
						)
					);
				} else {
					$wpdb->query(
						$wpdb->prepare(
							"UPDATE {$wpdb->prefix}burst_statistics
                         SET page_id = %d, page_type = %s
                         WHERE page_url = %s",
							$post_id,
							$post_type,
							$page_url,
						)
					);
				}
			}
		}
	}

	/**
	 * Drop the columns that are now obsolete and moved to the lookup tables.
	 */
	private function upgrade_lookup_tables_drop_columns(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		// check if required upgrade has been completed.
		if ( get_option( 'burst_db_upgrade_upgrade_lookup_tables' ) ) {
			return;
		}

		global $wpdb;
		$drop_columns = [ 'browser', 'browser_version', 'device_resolution', 'device', 'platform' ];

		// check if columns exist first.
		$columns    = $wpdb->get_col( "DESC {$wpdb->prefix}burst_statistics", 0 );
		$drop_array = [];
		foreach ( $drop_columns as $drop_column ) {
			if ( get_option( "burst_db_upgrade_upgrade_lookup_tables_$drop_column" ) ) {
				continue;
			}
			if ( in_array( $drop_column, $columns, true ) ) {
				$drop_array[] = "DROP COLUMN `$drop_column`";
			}
		}

		$drop_sql = implode( ', ', $drop_array );
		$sql      = "ALTER TABLE {$wpdb->prefix}burst_statistics $drop_sql";
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $drop_sql is built from validated column names.
		$success = $wpdb->query( $sql );

		// check if all columns have been dropped.
		if ( $success ) {
			$completed = true;
			foreach ( $drop_columns as $drop_column ) {
				if ( in_array( $drop_column, $columns, true ) ) {
					$completed = false;
				}
			}
			if ( $completed ) {
				delete_option( 'burst_db_upgrade_upgrade_lookup_tables_drop_columns' );
			}
		}
	}


	/**
	 * Drop the page_id column from the statistics table.
	 */
	private function upgrade_drop_page_id_column(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}
		if ( ! get_option( 'burst_db_upgrade_drop_page_id_column' ) ) {
			return;
		}

		global $wpdb;
		// check if columns exist first.
		$columns = $wpdb->get_col( "DESC {$wpdb->prefix}burst_statistics", 0 );
		if ( ! in_array( 'page_id', $columns, true ) ) {
			delete_option( 'burst_db_upgrade_drop_page_id_column' );
			return;
		}

		// run an sql query to remove the columns `event` and `action`.
		$remove = $wpdb->query( "ALTER TABLE {$wpdb->prefix}burst_statistics DROP COLUMN `page_id`" );

		if ( $remove !== false ) {
			delete_option( 'burst_db_upgrade_drop_page_id_column' );
		}
	}

	/**
	 * Update the entire_page_url column to the new name, paramaters, and change to TEXT
	 */
	public function change_column_name_entire_page_url(): void {
		global $wpdb;
		$wpdb->query( "ALTER TABLE {$wpdb->prefix}burst_statistics MODIFY parameters TEXT;" );
		delete_option( 'burst_db_upgrade_rename_entire_page_url_column' );
	}

	/**
	 * Drop the path from the parameters column.
	 */
	public function drop_path_from_parameters_column(): void {
		// check if column already upgraded.
		if ( ! get_option( 'burst_db_upgrade_drop_path_from_parameters_column' ) ) {
			return;
		}

		if ( ! $this->column_exists( 'burst_statistics', 'entire_page_url' ) ) {
			delete_option( 'burst_db_upgrade_drop_path_from_parameters_column' );
			delete_option( 'burst_db_upgrade_column_offset' );
			delete_transient( 'burst_progress_drop_path_from_parameters_column' );
			return;
		}

		global $wpdb;
		$batch_size = 50000;
		$offset     = (int) get_option( 'burst_db_upgrade_column_offset', 0 );
		$sql        = "UPDATE {$wpdb->prefix}burst_statistics
                SET `parameters` = IF(LOCATE('?', `entire_page_url`) > 0, SUBSTRING(`entire_page_url`, LOCATE('?', `entire_page_url`)), '')
                WHERE ID IN (
                    SELECT ID FROM (
                        SELECT id FROM {$wpdb->prefix}burst_statistics LIMIT $offset, $batch_size
                    ) AS temp
                );";
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $offset and $batch_size are validated integers.
		$wpdb->query( $sql );
		$offset += $batch_size;
		update_option( 'burst_db_upgrade_column_offset', $offset );
		$total    = $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_statistics" );
		$progress = $total > 0 ? round( $offset / $total, 2 ) : 1;
		set_transient( 'burst_progress_drop_path_from_parameters_column', $progress, HOUR_IN_SECONDS );

		if ( $offset >= $total ) {
			$wpdb->query( "ALTER TABLE {$wpdb->prefix}burst_statistics DROP COLUMN entire_page_url" );
			delete_option( 'burst_db_upgrade_column_offset' );
			delete_option( 'burst_db_upgrade_drop_path_from_parameters_column' );
			delete_transient( 'burst_progress_drop_path_from_parameters_column' );
		}
	}

	/**
	 * Upgrade referrer column to normalized format in batches
	 */
	private function upgrade_referrers(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		if ( ! get_option( 'burst_db_upgrade_move_referrers_to_sessions' ) ) {
			return;
		}

		global $wpdb;
		// Check if both tables exist.
		if ( ! $this->table_exists( 'burst_statistics' ) || ! $this->table_exists( 'burst_sessions' ) ) {
			self::error_log( 'Missing tables, delay referrer upgrade until tables have upgraded.' );
			return;
		}

		// check if column exists.
		if ( ! $this->column_exists( 'burst_sessions', 'referrer' ) ) {
			self::error_log( 'Referrer column does not exist in sessions table, delay referrer upgrade until tables have upgraded.' );
			return;
		}

		$batch = $this->batch;
		$start = microtime( true );

		// Count remaining sessions to process (where referrer is NULL = not yet migrated).
		$remaining_count = (int) $wpdb->get_var(
			"SELECT COUNT(DISTINCT s.ID)
        FROM {$wpdb->prefix}burst_sessions s
        INNER JOIN {$wpdb->prefix}burst_statistics st ON st.session_id = s.ID
        WHERE s.referrer IS NULL"
		);

		$total_count = (int) $wpdb->get_var(
			"SELECT COUNT(DISTINCT s.ID)
        FROM {$wpdb->prefix}burst_sessions s
        INNER JOIN {$wpdb->prefix}burst_statistics st ON st.session_id = s.ID"
		);

		$done_count = $total_count - $remaining_count;

		// Calculate and store progress.
		$progress = 0 === $total_count ? 1 : $done_count / $total_count;
		$progress = round( $progress, 2 );
		set_transient( 'burst_progress_move_referrers_to_sessions', $progress, HOUR_IN_SECONDS );

		if ( $remaining_count > 0 ) {
			// STEP 1: Get batch of session IDs to process.
			$session_ids = $wpdb->get_col(
				$wpdb->prepare(
					"SELECT DISTINCT s.ID
                FROM {$wpdb->prefix}burst_sessions s
                WHERE s.referrer IS NULL
                LIMIT %d",
					$batch
				)
			);

			if ( empty( $session_ids ) ) {
				return;
			}

			$session_ids_placeholder = implode( ',', array_fill( 0, count( $session_ids ), '%d' ) );

			// STEP 2: Update sessions with normalized referrers from the earliest pageview.
            // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared	 -- $session_ids are sanitized integers.
			$sql = $wpdb->prepare(
				"UPDATE {$wpdb->prefix}burst_sessions s
            INNER JOIN (
                SELECT
                    st.session_id,
                    CASE
                        WHEN st.referrer = '' OR st.referrer IS NULL THEN ''
                        ELSE TRIM(LEADING 'www.' FROM SUBSTRING_INDEX(SUBSTRING_INDEX(st.referrer, '://', -1), '/', 1))
                    END as normalized_referrer
                FROM {$wpdb->prefix}burst_statistics st
                INNER JOIN (
                    SELECT session_id, MIN(time) as first_time
                    FROM {$wpdb->prefix}burst_statistics
                    WHERE session_id IN ({$session_ids_placeholder})
                    GROUP BY session_id
                ) earliest ON st.session_id = earliest.session_id AND st.time = earliest.first_time
            ) as first_stats ON s.ID = first_stats.session_id
            SET s.referrer = first_stats.normalized_referrer
            WHERE s.referrer IS NULL",             // phpcs:ignore
				...$session_ids
			);
            // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared

            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $session_ids are sanitized integers.
			$wpdb->query( $sql );
		} else {
			self::error_log( 'All referrers processed, cleaning up.' );
			delete_option( 'burst_db_upgrade_move_referrers_to_sessions' );
			delete_transient( 'burst_progress_move_referrers_to_sessions' );

			// to do next release..
            // phpcs:ignore
			// $wpdb->query( "ALTER TABLE {$wpdb->prefix}burst_statistics DROP COLUMN referrer" );
		}
	}


	/**
	 * Upgrade referrer column to normalized format in batches
	 */
	private function fix_trailing_slash_on_referrers(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		if ( ! get_option( 'burst_db_upgrade_fix_trailing_slash_on_referrers' ) ) {
			return;
		}

		global $wpdb;
		$timestamp = 1734739200;

		$last_id = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT MIN(ID) FROM {$wpdb->prefix}burst_statistics WHERE time >= %d",
				$timestamp
			)
		);

		if ( ! empty( $last_id ) ) {
			$wpdb->query(
				$wpdb->prepare(
					"UPDATE {$wpdb->prefix}burst_sessions
                SET referrer = TRIM(TRAILING '/' FROM referrer)
                WHERE ID >= %d
                  AND referrer IS NOT NULL
                  AND referrer != ''
                  AND referrer LIKE %s",
					$last_id,
					'%/'
				)
			);
		}

		delete_option( 'burst_db_upgrade_fix_trailing_slash_on_referrers' );
	}

	/**
	 * Move browser_id, browser_version_id, platform_id, device_id,
	 * first_time_visit, bounce from statistics to sessions table.
	 */
	private function upgrade_move_columns_to_sessions(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}
		global $wpdb;

		if ( ! $this->table_exists( 'burst_statistics' ) || ! $this->table_exists( 'burst_sessions' ) ) {
			self::error_log( 'Missing tables, delaying move_columns_to_sessions upgrade.' );
			return;
		}

		if ( ! $this->column_exists( 'burst_sessions', 'browser_id' ) ) {
			self::error_log( 'browser_id column missing from sessions table, delaying upgrade.' );
			return;
		}

		if ( ! $this->column_exists( 'burst_statistics', 'browser_id' ) ) {
			delete_option( 'burst_db_upgrade_move_columns_to_sessions' );
			delete_transient( 'burst_progress_move_columns_to_sessions' );
			return;
		}

		if ( ! get_option( 'burst_db_upgrade_move_columns_to_sessions' ) ) {
			$this->arm_db_upgrade( 'move_columns_to_sessions' );
		}

		$batch = $this->batch;

		$remaining_count = (int) $wpdb->get_var(
			"SELECT COUNT(*)
			FROM {$wpdb->prefix}burst_statistics
			WHERE browser_id != 9999"
		);

		$total_count = (int) $wpdb->get_var(
			"SELECT COUNT(*)
        	FROM {$wpdb->prefix}burst_statistics"
		);

		$done_count = max( 0, $total_count - $remaining_count );
		$progress   = 0 === $total_count ? 1 : $done_count / $total_count;
		$progress   = round( $progress, 2 );
		set_transient( 'burst_progress_move_columns_to_sessions', $progress, HOUR_IN_SECONDS );

		if ( $remaining_count > 0 ) {
			$wpdb->query(
				$wpdb->prepare(
					"CREATE TEMPORARY TABLE IF NOT EXISTS burst_batch_ids AS
					SELECT ID, session_id
					FROM {$wpdb->prefix}burst_statistics
					WHERE browser_id != 9999
					ORDER BY ID
					LIMIT %d",
					$batch
				)
			);

			// Step 1: Materialize session aggregates into a temp table.
			// burst_batch_ids is only referenced once here, avoiding the
			// "Can't reopen table" MySQL limitation on temporary tables.
			$wpdb->query(
				"CREATE TEMPORARY TABLE IF NOT EXISTS burst_session_data AS
				SELECT
					st.session_id,
					MIN(CASE WHEN st.browser_id != 9999 THEN st.browser_id END)                    AS browser_id,
					MIN(CASE WHEN st.browser_id != 9999 THEN st.browser_version_id END)            AS browser_version_id,
					MIN(CASE WHEN st.browser_id != 9999 THEN st.platform_id END)                   AS platform_id,
					MIN(CASE WHEN st.browser_id != 9999 THEN st.device_id END)                     AS device_id,
					COALESCE(MIN(CASE WHEN st.browser_id != 9999 THEN st.first_time_visit END), 0) AS first_time_visit,
					CASE WHEN COUNT(st.ID) > 1 THEN 0 ELSE MAX(st.bounce) END                      AS bounce
				FROM {$wpdb->prefix}burst_statistics st
				INNER JOIN burst_batch_ids b ON st.session_id = b.session_id
				GROUP BY st.session_id"
			);

			// Step 2: Update sessions using the materialized temp table.
			// burst_session_data is a separate temp table, no double reference.
			$wpdb->query(
				"UPDATE {$wpdb->prefix}burst_sessions s
				INNER JOIN burst_session_data sd ON s.ID = sd.session_id
				SET
					s.browser_id         = sd.browser_id,
					s.browser_version_id = sd.browser_version_id,
					s.platform_id        = sd.platform_id,
					s.device_id          = sd.device_id,
					s.first_time_visit   = sd.first_time_visit,
					s.bounce             = sd.bounce"
			);

			// Mark the processed batch as done using sentinel value 9999.
			$wpdb->query(
				"UPDATE {$wpdb->prefix}burst_statistics
				INNER JOIN burst_batch_ids b ON {$wpdb->prefix}burst_statistics.ID = b.ID
				SET browser_id = 9999"
			);

			$wpdb->query( 'DROP TEMPORARY TABLE IF EXISTS burst_session_data' );
			$wpdb->query( 'DROP TEMPORARY TABLE IF EXISTS burst_batch_ids' );

		} elseif ( $this->column_exists( 'burst_statistics', 'browser_id' ) ) {
			$wpdb->query(
				"ALTER TABLE {$wpdb->prefix}burst_statistics
				DROP COLUMN `browser_id`,
				DROP COLUMN `browser_version_id`,
				DROP COLUMN `platform_id`,
				DROP COLUMN `device_id`,
				DROP COLUMN `first_time_visit`,
				DROP COLUMN `bounce`"
			);
			delete_option( 'burst_db_upgrade_move_columns_to_sessions' );
			delete_transient( 'burst_progress_move_columns_to_sessions' );
			self::error_log( 'move_columns_to_sessions upgrade complete.' );
		}
	}

	/**
	 * One-time cleanup of historic spam/invalid browsers and their visit data.
	 *
	 * Older installs accumulated junk browser names (e.g.
	 * "amazon-Quick-on-behalf-of-<hash>" or random tokens) before the user agent
	 * allowlist was tightened. This removes them in batches over several upgrade
	 * iterations to avoid timeouts on large tables.
	 */
	private function clean_spam_browsers(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		$option_name = 'burst_db_upgrade_clean_spam_browsers';
		if ( ! get_option( $option_name ) ) {
			return;
		}

		if ( ! $this->table_exists( 'burst_browsers' ) || ! $this->column_exists( 'burst_sessions', 'browser_id' ) ) {
			delete_option( $option_name );
			return;
		}

		// Junk browsers are spread across many lookup rows that each carry only a
		// few sessions, so per-run cost is dominated by the batched row deletes
		// (LIMIT 5000) inside clear_spam_browsers(), not by this browser count.
		$batch   = 500;
		$removed = \Burst\burst_loader()->admin->app->clear_spam_browsers( $batch );

		// Fewer than a full batch removed means the table has been fully scanned.
		if ( $removed < $batch ) {
			delete_option( $option_name );
			self::error_log( 'clean_spam_browsers upgrade complete.' );
		}
	}

	/**
	 * Remove duplicate names from the browser / browser_version / platform /
	 * device lookup tables before dbDelta adds the UNIQUE index on `name`.
	 *
	 * Before 3.6.3 these tables had no unique index and the tracking code did
	 * SELECT-then-INSERT, so concurrent first hits of a new value (typically a
	 * burst of bot requests sharing one user agent) created duplicate rows.
	 * 3.6.3 changed `name` to varchar(191) UNIQUE; dbDelta emits
	 * `ALTER TABLE … CHANGE COLUMN name … UNIQUE`, which fails with
	 * "Duplicate entry" on those installs and leaves the table without the
	 * index — on every subsequent upgrade, and with INSERT IGNORE unable to
	 * prevent new duplicates in the meantime.
	 *
	 * Runs on burst_install_tables at priority 9, before
	 * Statistics::install_statistics_table() (10), so the dbDelta that follows
	 * succeeds. Only tables that still lack the unique index are touched, which
	 * makes this a cheap no-op once a site has healed.
	 */
	public function dedupe_lookup_tables(): void {
		$action_count = (int) did_action( 'burst_install_tables' );
		if ( $action_count === self::$lookup_dedupe_action_count ) {
			return;
		}
		self::$lookup_dedupe_action_count = $action_count;

		global $wpdb;
		$bitmaps_affected = false;

		foreach ( self::LOOKUP_TABLES as $item => $id_column ) {
			$table = 'burst_' . $item . 's';
			if ( ! $this->table_exists( $table ) || $this->lookup_has_unique_name_index( $table ) ) {
				continue;
			}

			$this->lookup_truncate_long_names( $table );

			$duplicates = $this->lookup_get_duplicates( $table );
			if ( empty( $duplicates ) ) {
				continue;
			}

			if ( ! $this->lookup_remap_ids( $table, $id_column ) ) {
				// A killed or failed UPDATE (long-query killer, timeout) would
				// leave rows pointing at ids the DELETE below removes. Keep the
				// duplicates; the next burst_install_tables run retries.
				self::error_log( sprintf( 'Lookup dedupe for %s aborted: re-pointing referencing rows failed (%s). Duplicates kept.', $table, $wpdb->last_error ) );
				continue;
			}
			$this->lookup_delete_rows( $table, array_map( 'intval', array_column( $duplicates, 'old_id' ) ) );
			$this->lookup_flush_cache( $item, array_column( $duplicates, 'name' ) );

			if ( in_array( $item, self::LOOKUP_BITMAP_ITEMS, true ) ) {
				$bitmaps_affected = true;
			}
			self::error_log( sprintf( 'Removed %d duplicate rows from %s before adding the unique name index.', count( $duplicates ), $table ) );
		}

		if ( $bitmaps_affected ) {
			// Dimension day sets are keyed on the old ids; rebuild the store.
			( new Visitor_Bitmaps() )->reset_store();
		}
	}

	/**
	 * Whether the lookup table already has a unique index on `name`.
	 *
	 * @param string $table Table name without prefix.
	 */
	private function lookup_has_unique_name_index( string $table ): bool {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table from the LOOKUP_TABLES allowlist.
		return null !== $wpdb->get_var( "SHOW INDEX FROM `{$wpdb->prefix}{$table}` WHERE Column_name = 'name' AND Non_unique = 0" );
	}

	/**
	 * Shorten names that no longer fit the varchar(191) column dbDelta is about
	 * to create; a failed CHANGE COLUMN on length would block the index as well.
	 *
	 * @param string $table Table name without prefix.
	 */
	private function lookup_truncate_long_names( string $table ): void {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table from the LOOKUP_TABLES allowlist.
		$wpdb->query( $wpdb->prepare( "UPDATE `{$wpdb->prefix}{$table}` SET name = LEFT(name, %d) WHERE CHAR_LENGTH(name) > %d", self::LOOKUP_NAME_LENGTH, self::LOOKUP_NAME_LENGTH ) );
	}

	/**
	 * Derived table mapping every duplicate row to the lowest id with the same
	 * name. Name comparison follows the column collation, exactly like the
	 * unique index dbDelta is going to add.
	 *
	 * @param string $table Table name without prefix.
	 */
	private function lookup_duplicate_map_sql( string $table ): string {
		global $wpdb;
		$full = $wpdb->prefix . $table;

		return "SELECT d.ID AS old_id, d.name, k.keep_id
			FROM `{$full}` d
			JOIN ( SELECT name, MIN(ID) AS keep_id FROM `{$full}` GROUP BY name HAVING COUNT(*) > 1 ) k ON k.name = d.name
			WHERE d.ID <> k.keep_id";
	}

	/**
	 * Rows that will be removed: old_id, name and the keep_id they map to.
	 *
	 * @param string $table Table name without prefix.
	 * @return array<int, array{old_id: string, name: string, keep_id: string}>
	 */
	private function lookup_get_duplicates( string $table ): array {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared -- Static SQL over an allowlisted table.
		$rows = $wpdb->get_results( $this->lookup_duplicate_map_sql( $table ), ARRAY_A );

		return is_array( $rows ) ? $rows : [];
	}

	/**
	 * Re-point sessions (and legacy statistics rows) from every duplicate id to
	 * the kept id, one set-based UPDATE per referencing table.
	 *
	 * The browser_version_id column carries no index on burst_sessions, so that
	 * UPDATE is a full scan; the others resolve through their index. Every
	 * statement is checked: the caller must not delete the duplicate rows while
	 * a referencing table may still point at them.
	 *
	 * @param string $table     Lookup table name without prefix.
	 * @param string $id_column Referencing column, from LOOKUP_TABLES.
	 * @return bool True when every referencing table was re-pointed.
	 */
	private function lookup_remap_ids( string $table, string $id_column ): bool {
		global $wpdb;
		$map = $this->lookup_duplicate_map_sql( $table );

		$targets = [ 'burst_sessions' ];
		if ( $this->column_exists( 'burst_statistics', $id_column ) ) {
			$targets[] = 'burst_statistics';
		}
		foreach ( $targets as $target ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table and column from the LOOKUP_TABLES allowlist; $map is static SQL.
			$result = $wpdb->query( "UPDATE `{$wpdb->prefix}{$target}` t JOIN ( {$map} ) m ON t.`{$id_column}` = m.old_id SET t.`{$id_column}` = m.keep_id" );
			if ( false === $result ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Delete the duplicate lookup rows by id.
	 *
	 * @param string $table Table name without prefix.
	 * @param int[]  $ids   Row ids to delete.
	 */
	private function lookup_delete_rows( string $table, array $ids ): void {
		global $wpdb;
		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- %d placeholders built from the id count; table allowlisted.
		$wpdb->query( $wpdb->prepare( "DELETE FROM `{$wpdb->prefix}{$table}` WHERE ID IN ({$placeholders})", ...$ids ) );
	}

	/**
	 * Drop the tracking's name → id object-cache entries for the affected
	 * names: they may hold an id that no longer exists.
	 *
	 * @param string   $item  Lookup item (browser|browser_version|platform|device).
	 * @param string[] $names Names whose duplicates were removed.
	 */
	private function lookup_flush_cache( string $item, array $names ): void {
		foreach ( array_unique( $names ) as $name ) {
			wp_cache_delete( Tracking::lookup_cache_key( $item, (string) $name ), 'burst' );
		}
	}
}
