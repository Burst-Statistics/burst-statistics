<?php
namespace Burst\Admin\DB_Upgrade;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Sanitize;
use Burst\Admin\Statistics\Summary;

defined( 'ABSPATH' ) || die();
class DB_Upgrade {
	use Admin_Helper;
	use Database_Helper;
	use Helper;
	use Sanitize;

	private $cron_interval = MINUTE_IN_SECONDS;
	private $batch         = 100000;

	/**
	 * DB_Upgrade constructor.
	 */
	public function init(): void {
		add_action( 'burst_daily', [ $this, 'upgrade' ] );
		add_action( 'admin_init', [ $this, 'maybe_fire_upgrade' ] );
		add_action( 'burst_upgrade_iteration', [ $this, 'upgrade' ] );
		add_filter( 'burst_tasks', [ $this, 'add_progress_notice' ] );
	}

	/**
	 * Ensure upgrade progress even when Cron is not working, when the user visits the dashboard.
	 */
	public function maybe_fire_upgrade(): void {
		// no data is used from the form data. only compared.
        //phpcs:ignore
		if ( isset( $_GET['page'] ) && $_GET['page'] === 'burst' ) {
			$this->upgrade();
		}
	}

	/**
	 * If there is any upgrade running
	 */
	public function progress_complete(): bool {
		return $this->get_progress() >= 100;
	}

	/**
	 * Add a notice about the progress to the admin dashboard in burst.
	 * phpcs:ignore
     * @param array $warnings //array of warnings in burst.
     * phpcs:ignore
     * @return array
	 */
	public function add_progress_notice( array $warnings ): array {
		$progress = $this->get_progress();
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

		return $warnings;
	}

	/**
	 * Get progress of the upgrade process
	 */
	public function get_progress( string $type = 'all' ): float {
		$version = BURST_VERSION;

		// strip off everything after '#'.
		if ( strpos( $version, '#' ) !== false ) {
			$version = substr( $version, 0, strpos( $version, '#' ) );
		}
		$total_upgrades     = $this->get_db_upgrades( $type );
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
		set_transient( 'burst_upgrade_running', true, 60 );
		// check if we need to upgrade.
		$db_upgrades = $this->get_db_upgrades( 'free' );
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
		if ( 'summary_table' === $do_upgrade ) {
			( new Summary() )->upgrade_summary_table_alltime();
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
			$this->fix_missing_session_ids();
		}

		if ( 'clean_orphaned_session_ids' === $do_upgrade ) {
			$this->clean_orphaned_session_ids();
		}

		// check free progress, because pro upgrades are hooked to burst_upgrade_iteration.
		if ( $this->get_progress( 'free' ) < 100 ) {
			// free upgardes not finished yet.
			wp_schedule_single_event( time() + $this->cron_interval, 'burst_upgrade_iteration' );
		} else {
			wp_clear_scheduled_hook( 'burst_upgrade_iteration' );
			// if pro upgrades are not finished yet, do them.
			if ( $this->get_progress( 'pro' ) < 100 ) {
				delete_transient( 'burst_upgrade_running' );
				do_action( 'burst_upgrade_pro_iteration' );
			}
		}

		delete_transient( 'burst_upgrade_running' );
	}

