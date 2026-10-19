<?php
namespace Burst\Admin\Statistics;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die();

/**
 * Exact visitor sets per day, stored as bitmaps over uid dictionary ids.
 *
 * Each row holds the set of visitors (uid dictionary ids, see burst_uids) that
 * were active on one site-timezone day, for one scope. Sets are mergeable:
 * OR-ing day sets gives the exact distinct-visitor count for any period —
 * the operation that makes COUNT(DISTINCT) over raw hits expensive and that
 * plain per-day rollups cannot answer at all (uniques are not additive).
 *
 * Storage is hybrid, chosen per day by density (the Roaring insight without
 * the library): small sets as a packed sorted uint32 list (4 bytes/member),
 * large sets as a dense bitmap (bit N = uid_id N present). Both gzip-ed.
 *
 * The builder runs on cron and only materializes CLOSED days — "today" is
 * always computed live from the statistics table and merged in at query time
 * (the lambda pattern), so late hits within the day need no rebuilds. Days
 * are immutable once built; the invalidation sources are an archive restore
 * (re-arms the affected range via burst_visitor_bitmaps_rebuild_from), the
 * archiver deleting a month's raw data (drops that month's rows), and a site
 * timezone change (resets the whole store — day boundaries moved).
 *
 * v1 ships the 'site' scope (site-wide visitors). The schema carries scope +
 * value_id so page and dimension scopes can be added without migration.
 */
class Visitor_Bitmaps {
	use Admin_Helper;
	use Database_Helper;
	use Helper;

	private const SCOPE_SITE = 'site';
	private const SCOPE_PAGE = 'page';

	/**
	 * Dimension scopes: session columns with stable integer ids that become
	 * value_id. Filter key => [scope, session column].
	 *
	 * @var array<string, array{0: string, 1: string}>
	 */
	private const DIMENSION_SCOPES = [
		'device_id'   => [ 'device', 'device_id' ],
		'browser_id'  => [ 'browser', 'browser_id' ],
		'platform_id' => [ 'platform', 'platform_id' ],
	];

	/**
	 * Bump when the set of built scopes changes: the builder then rebuilds the
	 * whole store so historic days carry the new scopes too.
	 */
	private const SCOPES_VERSION = 3;

	private const FORMAT_LIST   = 0;
	private const FORMAT_BITMAP = 1;

	/**
	 * Above this member count a dense bitmap is smaller/faster than a packed
	 * list for union work; below it the list wins on storage.
	 */
	private const DENSE_THRESHOLD = 4096;

	/**
	 * Days built per cron invocation; the builder self-schedules until caught up.
	 */
	private const DAYS_PER_BATCH = 30;

	/**
	 * Visitors per dimension-pass chunk and pages per page-pass chunk. Each
	 * chunk is one resumable unit of work: the time budget is checked between
	 * chunks, so a single high-traffic day no longer has to finish in one run.
	 * The SQL of a chunk is split further by chunk_ids_for_in_list(), so the
	 * chunk size (and its filter) never drives the length of an IN () list.
	 */
	private const DIMENSION_CHUNK_SIZE = 10000;
	private const PAGE_CHUNK_SIZE      = 500;

	/**
	 * Option (autoload off) holding the checkpoint of a day that is partially
	 * built: [ 'day' => Y-m-d, 'phase' => one of the PHASE_* values, 'cursor' => int ].
	 */
	private const DAY_PROGRESS_OPTION = 'burst_visitor_bitmaps_day_progress';

	/**
	 * Build phases of one day, in order. The cursor is the last uid_id
	 * (dimensions) or burst_page_urls.ID (pages) already written.
	 */
	private const PHASE_SITE       = 'site';
	private const PHASE_DIMENSIONS = 'dimensions';
	private const PHASE_PAGES      = 'pages';

	/**
	 * Outcomes of build_day().
	 */
	private const BUILD_DONE   = 'done';
	private const BUILD_PAUSED = 'paused';
	private const BUILD_FAILED = 'failed';

	/**
	 * Why the last get_visitors() call on this instance returned null (empty
	 * when it served an answer). Powers the Site Health section and the
	 * fallback telemetry in Statistics_Data — without it, a bitmap fallback in
	 * production is invisible: the dashboard is simply "slow" with no trace.
	 */
	private string $last_miss_reason = '';

	/**
	 * Why the last get_visitors() call fell back to the SQL path ('' = served).
	 */
	public function get_last_miss_reason(): string {
		return $this->last_miss_reason;
	}

	/**
	 * Record why get_visitors() is about to fall back to the SQL path; the
	 * caller returns null right after.
	 */
	private function miss( string $reason ): void {
		$this->last_miss_reason = $reason;
	}

	/**
	 * Register hooks: table install, daily build, catch-up iterations, and
	 * invalidation when the site timezone changes (day boundaries move, so
	 * every stored day set describes the wrong 24 hours).
	 */
	public function init(): void {
		add_action( 'burst_install_tables', [ $this, 'install_bitmaps_table' ], 20 );
		add_action( 'burst_daily', [ $this, 'run_builder' ] );
		add_action( 'burst_visitor_bitmaps_iteration', [ $this, 'run_builder' ] );
		add_action( 'update_option_timezone_string', [ $this, 'reset_store' ] );
		add_action( 'update_option_gmt_offset', [ $this, 'reset_store' ] );
	}

	/**
	 * Throw the whole store away and let the builder rebuild it from scratch.
	 * Used when the site timezone changes: the reader would otherwise keep
	 * serving day sets built on the old day boundaries, permanently disagreeing
	 * with the SQL fallback by the border-hours' visitors.
	 */
	public function reset_store(): void {
		global $wpdb;
		if ( ! $this->table_exists( 'burst_visitor_bitmaps' ) ) {
			return;
		}
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table name.
		$wpdb->query( "TRUNCATE TABLE {$wpdb->prefix}burst_visitor_bitmaps" );
		delete_option( 'burst_visitor_bitmaps_built_until' );
		delete_option( 'burst_visitor_bitmaps_rebuild_from' );
		delete_option( self::DAY_PROGRESS_OPTION );
		$this->bump_generation();
		if ( ! wp_next_scheduled( 'burst_visitor_bitmaps_iteration' ) ) {
			wp_schedule_single_event( time() + MINUTE_IN_SECONDS, 'burst_visitor_bitmaps_iteration' );
		}
	}

	/**
	 * Invalidate every cached union/count derived from the store. Bumped on any
	 * operation that changes existing day sets (truncate, rebuild-from,
	 * timezone reset, archive deletion) — the object-cache keys embed it.
	 */
	private function bump_generation(): void {
		update_option( 'burst_visitor_bitmaps_generation', (string) time(), false );
	}

	/**
	 * Install the bitmap store.
	 */
	public function install_bitmaps_table(): void {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		global $wpdb;
		$charset_collate = $wpdb->get_charset_collate();

		$table_name = $wpdb->prefix . 'burst_visitor_bitmaps';
		$sql        = "CREATE TABLE $table_name (
            `ID` bigint unsigned NOT NULL AUTO_INCREMENT,
            `scope` varchar(20) NOT NULL DEFAULT 'site',
            `value_id` int unsigned NOT NULL DEFAULT 0,
            `day` date NOT NULL,
            `format` tinyint NOT NULL DEFAULT 0,
            `members` int unsigned NOT NULL DEFAULT 0,
            `data` longblob,
            PRIMARY KEY  (ID),
            UNIQUE KEY scope_value_day (scope, value_id, day)
        ) $charset_collate;";

		dbDelta( $sql );
		if ( ! empty( $wpdb->last_error ) ) {
			self::error_log( 'Error creating visitor bitmaps table: ' . $wpdb->last_error );
		}

		// page_url dictionary (same pattern as burst_uids). Three consumers:
		// the bitmap page scope (value_id = ID), the tracker (URLs resolving to
		// no post get page_id = -ID instead of 0, see resolve_page_url_id()),
		// and page-grain queries (GROUP BY statistics.page_id with the display
		// URL joined back from here). page_id holds the WP post id the URL
		// belonged to; is_canonical marks the row that displays for that post
		// id — maintained on save_post and by the weekly permalink sweep.
		$stats_page_collate        = $this->get_column_charset_collate( 'burst_statistics', 'page_url' );
		$page_urls_charset_collate = null !== $stats_page_collate
			? "DEFAULT CHARACTER SET {$stats_page_collate['charset']} COLLATE {$stats_page_collate['collation']}"
			: $charset_collate;