	/**
	 * Get the upgrades
	 *
	 * @return string[]
	 */
	protected function get_db_upgrades( string $select_version ): array {
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
					'summary_table',
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
			]
		);

		// Get all upgrades from all versions.
		$all_upgrades = [];
		foreach ( $upgrades as $upgrade_version => $upgrade ) {
			$all_upgrades = array_merge( $all_upgrades, $upgrade );
		}

		if ( $select_version === 'all' ) {
			return $all_upgrades;
		}

		// Handle special selectors for pro and free upgrades.
		if ( $select_version === 'pro' ) {
			// Get only pro upgrades - these are determined by filter and will have 'pro_' prefix.
			$pro_upgrades = [];
			foreach ( $all_upgrades as $upgrade ) {
				if ( strpos( $upgrade, 'pro_' ) === 0 ) {
					$pro_upgrades[] = $upgrade;
				}
			}
			return $pro_upgrades;
		}

		if ( $select_version === 'free' ) {
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
		$table_name = $wpdb->prefix . 'burst_statistics';

		$sql = "UPDATE $table_name
                SET bounce = 0
                WHERE
                  (session_id IN (
                    SELECT session_id
                    FROM (
                      SELECT session_id
                      FROM $table_name
                      GROUP BY session_id
                      HAVING COUNT(*) >= 2
                    ) as t
                  ))";

		$result = $wpdb->query( $sql );
		if ( $result === false ) {
			return;
		}

		$sql    = "UPDATE $table_name
                SET bounce = 0
                WHERE bounce = 1 AND time_on_page > 5000";
		$result = $wpdb->query( $sql );

		// if query is successful.
		if ( $result !== false ) {
			delete_option( 'burst_db_upgrade_bounces' );
		} else {
			self::error_log( 'db upgrade bounces failed' );
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
		$table_name = $wpdb->prefix . 'burst_goals';
		// check if columns exist first.
		$columns = $wpdb->get_col( "DESC $table_name", 0 );
		if ( ! in_array( 'event', $columns, true ) || ! in_array( 'action', $columns, true ) ) {
			delete_option( 'burst_db_upgrade_goals_remove_columns' );
			return;
		}

		// run an sql query to remove the columns `event` and `action`.
		$sql = "ALTER TABLE $table_name
                DROP COLUMN `event`,
                DROP COLUMN `action`";

		$remove = $wpdb->query( $sql );

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
		$table_name = $wpdb->prefix . 'burst_goals';

		// set conversion_metric to 'pageviews' for all goals.
		$sql = "UPDATE $table_name
                SET conversion_metric = 'pageviews'
                WHERE conversion_metric IS NULL OR conversion_metric = ''";

		$add_conversion_metric = $wpdb->query( $sql );

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
		$table_name = $wpdb->prefix . 'burst_statistics';

		// check if columns exist first.
		$columns = $wpdb->get_col( "DESC $table_name", 0 );
		if ( ! in_array( 'user_agent', $columns, true ) ) {
			delete_option( 'burst_db_upgrade_drop_user_agent' );
			return;
		}

		// drop user_agent column.
		$sql = "ALTER TABLE $table_name
                DROP COLUMN `user_agent`";

		$drop_user_agent = $wpdb->query( $sql );

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
		$table_name = $wpdb->prefix . 'burst_statistics';
		$home_url   = home_url();
		// empty referrer when starts with current domain.
		$sql = "UPDATE $table_name
                SET referrer = null
                WHERE referrer LIKE '$home_url%'";

		$empty_referrer_when_current_domain = $wpdb->query( $sql );

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
		$table_name = $wpdb->prefix . 'burst_statistics';
		// make sure it does not end with slash.
		$home_url = untrailingslashit( home_url() );

		// strip home url from entire_page_url where it starts with home_url.
		$sql = "UPDATE $table_name
                SET entire_page_url = REPLACE(entire_page_url, '$home_url', '')
                WHERE entire_page_url LIKE '$home_url%'";

		$strip_domain_names_from_entire_page_url = $wpdb->query( $sql );

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

			$sql = "INSERT INTO {$wpdb->prefix}burst_{$selected_item}s (name) SELECT DISTINCT $selected_item FROM {$wpdb->prefix}burst_statistics
                    WHERE $selected_item IS NOT NULL AND
                        $selected_item NOT IN (
                        SELECT name
                        FROM {$wpdb->prefix}burst_{$selected_item}s
                    );";
			$wpdb->query( $sql );
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
				update_option( "burst_db_upgrade_create_lookup_tables_$item", true, false );
				update_option( 'burst_db_upgrade_create_lookup_tables', true, false );
				return;
			}

			// check if this table contains data.
			// if not, ensure that the update for this table is started again.
			$count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_{$item}s" );
			if ( 0 === $count ) {
				update_option( "burst_db_upgrade_create_lookup_tables_$item", true, false );
				update_option( 'burst_db_upgrade_create_lookup_tables', true, false );
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
				$sql = "UPDATE {$wpdb->prefix}burst_statistics AS t
                    JOIN (
                        SELECT p.{$selected_item}, p.ID, COALESCE(m.ID, 0) as {$selected_item}_id
                        FROM {$wpdb->prefix}burst_statistics p 
                        LEFT JOIN {$wpdb->prefix}burst_{$selected_item}s m ON p.{$selected_item} = m.name
                        WHERE p.{$selected_item}_id = 999999
                        LIMIT $batch
                    ) AS s ON t.ID = s.ID
                    SET t.{$selected_item}_id = s.{$selected_item}_id;";
				$wpdb->query( $sql );

				// completed.
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
		$success  = $wpdb->query( $sql );

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
		$table_name = $wpdb->prefix . 'burst_statistics';
		// check if columns exist first.
		$columns = $wpdb->get_col( "DESC $table_name", 0 );
		if ( ! in_array( 'page_id', $columns, true ) ) {
			delete_option( 'burst_db_upgrade_drop_page_id_column' );
			return;
		}

		// run an sql query to remove the columns `event` and `action`.
		$sql = "ALTER TABLE $table_name DROP COLUMN `page_id`";

		$remove = $wpdb->query( $sql );

		if ( $remove !== false ) {
			delete_option( 'burst_db_upgrade_drop_page_id_column' );
		}
	}

	/**
	 * Update the entire_page_url column to the new name, paramaters, and change to TEXT
	 */
	public function change_column_name_entire_page_url(): void {

		global $wpdb;
		$table = $wpdb->prefix . 'burst_statistics';
		$sql   = "ALTER TABLE $table MODIFY parameters TEXT;";
		$wpdb->query( $sql );
		delete_option( 'burst_db_upgrade_rename_entire_page_url_column' );
	}

	/**
	 * Upgrade missing session ids
	 */
	public function fix_missing_session_ids(): void {
		global $wpdb;

		// Get the last valid session_id before the incorrect session_id = 1.
		$sql    = "
        SELECT ID, session_id
        FROM {$wpdb->prefix}burst_statistics
        WHERE time > 1746449396 AND ID = (
            SELECT s1.ID - 1
            FROM {$wpdb->prefix}burst_statistics s1
            WHERE s1.session_id = 1
              AND EXISTS (
                SELECT 1
                FROM {$wpdb->prefix}burst_statistics s2
                WHERE s2.ID = s1.ID - 1
                  AND s2.session_id > 1
              )
            ORDER BY s1.ID ASC
            LIMIT 1
        )
    ";
		$result = $wpdb->get_row( $sql );

		if ( ! $result ) {
			delete_option( 'burst_db_upgrade_fix_missing_session_ids' );
			return;
		}

		$last_valid_id         = (int) $result->ID;
		$last_valid_session_id = (int) $result->session_id;

		if ( $last_valid_id <= 1 || $last_valid_session_id <= 1 ) {
			delete_option( 'burst_db_upgrade_fix_missing_session_ids' );
			return;
		}

		if ( get_option( 'burst_fix_incorrect_bounces' ) ) {
			// correct bounce for each unique uid with less than 5 s time_on_page.
			$wpdb->query(
				$wpdb->prepare(
					"UPDATE {$wpdb->prefix}burst_statistics AS t1
                JOIN (
                    SELECT s.ID
                    FROM {$wpdb->prefix}burst_statistics s
                    JOIN (
                        SELECT uid
                        FROM {$wpdb->prefix}burst_statistics
                        WHERE ID > %d
                          AND session_id = 1
                        GROUP BY uid
                        HAVING COUNT(*) = 1
                    ) AS unique_uid
                    ON s.uid = unique_uid.uid
                    WHERE s.ID > %d
                      AND s.session_id = 1
                      AND s.time_on_page < 5000
                ) AS target
                ON t1.ID = target.ID
                SET t1.bounce = 1",
					$last_valid_id,
					$last_valid_id
				)
			);
			delete_option( 'burst_fix_incorrect_bounces' );
		}

		// Get up to 100 distinct uids with session_id = 1 after last_valid_id.
		$sql           = $wpdb->prepare(
			"
        SELECT DISTINCT uid
        FROM {$wpdb->prefix}burst_statistics
        WHERE session_id = 1
          AND ID > %d
        LIMIT 100
    ",
			$last_valid_id
		);
		$distinct_uids = $wpdb->get_col( $sql );

		// If no more UIDs, delete the option and finish.
		if ( empty( $distinct_uids ) ) {
			delete_option( 'burst_db_upgrade_fix_missing_session_ids' );
			return;
		}

		$new_session_id = $last_valid_session_id;
		// Process each UID, assign new session_id.
		foreach ( $distinct_uids as $distinct_uid ) {
			// Increment session ID for this UID.
			++$new_session_id;
			$wpdb->query(
				$wpdb->prepare(
					"UPDATE {$wpdb->prefix}burst_statistics
                 SET session_id = %d
                 WHERE uid = %s
                   AND ID > %d
                   AND time > 1746449396
                   AND session_id = 1",
					$new_session_id,
					$distinct_uid,
					$last_valid_id
				)
			);
		}
	}

	/**
	 * Clean up orphaned session IDs
	 */
	public function clean_orphaned_session_ids(): void {
		global $wpdb;
		$wpdb->query(
			"
            DELETE s
            FROM {$wpdb->prefix}burst_sessions s
            LEFT JOIN {$wpdb->prefix}burst_statistics bs ON s.ID = bs.session_id
            WHERE bs.session_id IS NULL
        "
		);
		delete_option( 'burst_db_upgrade_clean_orphaned_session_ids' );
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
		$table      = $wpdb->prefix . 'burst_statistics';
		$offset     = get_option( 'burst_db_upgrade_column_offset', 0 );
		$sql        = "UPDATE $table
                SET `parameters` = IF(LOCATE('?', `entire_page_url`) > 0, SUBSTRING(`entire_page_url`, LOCATE('?', `entire_page_url`)), '')
                WHERE ID IN (
                    SELECT ID FROM (
                        SELECT id FROM $table LIMIT $offset, $batch_size
                    ) AS temp
                );";
		$wpdb->query( $sql );
		$offset += $batch_size;
		update_option( 'burst_db_upgrade_column_offset', $offset );
		$total    = $wpdb->get_var( "SELECT COUNT(*) FROM $table" );
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
	 * Check if a table has a specific column
	 */
	public function column_exists( string $table_name, string $column_name ): bool {
		global $wpdb;
		$table_name = $wpdb->prefix . $table_name;
		$columns    = $wpdb->get_col( "DESC $table_name" );
		return in_array( $column_name, $columns, true );
	}
}