		$dictionary = $wpdb->prefix . 'burst_page_urls';
		dbDelta(
			"CREATE TABLE $dictionary (
            `ID` int unsigned NOT NULL AUTO_INCREMENT,
            `page_url` varchar(191) NOT NULL,
            `page_id` int NOT NULL DEFAULT 0,
            `is_canonical` tinyint NOT NULL DEFAULT 0,
            PRIMARY KEY  (ID),
            UNIQUE KEY page_url (page_url),
            KEY page_id (page_id)
        ) $page_urls_charset_collate;"
		);
		if ( ! empty( $wpdb->last_error ) ) {
			self::error_log( 'Error creating page url dictionary: ' . $wpdb->last_error );
		}
	}

	/**
	 * Build missing (or invalidated) closed-day bitmaps, oldest first, in
	 * bounded batches; self-schedules a follow-up iteration until caught up.
	 *
	 * Requires the uid dictionary migration to be complete: bit positions are
	 * dictionary ids.
	 */
	public function run_builder(): void {
		if ( ! $this->has_admin_access() || ! $this->uid_id_active() ) {
			return;
		}

		global $wpdb;
		// Both tables are created via burst_install_tables; when either is
		// missing (deploy without a version bump), Burst's missing-tables
		// self-heal recreates them — bail until then so the store is never
		// built without the page scope.
		if ( ! $this->table_exists( 'burst_visitor_bitmaps' ) || ! $this->table_exists( 'burst_page_urls' ) ) {
			return;
		}

		if ( get_transient( 'burst_bitmaps_building' ) ) {
			return;
		}
		set_transient( 'burst_bitmaps_building', true, 5 * MINUTE_IN_SECONDS );

		// A scope-set change rebuilds the whole store so historic days carry
		// the new scopes.
		if ( (int) get_option( 'burst_visitor_bitmaps_scopes_version' ) !== self::SCOPES_VERSION ) {
			$wpdb->query( "TRUNCATE TABLE {$wpdb->prefix}burst_visitor_bitmaps" );
			delete_option( 'burst_visitor_bitmaps_built_until' );
			delete_option( self::DAY_PROGRESS_OPTION );
			update_option( 'burst_visitor_bitmaps_scopes_version', self::SCOPES_VERSION, false );
			$this->bump_generation();
		}

		// An archive restore re-arms a range: drop those rows so they rebuild
		// from the now-complete raw data.
		$rebuild_from = (string) get_option( 'burst_visitor_bitmaps_rebuild_from' );
		if ( '' !== $rebuild_from ) {
			$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}burst_visitor_bitmaps WHERE day >= %s", $rebuild_from ) );
			delete_option( 'burst_visitor_bitmaps_rebuild_from' );
			delete_option( 'burst_visitor_bitmaps_built_until' );
			delete_option( self::DAY_PROGRESS_OPTION );
			$this->bump_generation();
		}

		$timezone = wp_timezone();
		$today    = new \DateTimeImmutable( 'today', $timezone );

		// Resume after the last built day; start at the site's first hit.
		$built_until = (string) get_option( 'burst_visitor_bitmaps_built_until' );
		if ( '' !== $built_until ) {
			$cursor = new \DateTimeImmutable( $built_until, $timezone );
			$cursor = $cursor->modify( '+1 day' );
		} else {
			$first_hit = (int) $wpdb->get_var( "SELECT MIN(time) FROM {$wpdb->prefix}burst_statistics" );
			if ( 0 === $first_hit ) {
				delete_transient( 'burst_bitmaps_building' );
				return;
			}
			$cursor = ( new \DateTimeImmutable( '@' . $first_hit ) )->setTimezone( $timezone )->setTime( 0, 0 );
		}

		$built       = 0;
		$failed      = false;
		$build_start = microtime( true );
		$budget      = (float) apply_filters( 'burst_bitmaps_build_time_budget', 30.0 );
		$deadline    = $build_start + $budget;
		while ( $cursor < $today && $built < self::DAYS_PER_BATCH ) {
			// Keep the re-entrancy guard ahead of the clock: a slow catch-up
			// must not overlap the next scheduled builder run.
			set_transient( 'burst_bitmaps_building', true, 5 * MINUTE_IN_SECONDS );
			$outcome = $this->build_day( $cursor, $deadline );
			if ( self::BUILD_FAILED === $outcome ) {
				// Leave built_until untouched: advancing past a failed day
				// would leave a permanent coverage hole, because closed days
				// are never revisited. The day is retried on the next run; the
				// option surfaces a stuck builder in Site Health.
				$message = (string) $wpdb->last_error;
				if ( '' === $message ) {
					$message = 'Bitmap build failed';
				}
				update_option(
					'burst_visitor_bitmaps_last_error',
					[
						'day'     => $cursor->format( 'Y-m-d' ),
						'time'    => time(),
						'message' => $message,
					],
					false
				);
				$failed = true;
				break;
			}
			if ( self::BUILD_PAUSED === $outcome ) {
				// The budget ran out inside this day: its checkpoint is saved
				// and the follow-up iteration resumes it. built_until stays on
				// the previous day, so readers never see a half-built day.
				break;
			}
			delete_option( self::DAY_PROGRESS_OPTION );
			update_option( 'burst_visitor_bitmaps_built_until', $cursor->format( 'Y-m-d' ), false );
			$cursor = $cursor->modify( '+1 day' );
			++$built;
			// Time budget: catch-up over years of history continues via
			// self-scheduled iterations instead of one unbounded cron run.
			if ( microtime( true ) > $deadline ) {
				break;
			}
		}

		delete_transient( 'burst_bitmaps_building' );

		if ( ! $failed && $built > 0 ) {
			delete_option( 'burst_visitor_bitmaps_last_error' );
		}

		if ( $cursor < $today ) {
			// Back off after a failure so a persistent error does not spin the
			// iteration hook every minute.
			if ( $failed ) {
				wp_clear_scheduled_hook( 'burst_visitor_bitmaps_iteration' );
				wp_schedule_single_event( time() + HOUR_IN_SECONDS, 'burst_visitor_bitmaps_iteration' );
			} elseif ( ! wp_next_scheduled( 'burst_visitor_bitmaps_iteration' ) ) {
				wp_schedule_single_event( time() + MINUTE_IN_SECONDS, 'burst_visitor_bitmaps_iteration' );
			}
		}
	}

	/**
	 * Save progress for an incomplete day build and return the paused status.
	 *
	 * @param \DateTimeImmutable $day    Day being built.
	 * @param string             $phase  Current build phase (self::PHASE_*).
	 * @param int                $cursor Last processed id or 0.
	 * @return string self::BUILD_PAUSED
	 */
	private function save_day_progress( \DateTimeImmutable $day, string $phase, int $cursor ): string {
		update_option(
			self::DAY_PROGRESS_OPTION,
			[
				'day'    => $day->format( 'Y-m-d' ),
				'phase'  => $phase,
				'cursor' => $cursor,
			],
			false
		);
		return self::BUILD_PAUSED;
	}

	/**
	 * Build the site-level visitor bitmap for a day.
	 *
	 * Writes the site row even when empty: its presence is what marks
	 * the day as built. Returns null on failure, empty array if the day has no
	 * visitors, or the sorted list of distinct visitor IDs.
	 *
	 * @param \DateTimeImmutable $day   Site-timezone day (00:00).
	 * @param int                $start Day start timestamp.
	 * @param int                $end   Day end timestamp.
	 * @return int[]|null Sorted uid list, empty array for no visitors, or null on failure.
	 */
	private function build_site_phase( \DateTimeImmutable $day, int $start, int $end ): ?array {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table name, values prepared.
		$uids = array_map(
			'intval',
			$wpdb->get_col(
				$wpdb->prepare(
					"SELECT DISTINCT uid_id FROM {$wpdb->prefix}burst_statistics WHERE time >= %d AND time < %d AND uid_id > 0 AND page_type != '404'",
					$start,
					$end
				)
			)
		);
		// phpcs:enable
		if ( ! empty( $wpdb->last_error ) ) {
			return null;
		}

		// The site row is written even when empty: its presence is what marks
		// the day as built (dimension rows are sparse — absent means zero).
		if ( ! $this->store_day_sets( self::SCOPE_SITE, [ 0 => $uids ], $day ) ) {
			return null;
		}

		if ( empty( $uids ) ) {
			return [];
		}

		sort( $uids );
		return $uids;
	}

	/**
	 * Build visitor bitmaps for dimensions (device, browser, platform).
	 *
	 * @param \DateTimeImmutable $day      Site-timezone day (00:00).
	 * @param int                $start    Day start timestamp.
	 * @param int                $end      Day end timestamp.
	 * @param int                $cursor   Last processed uid_id, or 0 to start.
	 * @param float              $deadline Monotonic microtime budget ceiling.
	 * @param int[]              $uids     Optional pre-fetched sorted uid list from site phase.
	 * @return string One of BUILD_DONE, BUILD_PAUSED, BUILD_FAILED.
	 */
	private function build_dimension_phase( \DateTimeImmutable $day, int $start, int $end, int $cursor, float $deadline, array $uids = [] ): string {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table names, integer id lists, values prepared.
		if ( 0 === $cursor ) {
			$dimension_scopes = array_column( self::DIMENSION_SCOPES, 0 );
			$scope_in         = implode( ',', array_fill( 0, count( $dimension_scopes ), '%s' ) );
			$delete_sql       = "DELETE FROM {$wpdb->prefix}burst_visitor_bitmaps WHERE day = %s AND scope IN ({$scope_in})";
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- placeholders built above, values prepared.
			if ( ! $this->run_write( $wpdb->prepare( $delete_sql, array_merge( [ $day->format( 'Y-m-d' ) ], $dimension_scopes ) ) ) ) {
				return self::BUILD_FAILED;
			}
		}

		if ( empty( $uids ) ) {
			$uids = array_map(
				'intval',
				$wpdb->get_col(
					$wpdb->prepare(
						"SELECT DISTINCT uid_id
						FROM {$wpdb->prefix}burst_statistics
						WHERE time >= %d AND time < %d AND uid_id > %d AND page_type != '404'
						ORDER BY uid_id ASC",
						$start,
						$end,
						$cursor
					)
				)
			);
			if ( ! empty( $wpdb->last_error ) ) {
				return self::BUILD_FAILED;
			}
		} elseif ( $cursor > 0 ) {
			$uids = array_values( array_filter( $uids, static fn( int $id ) => $id > $cursor ) );
		}

		if ( empty( $uids ) ) {
			return self::BUILD_DONE;
		}

		$dimension_chunk_size = (int) apply_filters( 'burst_bitmaps_dimension_chunk_size', self::DIMENSION_CHUNK_SIZE );
		$chunks               = array_chunk( $uids, $dimension_chunk_size );

		foreach ( $chunks as $chunk_index => $uid_chunk ) {
			$sets = $this->fetch_dimension_sets( $uid_chunk, $start, $end );
			if ( null === $sets ) {
				return self::BUILD_FAILED;
			}
			if ( ! $this->merge_dimension_chunk( $sets, $day ) ) {
				return self::BUILD_FAILED;
			}
			unset( $sets );

			$cursor = (int) end( $uid_chunk );

			$is_last_chunk = ( $chunk_index === count( $chunks ) - 1 );
			if ( ! $is_last_chunk && $deadline > 0.0 && microtime( true ) > $deadline ) {
				return $this->save_day_progress( $day, self::PHASE_DIMENSIONS, $cursor );
			}
		}
		// phpcs:enable

		return self::BUILD_DONE;
	}

	/**
	 * Build visitor bitmaps for the page scope.
	 *
	 * @param \DateTimeImmutable $day      Site-timezone day (00:00).
	 * @param int                $start    Day start timestamp.
	 * @param int                $end      Day end timestamp.
	 * @param int                $cursor   Last processed page ID, or 0 to start.
	 * @param float              $deadline Monotonic microtime budget ceiling.
	 * @return string One of BUILD_DONE, BUILD_PAUSED, BUILD_FAILED.
	 */
	private function build_page_phase( \DateTimeImmutable $day, int $start, int $end, int $cursor, float $deadline ): string {
		global $wpdb;

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table names, integer id lists, values prepared.
		if ( 0 === $cursor ) {
			$is_deleted = $this->run_write(
				$wpdb->prepare(
					"DELETE FROM {$wpdb->prefix}burst_visitor_bitmaps WHERE day = %s AND scope = %s",
					$day->format( 'Y-m-d' ),
					self::SCOPE_PAGE
				)
			);
			if ( ! $is_deleted ) {
				return self::BUILD_FAILED;
			}

			$is_registered = $this->run_write(
				$wpdb->prepare(
					"INSERT IGNORE INTO {$wpdb->prefix}burst_page_urls (page_url)
					SELECT DISTINCT page_url FROM {$wpdb->prefix}burst_statistics
					WHERE time >= %d AND time < %d AND page_url != '' AND page_type != '404'",
					$start,
					$end
				)
			);
			if ( ! $is_registered ) {
				return self::BUILD_FAILED;
			}
		}

		$page_ids = array_map(
			'intval',
			$wpdb->get_col(
				$wpdb->prepare(
					"SELECT DISTINCT d.ID
					FROM {$wpdb->prefix}burst_statistics st
					JOIN {$wpdb->prefix}burst_page_urls d ON st.page_url = d.page_url
					WHERE st.time >= %d AND st.time < %d AND st.uid_id > 0 AND st.page_type != '404' AND d.ID > %d
					ORDER BY d.ID ASC",
					$start,
					$end,
					$cursor
				)
			)
		);
		if ( ! empty( $wpdb->last_error ) ) {
			return self::BUILD_FAILED;
		}

		if ( empty( $page_ids ) ) {
			return self::BUILD_DONE;
		}

		$page_chunk_size = (int) apply_filters( 'burst_bitmaps_page_chunk_size', self::PAGE_CHUNK_SIZE );
		$chunks          = array_chunk( $page_ids, $page_chunk_size );

		foreach ( $chunks as $chunk_index => $page_chunk ) {
			$page_sets = $this->fetch_page_sets( $page_chunk, $start, $end );
			if ( null === $page_sets ) {
				return self::BUILD_FAILED;
			}

			$value_sets = [];
			foreach ( $page_sets as $page_id => $uid_set ) {
				$value_sets[ $page_id ] = array_keys( $uid_set );
			}
			if ( ! $this->store_day_sets( self::SCOPE_PAGE, $value_sets, $day ) ) {
				return self::BUILD_FAILED;
			}

			$cursor = (int) end( $page_chunk );

			$is_last_chunk = ( $chunk_index === count( $chunks ) - 1 );
			if ( ! $is_last_chunk && $deadline > 0.0 && microtime( true ) > $deadline ) {
				return $this->save_day_progress( $day, self::PHASE_PAGES, $cursor );
			}
		}
		// phpcs:enable

		return self::BUILD_DONE;
	}

	/**
	 * Read the (device, browser, platform) values of one chunk of visitors.
	 * The IN () list is split by chunk_ids_for_in_list(): a 10,000-id list is
	 * ~80 KB of SQL, and a host that caps the query length (WP Engine's long
	 * query governor) never runs it. wpdb then returns the previous query's
	 * result without an error, so the day was marked built without its
	 * dimension rows. The sub-chunks partition the visitors, so their rows
	 * add up to the result of the single query.
	 *
	 * @param int[] $uid_chunk Visitor uid_ids of this chunk.
	 * @param int   $start     Day start timestamp.
	 * @param int   $end       Day end timestamp.
	 * @return array<string, array<int, array<int, true>>>|null scope => value_id => uid set, or null on a query error.
	 */
	private function fetch_dimension_sets( array $uid_chunk, int $start, int $end ): ?array {
		global $wpdb;
		$sets = [];
		foreach ( $this->chunk_ids_for_in_list( $uid_chunk ) as $uid_ids ) {
			$uid_in = implode( ',', $uid_ids );
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table names, integer id list, values prepared.
			$combos = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT DISTINCT st.uid_id, s.device_id, s.browser_id, s.platform_id
					FROM {$wpdb->prefix}burst_statistics st
					INNER JOIN {$wpdb->prefix}burst_sessions s ON st.session_id = s.ID
					WHERE st.time >= %d AND st.time < %d AND st.page_type != '404' AND st.uid_id IN ({$uid_in})",
					$start,
					$end
				),
				ARRAY_A
			);
			// phpcs:enable
			if ( ! empty( $wpdb->last_error ) ) {
				return null;
			}

			foreach ( $combos as $combo ) {
				$uid = (int) $combo['uid_id'];
				foreach ( self::DIMENSION_SCOPES as [ $scope, $column ] ) {
					$value_id = (int) $combo[ $column ];
					if ( $value_id > 0 ) {
						$sets[ $scope ][ $value_id ][ $uid ] = true;
					}
				}
			}
		}

		return $sets;
	}

	/**
	 * Read the visitors of one chunk of pages (burst_page_urls ids). The IN ()
	 * list is split by chunk_ids_for_in_list() so a raised
	 * burst_bitmaps_page_chunk_size never exceeds a host's query length cap
	 * (see fetch_dimension_sets()).
	 *
	 * @param int[] $page_chunk Dictionary ids of this chunk.
	 * @param int   $start      Day start timestamp.
	 * @param int   $end        Day end timestamp.
	 * @return array<int, array<int, true>>|null page id => uid set, or null on a query error.
	 */
	private function fetch_page_sets( array $page_chunk, int $start, int $end ): ?array {
		global $wpdb;
		$page_sets = [];
		foreach ( $this->chunk_ids_for_in_list( $page_chunk ) as $page_ids ) {
			$page_in = implode( ',', $page_ids );
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table names, integer id list, values prepared.
			$page_pairs = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT DISTINCT d.ID AS page_id, st.uid_id
					FROM {$wpdb->prefix}burst_statistics st
					JOIN {$wpdb->prefix}burst_page_urls d ON st.page_url = d.page_url
					WHERE st.time >= %d AND st.time < %d AND st.uid_id > 0 AND st.page_type != '404' AND d.ID IN ({$page_in})",
					$start,
					$end
				),
				ARRAY_A
			);
			// phpcs:enable
			if ( ! empty( $wpdb->last_error ) ) {
				return null;
			}

			foreach ( $page_pairs as $pair ) {
				$page_sets[ (int) $pair['page_id'] ][ (int) $pair['uid_id'] ] = true;
			}
		}

		return $page_sets;
	}

	/**
	 * Build (or replace) the bitmaps for one closed day: the site scope, one
	 * set per dimension value (device/browser/platform), and one set per page.
	 *
	 * 404 hits are excluded throughout: the raw visitors path never counts
	 * them, and the bitmap answer must match it exactly.
	 *
	 * Reads and writes are chunked and resumable: if the deadline is exceeded
	 * between chunks, a checkpoint is saved and BUILD_PAUSED returned so the
	 * follow-up iteration can continue without restarting the day.
	 *
	 * @param \DateTimeImmutable $day      Site-timezone day (00:00).
	 * @param float              $deadline Monotonic microtime budget ceiling.
	 * @return string One of BUILD_DONE, BUILD_PAUSED, BUILD_FAILED.
	 */
	private function build_day( \DateTimeImmutable $day, float $deadline = 0.0 ): string {
		$start = $day->getTimestamp();
		$end   = $day->modify( '+1 day' )->getTimestamp();

		$progress = get_option( self::DAY_PROGRESS_OPTION );
		if ( is_array( $progress ) && isset( $progress['day'] ) && $progress['day'] === $day->format( 'Y-m-d' ) ) {
			$phase  = (string) ( $progress['phase'] ?? self::PHASE_SITE );
			$cursor = (int) ( $progress['cursor'] ?? 0 );
		} else {
			$phase  = self::PHASE_SITE;
			$cursor = 0;
		}

		$uids = [];
		if ( self::PHASE_SITE === $phase ) {
			$uids = $this->build_site_phase( $day, $start, $end );
			if ( null === $uids ) {
				return self::BUILD_FAILED;
			}
			if ( empty( $uids ) ) {
				return self::BUILD_DONE;
			}

			$phase  = self::PHASE_DIMENSIONS;
			$cursor = 0;

			if ( $deadline > 0.0 && microtime( true ) > $deadline ) {
				return $this->save_day_progress( $day, self::PHASE_DIMENSIONS, 0 );
			}
		}

		if ( self::PHASE_DIMENSIONS === $phase ) {
			$dim_status = $this->build_dimension_phase( $day, $start, $end, $cursor, $deadline, $uids );
			if ( self::BUILD_DONE !== $dim_status ) {
				return $dim_status;
			}

			$phase  = self::PHASE_PAGES;
			$cursor = 0;

			if ( $deadline > 0.0 && microtime( true ) > $deadline ) {
				return $this->save_day_progress( $day, self::PHASE_PAGES, 0 );
			}
		}

		if ( self::PHASE_PAGES === $phase ) {
			$page_status = $this->build_page_phase( $day, $start, $end, $cursor, $deadline );
			if ( self::BUILD_DONE !== $page_status ) {
				return $page_status;
			}
		}

		return self::BUILD_DONE;
	}

	/**
	 * OR-merge one uid-chunk's partial dimension sets into the day's stored
	 * rows. The chunks partition the day's distinct visitors, so within one
	 * build run the incoming uids are disjoint from what earlier chunks stored
	 * — the merge only ever adds bits (rows from a previously failed run are
	 * deleted before the first chunk, see build_day()). The union work stays on
	 * raw blobs (gzuncompress, byte-wise OR, popcount — all C-speed), so a
	 * flush never expands a large stored set into a PHP array.
	 *
	 * Returns false on the first failed read, decode, encode or write — the
	 * caller then fails the day, keeping built_until on the previous day.
	 *
	 * @param array<string, array<int, array<int, true>>> $sets scope => value_id => uid set.
	 * @param \DateTimeImmutable                          $day  Site-timezone day.
	 */
	private function merge_dimension_chunk( array $sets, \DateTimeImmutable $day ): bool {
		global $wpdb;
		$day_string = $day->format( 'Y-m-d' );

		foreach ( $sets as $scope => $values ) {
			// What earlier chunks stored for these values. Dimension
			// cardinality is small (a handful of devices, browsers,
			// platforms), so this fetch is a few rows at most.
			$value_in = implode( ',', array_map( 'intval', array_keys( $values ) ) );
            // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table name, integer id list, values prepared.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT value_id, format, data FROM {$wpdb->prefix}burst_visitor_bitmaps
					WHERE scope = %s AND day = %s AND value_id IN ({$value_in})",
					$scope,
					$day_string
				),
				ARRAY_A
			);
            // phpcs:enable
			if ( ! empty( $wpdb->last_error ) ) {
				return false;
			}
			$existing = [];
			foreach ( $rows as $row ) {
				$existing[ (int) $row['value_id'] ] = $row;
			}
			unset( $rows );

			$encoded = [];
			foreach ( $values as $value_id => $uid_set ) {
				$union = '';
				if ( isset( $existing[ $value_id ] ) ) {
					$blob = gzuncompress( (string) $existing[ $value_id ]['data'] );
					if ( false === $blob ) {
						// A row this run just wrote failing to decode is fatal
						// for the day, like a failed encode: merging into a
						// fresh set would silently drop earlier chunks' bits.
						self::error_log( "visitor bitmaps: merging {$scope}/{$value_id} for {$day_string} failed to decode" );
						return false;
					}
					$union = (int) $existing[ $value_id ]['format'] === self::FORMAT_BITMAP
						? $blob
						: $this->or_list( '', $blob );
				}
				$union   = $this->or_list( $union, pack( 'V*', ...array_keys( $uid_set ) ) );
				$members = $this->popcount( $union );

				[ $format, $data ] = $this->encode_union( $union, $members );
				if ( null === $data ) {
					self::error_log( "visitor bitmaps: encoding {$scope}/{$value_id} for {$day_string} failed" );
					return false;
				}
				$encoded[ $value_id ] = [ $format, $members, $data ];
			}
			if ( ! $this->store_encoded_sets( $scope, $encoded, $day_string ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Encode and upsert many (value_id => uid set) rows for one scope and day.
	 * Encoding happens per storage chunk so at most 200 blobs are in flight at
	 * once. Returns false on the first failed encode or write, so the caller
	 * never marks the day built on a partial store.
	 *
	 * @param string             $scope Scope key.
	 * @param array<int, int[]>  $sets  value_id => dictionary ids.
	 * @param \DateTimeImmutable $day   Site-timezone day.
	 */
	private function store_day_sets( string $scope, array $sets, \DateTimeImmutable $day ): bool {
		$day_string = $day->format( 'Y-m-d' );

		foreach ( array_chunk( $sets, 200, true ) as $chunk ) {
			$encoded = [];
			foreach ( $chunk as $value_id => $uids ) {
				[ $format, $data ] = $this->encode( $uids );
				if ( null === $data ) {
					self::error_log( "visitor bitmaps: encoding {$scope}/{$value_id} for {$day_string} failed" );
					return false;
				}
				$encoded[ $value_id ] = [ $format, count( $uids ), $data ];
			}
			if ( ! $this->store_encoded_sets( $scope, $encoded, $day_string ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Upsert pre-encoded (value_id => [format, members, data]) rows for one
	 * scope and day in chunked multi-row statements — one INSERT per page or
	 * dimension value would make the builder O(pages) queries per day. Shared
	 * by the direct store path (store_day_sets) and the per-chunk dimension
	 * merge (merge_dimension_chunk).
	 *
	 * @param string                                       $scope      Scope key.
	 * @param array<int, array{0: int, 1: int, 2: string}> $rows       value_id => [format, members, data].
	 * @param string                                       $day_string Site-timezone day (Y-m-d).
	 */
	private function store_encoded_sets( string $scope, array $rows, string $day_string ): bool {
		global $wpdb;

		foreach ( array_chunk( $rows, 200, true ) as $chunk ) {
			$placeholders = [];
			$values       = [];
			foreach ( $chunk as $value_id => [ $format, $members, $data ] ) {
				$placeholders[] = '(%s,%d,%s,%d,%d,%s)';
				array_push( $values, $scope, (int) $value_id, $day_string, $format, $members, $data );
			}

			$sql = "INSERT INTO {$wpdb->prefix}burst_visitor_bitmaps (scope, value_id, day, format, members, data) VALUES "
				. implode( ',', $placeholders )
				. ' ON DUPLICATE KEY UPDATE format = VALUES(format), members = VALUES(members), data = VALUES(data)';
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- fixed table name, row values prepared.
			if ( ! $this->run_write( $wpdb->prepare( $sql, $values ) ) ) {
				self::error_log( "visitor bitmaps: storing {$scope} rows for {$day_string} failed: " . ( $wpdb->last_error ?: 'the query was not run' ) );
				return false;
			}
		}

		return true;
	}

	/**
	 * Run one write of a day build and report whether it ran. wpdb returns
	 * false without setting last_error in two cases: a `query` filter
	 * dropped the statement (an empty query is never sent), or the
	 * connection was lost and the reconnect failed (flush() already cleared
	 * the error). Checking last_error alone then reads a skipped write as a
	 * success, and the day is marked built with rows missing.
	 *
	 * Side effect: runs the statement.
	 *
	 * @param string $sql Prepared SQL statement.
	 * @return bool True when the statement ran without an error.
	 */
	private function run_write( string $sql ): bool {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared -- callers pass prepared SQL.
		$result = $wpdb->query( $sql );
		return false !== $result && empty( $wpdb->last_error );
	}

	/**
	 * Encode a set of uid ids as [format, gzip-ed blob]. Data is null when
	 * compression fails — the caller must treat that as fatal for the day, or
	 * an empty blob with members > 0 would poison every range containing it.
	 *
	 * @param int[] $uids Dictionary ids.
	 * @return array{0: int, 1: string|null}
	 */
	private function encode( array $uids ): array {
		if ( count( $uids ) <= self::DENSE_THRESHOLD ) {
			sort( $uids );
			$data = gzcompress( pack( 'V*', ...$uids ) );
			return [ self::FORMAT_LIST, false === $data ? null : $data ];
		}

		$max    = max( $uids );
		$bitmap = str_repeat( "\0", intdiv( $max, 8 ) + 1 );
		foreach ( $uids as $uid ) {
			$bitmap[ $uid >> 3 ] = chr( ord( $bitmap[ $uid >> 3 ] ) | ( 1 << ( $uid & 7 ) ) );
		}
		$data = gzcompress( $bitmap );
		return [ self::FORMAT_BITMAP, false === $data ? null : $data ];
	}

	/**
	 * Encode a dense union bitmap as [format, gzip-ed blob], mirroring
	 * encode()'s density choice so a merged row is indistinguishable from a
	 * directly built one: large sets store the dense bitmap as-is, small sets
	 * are converted back to the packed sorted list. Data is null when
	 * compression fails — fatal for the day, like encode().
	 *
	 * @param string $union   Dense bitmap (bit N = uid_id N present).
	 * @param int    $members Set-bit count of $union.
	 * @return array{0: int, 1: string|null}
	 */
	private function encode_union( string $union, int $members ): array {
		if ( $members > self::DENSE_THRESHOLD ) {
			$data = gzcompress( $union );
			return [ self::FORMAT_BITMAP, false === $data ? null : $data ];
		}
		return $this->encode( $this->bitmap_to_list( $union ) );
	}

	/**
	 * Expand a dense bitmap into the uid ids of its set bits, ascending. Only
	 * called for small sets (<= DENSE_THRESHOLD members); the byte loop skips
	 * the zero bytes that dominate a sparse bitmap.
	 *
	 * @return int[]
	 */
	private function bitmap_to_list( string $bitmap ): array {
		$uids   = [];
		$length = strlen( $bitmap );
		for ( $i = 0; $i < $length; $i++ ) {
			$byte = ord( $bitmap[ $i ] );
			if ( 0 === $byte ) {
				continue;
			}
			$base = $i << 3;
			for ( $bit = 0; $bit < 8; $bit++ ) {
				if ( 0 !== ( $byte & ( 1 << $bit ) ) ) {
					$uids[] = $base | $bit;
				}
			}
		}
		return $uids;
	}

	/**
	 * Exact distinct visitors for the period, or null when the bitmaps cannot
	 * answer it (dictionary migration pending, builder not caught up, the range
	 * does not align to site-timezone day boundaries, or the filters are not a
	 * single dimension this store covers) — the caller then falls back to its
	 * regular query.
	 *
	 * Closed days come from the store (OR-merged); the part of the range on or
	 * after today is fetched live from statistics and merged in, so the count
	 * stays exact up to the second (lambda pattern).
	 *
	 * A single dimension filter (device/browser/platform) is answered exactly
	 * from that dimension's sets. Multiple filters are refused: intersecting
	 * day-level sets would count a visitor who matched the dimensions in
	 * separate sessions on the same day, which row-level filtering does not.
	 * Filter values arrive raw from the REST layer here — exclusions ('!'),
	 * wildcards ('*') and comma lists are only decoded later by the query
	 * sanitizer, so any non-plain value is refused (SQL fallback) rather than
	 * misread as a literal. Date/filter clamping for share-link viewers happens
	 * at the REST layer only on this path; callers outside REST must clamp
	 * viewer input themselves.
	 *
	 * @param int   $start   Range start (unix timestamp, inclusive).
	 * @param int   $end     Range end (unix timestamp, inclusive).
	 * @param array $filters Active filters (filter key => value).
	 */
	public function get_visitors( int $start, int $end, array $filters = [] ): ?int {
		global $wpdb;
		$this->last_miss_reason = '';

		$range = $this->resolve_readable_range( $start, $end );
		if ( null === $range ) {
			return null;
		}
		$today          = $range['today'];
		$coverage_start = $range['coverage_start'];
		$closed_until   = $range['closed_until'];
		$end_in_tail    = $range['end_in_tail'];
		$expected_days  = $range['expected_days'];
		$generation     = $range['generation'];

		$scope           = self::SCOPE_SITE;
		$value_id        = 0;
		$value_ids       = [];
		$filter_column   = '';
		$page_filter_url = '';
		$page_ids        = [];
		if ( ! empty( $filters ) ) {
			if ( count( $filters ) !== 1 ) {
				$this->miss( 'multiple-filters' );
				return null;
			}
			$filter_key   = array_key_first( $filters );
			$filter_value = $filters[ $filter_key ];
			if ( 'page_url' === $filter_key ) {
				if ( ! is_string( $filter_value ) || '' === $filter_value || ! $this->is_plain_filter_value( $filter_value ) ) {
					$this->miss( 'unsupported-filter-value' );
					return null;
				}
				$scope           = self::SCOPE_PAGE;
				$page_filter_url = $filter_value;
				// Under page grain the page filter selects every url of the
				// page (see page_grain_ids_for_url()), so the page scope ORs
				// the day sets of all those urls and the live tail filters on
				// the same page_ids — the count then matches the row query.
				$page_ids  = $this->page_grain_ids_for_url( $filter_value );
				$value_ids = $this->page_scope_value_ids( $page_ids );
				$value_id  = $value_ids[0] ?? 0;
				if ( empty( $page_ids ) ) {
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
					$value_id = (int) $wpdb->get_var( $wpdb->prepare( "SELECT ID FROM {$wpdb->prefix}burst_page_urls WHERE page_url = %s", $filter_value ) );
				}
				// A dictionary miss (typically a page whose first traffic is
				// today — the closed-day builder registers URLs) falls back to
				// SQL: proceeding with value_id 0 would make every unmapped URL
				// share one result cache key, serving page A's count for page B.
				if ( 0 === $value_id ) {
					$this->miss( 'page-not-in-dictionary' );
					return null;
				}
			} elseif ( isset( self::DIMENSION_SCOPES[ $filter_key ] ) && is_scalar( $filter_value ) && ctype_digit( (string) $filter_value ) && (int) $filter_value > 0 ) {
				[ $scope, $filter_column ] = self::DIMENSION_SCOPES[ $filter_key ];
				$value_id                  = (int) $filter_value;
			} else {
				$this->miss( 'unsupported-filter' );
				return null;
			}
		}

		// Cache layer 1: the final count for this exact request, short-lived
		// because the live tail below moves. Every dashboard block selecting
		// visitors (current and compare period) calls this per render — without
		// caching, the today-scan in the tail is exactly the query the store
		// was built to remove.
		$value_ids  = ! empty( $value_ids ) ? $value_ids : [ $value_id ];
		$value_key  = 1 === count( $value_ids ) ? (string) $value_ids[0] : substr( hash( 'sha256', implode( ',', $value_ids ) ), 0, 16 );
		$result_key = "burst_bitmap_count_{$scope}_{$value_key}_{$start}_{$end}_{$generation}";
		$found      = false;
		$cached     = wp_cache_get( $result_key, 'burst', false, $found );
		if ( $found && is_int( $cached ) ) {
			return $cached;
		}

		if ( ! $this->verify_site_coverage( $coverage_start, $closed_until, $expected_days ) ) {
			return null;
		}

		// Cache layer 2: one closed-day union per dictionary id; a page scope
		// ORs the unions of every url of the page (see page_scope_value_ids()).
		$union = '';
		foreach ( $value_ids as $union_value_id ) {
			$id_union = $this->load_closed_day_union( $scope, $union_value_id, $coverage_start, $closed_until, $expected_days, $generation );
			if ( null === $id_union ) {
				return null;
			}
			$union = $this->or_bitmaps( $union, $id_union );
		}

		// Live tail: today (and any part of the range beyond it), with the
		// dimension filter applied at row level when one is active.
		if ( $end_in_tail ) {
			$tail_start = max( $start, $today->getTimestamp() );
			if ( ! empty( $page_ids ) ) {
				// Integers only, cast in page_grain_ids_for_url().
				$page_id_list = implode( ',', array_map( 'intval', $page_ids ) );
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- integer id list.
				$tail_sql = $wpdb->prepare(
					"SELECT DISTINCT uid_id FROM {$wpdb->prefix}burst_statistics WHERE time >= %d AND time <= %d AND uid_id > 0 AND page_type != '404' AND page_id IN ({$page_id_list})",
					$tail_start,
					$end
				);
                // phpcs:enable
			} elseif ( '' !== $page_filter_url ) {
				$tail_sql = $wpdb->prepare(
					"SELECT DISTINCT uid_id FROM {$wpdb->prefix}burst_statistics WHERE time >= %d AND time <= %d AND uid_id > 0 AND page_type != '404' AND page_url = %s",
					$tail_start,
					$end,
					$page_filter_url
				);
			} elseif ( '' !== $filter_column ) {
                // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $filter_column is a fixed column name from the DIMENSION_SCOPES constant; values are prepared.
				$tail_sql = $wpdb->prepare(
					"SELECT DISTINCT st.uid_id FROM {$wpdb->prefix}burst_statistics st
					INNER JOIN {$wpdb->prefix}burst_sessions s ON st.session_id = s.ID
					WHERE st.time >= %d AND st.time <= %d AND st.uid_id > 0 AND st.page_type != '404' AND s.{$filter_column} = %d",
					$tail_start,
					$end,
					$value_id
				);
                // phpcs:enable
			} else {
				$tail_sql = $wpdb->prepare(
					"SELECT DISTINCT uid_id FROM {$wpdb->prefix}burst_statistics WHERE time >= %d AND time <= %d AND uid_id > 0 AND page_type != '404'",
					$tail_start,
					$end
				);
			}
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- prepared above.
			$tail_uids = array_map( 'intval', $wpdb->get_col( $tail_sql ) );
			$union     = $this->or_list( $union, pack( 'V*', ...$tail_uids ) );
		}

		$count = $this->popcount( $union );
		wp_cache_set( $result_key, $count, 'burst', 30 );
		return $count;
	}

	/**
	 * Exact distinct visitors per site-timezone day over the period, or null
	 * when the store cannot answer it — the caller then keeps the metric in
	 * its regular query. Unfiltered site scope only: the series feeds the
	 * insights chart's default day-grain view; filtered variants stay on SQL.
	 *
	 * Closed days read one integer each (the precomputed members column — no
	 * blob decoding), so a multi-year series is a single cheap indexed read;
	 * today is counted live so the series stays exact up to the second, like
	 * get_visitors(). Days before the site's first built day and days after
	 * today fill as zero.
	 *
	 * @param int $start Range start (unix timestamp, inclusive).
	 * @param int $end   Range end (unix timestamp, inclusive).
	 * @return array<string, int>|null Day ('Y-m-d', site timezone) => visitors.
	 */
	public function get_visitors_by_day( int $start, int $end ): ?array {
		global $wpdb;
		$this->last_miss_reason = '';

		$range = $this->resolve_readable_range( $start, $end );
		if ( null === $range ) {
			return null;
		}
		$today          = $range['today'];
		$coverage_start = $range['coverage_start'];
		$closed_until   = $range['closed_until'];
		$end_in_tail    = $range['end_in_tail'];

		// Short-lived result cache: the live today count below moves, and the
		// chart requests this per dashboard render.
		$result_key = "burst_bitmap_series_site_{$start}_{$end}_{$range['generation']}";
		$found      = false;
		$cached     = wp_cache_get( $result_key, 'burst', false, $found );
		if ( $found && is_array( $cached ) ) {
			return $cached;
		}

		if ( ! $this->verify_site_coverage( $coverage_start, $closed_until, $range['expected_days'] ) ) {
			return null;
		}

		// Zero-fill every requested day from the ORIGINAL start (days before
		// the first built day chart as zero, they are not clamped away here):
		// absent store rows mean zero visitors, and the chart needs a value
		// per slot either way.
		$timezone  = wp_timezone();
		$series    = [];
		$first_day = ( new \DateTimeImmutable( '@' . $start ) )->setTimezone( $timezone );
		$final_day = ( new \DateTimeImmutable( '@' . $end ) )->setTimezone( $timezone )->setTime( 0, 0 );
		for ( $day = $first_day; $day <= $final_day; $day = $day->modify( '+1 day' ) ) {
			$series[ $day->format( 'Y-m-d' ) ] = 0;
		}

		if ( $range['expected_days'] > 0 ) {
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT day, members FROM {$wpdb->prefix}burst_visitor_bitmaps
					WHERE scope = %s AND value_id = 0 AND day BETWEEN %s AND %s",
					self::SCOPE_SITE,
					$coverage_start->format( 'Y-m-d' ),
					$closed_until->format( 'Y-m-d' )
				),
				ARRAY_A
			);
			// phpcs:enable
			foreach ( $rows as $row ) {
				$day = (string) $row['day'];
				if ( isset( $series[ $day ] ) ) {
					$series[ $day ] = (int) $row['members'];
				}
			}
		}

		// Live count for today only — days after today cannot hold rows and
		// stay at their zero fill.
		if ( $end_in_tail ) {
			$tail_start = max( $start, $today->getTimestamp() );
			$tail_end   = min( $end, $today->modify( '+1 day' )->getTimestamp() - 1 );
			if ( $tail_end >= $tail_start ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				$series[ $today->format( 'Y-m-d' ) ] = (int) $wpdb->get_var(
					$wpdb->prepare(
						"SELECT COUNT(DISTINCT uid_id) FROM {$wpdb->prefix}burst_statistics WHERE time >= %d AND time <= %d AND uid_id > 0 AND page_type != '404'",
						$tail_start,
						$tail_end
					)
				);
			}
		}

		wp_cache_set( $result_key, $series, 'burst', 30 );
		return $series;
	}

	/**
	 * Exact distinct visitors per dimension value (device/browser/platform)
	 * over the period, or null when the store cannot answer it — the caller
	 * then falls back to its SQL path. One coverage check and one live-tail
	 * scan serve every value at once, where a per-value get_visitors() loop
	 * would pay both once per value.
	 *
	 * @param string $filter_key One of the DIMENSION_SCOPES keys (e.g. 'device_id').
	 * @param int    $start      Range start (unix timestamp, inclusive, day-aligned).
	 * @param int    $end        Range end (unix timestamp, inclusive).
	 * @return array<int, int>|null value_id => visitors (only values with visitors), or null for the SQL fallback.
	 */
	public function get_visitors_by_dimension( string $filter_key, int $start, int $end ): ?array {
		global $wpdb;
		$this->last_miss_reason = '';

		if ( ! isset( self::DIMENSION_SCOPES[ $filter_key ] ) ) {
			$this->miss( 'unsupported-filter' );
			return null;
		}
		[ $scope, $filter_column ] = self::DIMENSION_SCOPES[ $filter_key ];

		$range = $this->resolve_readable_range( $start, $end );
		if ( null === $range ) {
			return null;
		}

		// Short-lived result cache: the live tail below moves.
		$result_key = "burst_bitmap_dimension_{$scope}_{$start}_{$end}_{$range['generation']}";
		$found      = false;
		$cached     = wp_cache_get( $result_key, 'burst', false, $found );
		if ( $found && is_array( $cached ) ) {
			return $cached;
		}

		if ( ! $this->verify_site_coverage( $range['coverage_start'], $range['closed_until'], $range['expected_days'] ) ) {
			return null;
		}

		// Closed days: OR every value's day sets into one union per value, in
		// bounded chunks (keyset on the primary key — a day holds one row per
		// value in this scope).
		$unions = [];
		if ( $range['expected_days'] > 0 ) {
			$last_row_id = 0;
			do {
				// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
				$rows = $wpdb->get_results(
					$wpdb->prepare(
						"SELECT ID, value_id, format, data FROM {$wpdb->prefix}burst_visitor_bitmaps
						WHERE scope = %s AND day BETWEEN %s AND %s AND members > 0 AND ID > %d
						ORDER BY ID LIMIT 200",
						$scope,
						$range['coverage_start']->format( 'Y-m-d' ),
						$range['closed_until']->format( 'Y-m-d' ),
						$last_row_id
					),
					ARRAY_A
				);
				// phpcs:enable
				$row_count = count( $rows );
				foreach ( $rows as $row ) {
					$blob = gzuncompress( (string) $row['data'] );
					if ( false === $blob ) {
						$this->miss( 'corrupt-day' );
						return null;
					}
					$value_id            = (int) $row['value_id'];
					$existing            = $unions[ $value_id ] ?? '';
					$unions[ $value_id ] = (int) $row['format'] === self::FORMAT_BITMAP
						? $this->or_bitmaps( $existing, $blob )
						: $this->or_list( $existing, $blob );
					$last_row_id         = (int) $row['ID'];
				}
			} while ( 200 === $row_count );
		}

		// Live tail: one pass over today's hits collects the distinct
		// (value, visitor) pairs for every value at once.
		if ( $range['end_in_tail'] ) {
			$tail_start = max( $start, $range['today']->getTimestamp() );
            // phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $filter_column is a fixed column name from the DIMENSION_SCOPES constant; values are prepared.
			$pairs = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT DISTINCT s.{$filter_column} AS value_id, st.uid_id
					FROM {$wpdb->prefix}burst_statistics st
					INNER JOIN {$wpdb->prefix}burst_sessions s ON st.session_id = s.ID
					WHERE st.time >= %d AND st.time <= %d AND st.uid_id > 0 AND st.page_type != '404' AND s.{$filter_column} > 0",
					$tail_start,
					$end
				),
				ARRAY_A
			);
            // phpcs:enable
			$tail_uids = [];
			foreach ( $pairs as $pair ) {
				$tail_uids[ (int) $pair['value_id'] ][] = (int) $pair['uid_id'];
			}
			foreach ( $tail_uids as $value_id => $uids ) {
				$unions[ $value_id ] = $this->or_list( $unions[ $value_id ] ?? '', pack( 'V*', ...$uids ) );
			}
		}

		$counts = [];
		foreach ( $unions as $value_id => $union ) {
			$count = $this->popcount( $union );
			if ( $count > 0 ) {
				$counts[ $value_id ] = $count;
			}
		}

		wp_cache_set( $result_key, $counts, 'burst', 30 );
		return $counts;
	}

	/**
	 * The page-scope bitmap value ids (burst_page_urls.ID, one day set per
	 * url) holding the visitors of the given statistics page_ids: every url
	 * row of a post id, and the row itself for a negative dictionary id.
	 *
	 * @param int[] $page_ids Page ids from page_grain_ids_for_url().
	 * @return int[] Dictionary ids, empty when $page_ids is empty.
	 */
	private function page_scope_value_ids( array $page_ids ): array {
		global $wpdb;
		$value_ids = [];
		$post_ids  = [];
		foreach ( $page_ids as $page_id ) {
			if ( $page_id < 0 ) {
				$value_ids[] = -$page_id;
			} elseif ( $page_id > 0 ) {
				$post_ids[] = $page_id;
			}
		}
		if ( ! empty( $post_ids ) ) {
			$id_list = implode( ',', array_map( 'intval', $post_ids ) );
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- integer id list.
			$value_ids = array_merge( $value_ids, array_map( 'intval', $wpdb->get_col( "SELECT ID FROM {$wpdb->prefix}burst_page_urls WHERE page_id IN ({$id_list})" ) ) );
		}
		$value_ids = array_values( array_unique( $value_ids ) );
		sort( $value_ids );
		return $value_ids;
	}

	/**
	 * The OR-merged closed-day visitor set of one scope value, from the object
	 * cache or the store. Closed days are immutable, so the cached union can
	 * live long — the generation in the key invalidates it when the store
	 * itself is rebuilt (timezone reset, archive, rebuild-from).
	 *
	 * @param string             $scope          Bitmap scope.
	 * @param int                $value_id       Scope value (dictionary or dimension id, 0 for site).
	 * @param \DateTimeImmutable $coverage_start First closed day in range.
	 * @param \DateTimeImmutable $closed_until   Last closed day in range.
	 * @param int                $expected_days  Closed days in range; 0 = none.
	 * @param string             $generation     Store generation.
	 * @return string|null Dense bitmap ('' when empty), or null on a corrupt day row (miss reason set).
	 */
	private function load_closed_day_union( string $scope, int $value_id, \DateTimeImmutable $coverage_start, \DateTimeImmutable $closed_until, int $expected_days, string $generation ): ?string {
		global $wpdb;
		$union        = '';
		$union_loaded = false;
		$union_key    = "burst_bitmap_union_{$scope}_{$value_id}_{$coverage_start->format( 'Ymd' )}_{$closed_until->format( 'Ymd' )}_{$generation}";
		if ( $expected_days > 0 ) {
			$cached_union = wp_cache_get( $union_key, 'burst' );
			if ( is_string( $cached_union ) ) {
				$blob = gzuncompress( $cached_union );
				if ( false !== $blob ) {
					$union        = $blob;
					$union_loaded = true;
				}
			}
		}

		if ( ! $union_loaded && $expected_days > 0 ) {
			// Fetch the day blobs in bounded chunks: a multi-year range holds
			// hundreds of rows whose decompressed sets should never sit in one
			// result array at once. The keyset cursor starts one day before the
			// range: strict SQL mode rejects '' as a DATE value.
			$last_day = $coverage_start->modify( '-1 day' )->format( 'Y-m-d' );
			do {
				$rows      = $wpdb->get_results(
					$wpdb->prepare(
						"SELECT day, format, members, data FROM {$wpdb->prefix}burst_visitor_bitmaps
						WHERE scope = %s AND value_id = %d AND day BETWEEN %s AND %s AND day > %s AND members > 0
						ORDER BY day LIMIT 50",
						$scope,
						$value_id,
						$coverage_start->format( 'Y-m-d' ),
						$closed_until->format( 'Y-m-d' ),
						$last_day
					),
					ARRAY_A
				);
				$row_count = count( $rows );
				foreach ( $rows as $row ) {
					$blob = gzuncompress( (string) $row['data'] );
					if ( false === $blob ) {
						$this->miss( 'corrupt-day' );
						return null;
					}
					if ( (int) $row['format'] === self::FORMAT_BITMAP ) {
						$union = $this->or_bitmaps( $union, $blob );
					} else {
						$union = $this->or_list( $union, $blob );
					}
					$last_day = (string) $row['day'];
				}
			} while ( 50 === $row_count );

			$compressed_union = gzcompress( $union );
			if ( false !== $compressed_union ) {
				wp_cache_set( $union_key, $compressed_union, 'burst', 6 * HOUR_IN_SECONDS );
			}
		}

		return $union;
	}

	/**
	 * Shared read-side gate for the store readers: validates the uid migration
	 * state and site-timezone day alignment, checks store readiness, clamps
	 * the coverage window to the first built day (days before it contribute
	 * nothing: the builder starts at the site's first hit ever, and the
	 * archiver deletes leading day rows along with the raw data — the raw
	 * path sees no rows there either) and computes the closed window. Returns
	 * null — with the miss reason set — when the store cannot serve the range.
	 *
	 * @return array{today: \DateTimeImmutable, coverage_start: \DateTimeImmutable, closed_until: \DateTimeImmutable, end_in_tail: bool, expected_days: int, generation: string}|null
	 */
	private function resolve_readable_range( int $start, int $end ): ?array {
		global $wpdb;

		if ( ! $this->uid_id_active() ) {
			$this->miss( 'uid-migration-pending' );
			return null;
		}
		if ( $start <= 0 || $end <= $start ) {
			$this->miss( 'invalid-range' );
			return null;
		}

		$timezone  = wp_timezone();
		$today     = new \DateTimeImmutable( 'today', $timezone );
		$start_day = ( new \DateTimeImmutable( '@' . $start ) )->setTimezone( $timezone );

		// Only day-aligned ranges: a bitmap day is all-or-nothing.
		if ( $start_day->format( 'H:i:s' ) !== '00:00:00' ) {
			$this->miss( 'range-not-day-aligned' );
			return null;
		}
		// The end must close a day (23:59:59-style pickers or exact midnight)
		// or lie in the live tail (today or later).
		$end_moment  = ( new \DateTimeImmutable( '@' . ( $end + 1 ) ) )->setTimezone( $timezone );
		$end_in_tail = $end >= $today->getTimestamp();
		if ( ! $end_in_tail && $end_moment->format( 'H:i:s' ) !== '00:00:00' ) {
			$this->miss( 'range-not-day-aligned' );
			return null;
		}

		$built_until = (string) get_option( 'burst_visitor_bitmaps_built_until' );
		if ( '' === $built_until ) {
			$this->miss( 'store-not-built' );
			return null;
		}
		if ( (bool) get_option( 'burst_visitor_bitmaps_rebuild_from' ) ) {
			$this->miss( 'rebuild-pending' );
			return null;
		}

		// Closed-day part of the range: start_day .. min(end-day, yesterday).
		$closed_until = $end_in_tail ? $today->modify( '-1 day' ) : $end_moment->modify( '-1 day' );
		if ( $closed_until->format( 'Y-m-d' ) > $built_until ) {
			$this->miss( 'builder-behind' );
			return null;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$first_built    = (string) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT MIN(day) FROM {$wpdb->prefix}burst_visitor_bitmaps WHERE scope = %s AND value_id = 0",
				self::SCOPE_SITE
			)
		);
		$coverage_start = $start_day;
		if ( '' !== $first_built && $coverage_start->format( 'Y-m-d' ) < $first_built ) {
			$coverage_start = new \DateTimeImmutable( $first_built, $timezone );
		}

		// DateInterval::days is absolute, so guard the inverted case (the whole
		// closed window lies before the first built day) explicitly: zero
		// closed days, the live tail still counts anything in range.
		$expected_days = $coverage_start > $closed_until
			? 0
			: (int) $coverage_start->diff( $closed_until->modify( '+1 day' ) )->days;

		return [
			'today'          => $today,
			'coverage_start' => $coverage_start,
			'closed_until'   => $closed_until,
			'end_in_tail'    => $end_in_tail,
			'expected_days'  => $expected_days,
			'generation'     => (string) get_option( 'burst_visitor_bitmaps_scopes_version' ) . ':' . (string) get_option( 'burst_visitor_bitmaps_generation' ),
		];
	}

	/**
	 * Coverage check via the site scope: its row is written for every built
	 * day, even empty ones, so a gap means the builder has not covered the
	 * closed window (miss reason set, caller returns null). Dimension and
	 * page rows are sparse — absent simply means zero visitors.
	 */
	private function verify_site_coverage( \DateTimeImmutable $coverage_start, \DateTimeImmutable $closed_until, int $expected_days ): bool {
		if ( $expected_days <= 0 ) {
			return true;
		}
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$site_days = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->prefix}burst_visitor_bitmaps
				WHERE scope = %s AND value_id = 0 AND day BETWEEN %s AND %s",
				self::SCOPE_SITE,
				$coverage_start->format( 'Y-m-d' ),
				$closed_until->format( 'Y-m-d' )
			)
		);
		if ( $site_days !== $expected_days ) {
			$this->miss( 'coverage-gap' );
			return false;
		}
		return true;
	}

	/**
	 * Record whether a bitmap read served or fell back to the SQL path. The
	 * bitmap path bypasses the query executor and its query-stats logging
	 * entirely, so without this a fallback in production leaves no trace —
	 * the dashboard is simply "slow". Written only when the outcome changes
	 * (path or reason), so steady state costs no option writes; Site Health
	 * renders the snapshot.
	 *
	 * @param int|null $served   Any non-null value means the store served; null means fallback.
	 * @param float    $duration Seconds spent in the read.
	 */
	public function record_serve( ?int $served, float $duration ): void {
		$current = [
			'path'   => null === $served ? 'fallback' : 'bitmap',
			'reason' => $this->last_miss_reason,
			'ms'     => (int) round( $duration * 1000 ),
			'time'   => time(),
		];

		$stored = get_option( 'burst_visitor_bitmaps_last_serve', [] );
		if ( is_array( $stored )
			&& ( $stored['path'] ?? '' ) === $current['path']
			&& ( $stored['reason'] ?? '' ) === $current['reason'] ) {
			return;
		}

		update_option( 'burst_visitor_bitmaps_last_serve', $current, false );
	}

	/**
	 * Whether a REST filter value is a plain scalar match. Exclusions ('!'),
	 * wildcards ('*') and comma lists are decoded later by the query
	 * sanitizer — this store only holds exact per-value sets, so those must
	 * fall back to the SQL path instead of being misread as literals.
	 */
	private function is_plain_filter_value( string $value ): bool {
		return ! str_starts_with( $value, '!' )
			&& ! str_ends_with( $value, '*' )
			&& strpos( $value, ',' ) === false;
	}

	/**
	 * OR a dense bitmap into the accumulator (both raw strings), padding to the
	 * longer of the two. PHP's string | operates byte-wise in C.
	 */
	private function or_bitmaps( string $union, string $bitmap ): string {
		$union_len  = strlen( $union );
		$bitmap_len = strlen( $bitmap );
		if ( $union_len < $bitmap_len ) {
			$union .= str_repeat( "\0", $bitmap_len - $union_len );
		} elseif ( $bitmap_len < $union_len ) {
			$bitmap .= str_repeat( "\0", $union_len - $bitmap_len );
		}
		return $union | $bitmap;
	}

	/**
	 * OR a packed uint32 list (raw string) into the dense accumulator.
	 */
	private function or_list( string $union, string $packed ): string {
		if ( '' === $packed ) {
			return $union;
		}
		$uids = unpack( 'V*', $packed );
		if ( false === $uids || empty( $uids ) ) {
			return $union;
		}
		$needed = intdiv( max( $uids ), 8 ) + 1;
		if ( strlen( $union ) < $needed ) {
			$union .= str_repeat( "\0", $needed - strlen( $union ) );
		}
		foreach ( $uids as $uid ) {
			$union[ $uid >> 3 ] = chr( ord( $union[ $uid >> 3 ] ) | ( 1 << ( $uid & 7 ) ) );
		}
		return $union;
	}

	/**
	 * Count set bits via a 256-entry lookup over count_chars() — no extensions.
	 */
	private function popcount( string $bitmap ): int {
		static $bit_counts = null;
		if ( null === $bit_counts ) {
			$bit_counts = [];
			for ( $byte = 0; $byte < 256; $byte++ ) {
				$bit_counts[ $byte ] = substr_count( decbin( $byte ), '1' );
			}
		}

		$count = 0;
		foreach ( count_chars( $bitmap, 1 ) as $byte => $occurrences ) {
			$count += $bit_counts[ $byte ] * $occurrences;
		}
		return $count;
	}
}
