<?php
namespace Burst\Admin\Statistics;

use Burst\Admin\Statistics\Query_Shapes\Session_Grain_Shape;
use Burst\Admin\Admin_Options;
use Burst\Admin\DomainTypes\Admin_Option_Category;
use Burst\Frontend\Goals\Goal;
use Burst\Frontend\Goals\Goals;
use Burst\Frontend\Tracking\Tracking;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;
use Burst\Admin\Database\Query_Executor;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

if ( ! class_exists( 'Goal_Statistics' ) ) {
	class Goal_Statistics {
		use Admin_Helper;
		use Database_Helper;
		use Helper;

		/**
		 * The plugin version this file belongs to. See Upgrade::check_upgrade().
		 *
		 * @var string
		 */
		public const BUILD = '3.7.5';

		/**
		 * A goal without conversions for this long, while its page gets visitors, is not counting.
		 */
		private const HEALTH_WINDOW = 14 * DAY_IN_SECONDS;

		/**
		 * The period before its last conversion that shows how often a goal converts.
		 */
		private const HEALTH_BASELINE_WINDOW = 28 * DAY_IN_SECONDS;

		/**
		 * Conversions in the baseline period a goal needs for silence to mean something.
		 * Two a week make two quiet weeks unlikely by chance; a goal that converts less
		 * often is regularly quiet that long while its tracking works.
		 */
		private const HEALTH_BASELINE_CONVERSIONS = 8;

		/**
		 * Constructor
		 */
		public function init(): void {
			add_action( 'burst_install_tables', [ $this, 'install_goal_statistics_table' ], 10 );
			add_action( 'burst_dismiss_task', [ $this, 'remember_dismissed_goal' ] );
		}

		/**
		 * Get live goals data
		 */
		public function get_live_goals_count( array $args = [] ): int {
			$goal_id = $args['goal_id'] ?? 0;
			// Midnight in the site's timezone: WordPress pins PHP to UTC, so a
			// plain strtotime( 'today' ) would start the day at UTC midnight and
			// drop the early-morning conversions of sites east of Greenwich.
			$today = ( new \DateTimeImmutable( 'today', wp_timezone() ) )->getTimestamp();

			if ( $goal_id === 'all' ) {
				global $wpdb;
				$active_goal_ids = $wpdb->get_col( "SELECT ID FROM {$wpdb->prefix}burst_goals WHERE status = 'active'" );
				if ( empty( $active_goal_ids ) ) {
					return 0;
				}
				$sql = $this->get_goal_completed_count_sql( $active_goal_ids, $today );
			} else {
				$sql = $this->get_goal_completed_count_sql( (int) $goal_id, $today );
			}

			$sql = $this->add_query_timeout_hint( $sql, $this->get_goal_query_timeout_ms() );
			$val = Query_Executor::create()
				->fingerprint( 'live_goals_count_' . $goal_id )
				->cache_ttl( 0 )
				->single_flight( false )
				->run( $sql, 'get_var' );
			return (int) $val ?: 0;
		}

		/**
		 * Resolve timeout for goal statistics queries.
		 */
		private function get_goal_query_timeout_ms(): int {
			return $this->resolve_query_timeout_ms(
				'burst_query_timeout_ms',
				'burst_query_timeout_ms_background',
				null,
				30000,
				900000,
				30000,
				false
			);
		}

		// phpcs:disable SlevomatCodingStandard.TypeHints.ParameterTypeHint.MissingNativeTypeHint
		/**
		 * Get the SQL query to count completed goals.
		 *
		 * @param int|array $goal_id Goal ID or array of active goal IDs.
		 * @param int       $date_start Start date (timestamp).
		 * @return string SQL query.
		 */
		private function get_goal_completed_count_sql( $goal_id, int $date_start = 0 ): string {
			global $wpdb;
			$date_end = 0;
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			// @phpstan-ignore-next-line
			$date_end_sql = $date_end > 0 ? $wpdb->prepare( 'AND statistics.time < %s', $date_end ) : '';

			if ( is_array( $goal_id ) ) {
				$goals_in     = implode( ',', array_map( 'intval', $goal_id ) );
				$count_sql    = 'COUNT(DISTINCT(statistics.uid_id))';
				$goal_sql     = "goals.goal_id IN ($goals_in)";
				$goal_url_sql = '';
			} else {
				$goal         = new Goal( (int) $goal_id );
				$date_start   = $date_start > 0 ? $date_start : $goal->date_created;
				$goal_url_sql = $this->is_page_bound( $goal ) ? 'AND ' . $this->get_goal_url_condition( $goal ) : '';
				$count_sql    = $this->get_conversion_count_sql( $goal->conversion_metric );
				$goal_sql     = $wpdb->prepare( 'goals.goal_id = %d', $goal_id );
			}

			// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- using prepared parts.
			$sql = $wpdb->prepare(
				"SELECT {$count_sql} AS value FROM {$wpdb->prefix}burst_goal_statistics AS goals
        INNER JOIN {$wpdb->prefix}burst_statistics AS statistics
            ON statistics.ID = goals.statistic_id
        INNER JOIN {$wpdb->prefix}burst_sessions AS sessions
            ON statistics.session_id = sessions.ID
        WHERE {$goal_sql} AND statistics.time > %s {$date_end_sql} {$goal_url_sql}",
				$date_start
			);
			// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			return $sql;
		}
		// phpcs:enable SlevomatCodingStandard.TypeHints.ParameterTypeHint.MissingNativeTypeHint

		/**
		 * The aggregate that counts a goal's conversions, by its conversion metric.
		 *
		 * @param string $metric The goal's conversion metric: visitors, sessions or pageviews.
		 * @return string SQL aggregate over the statistics table.
		 */
		private function get_conversion_count_sql( string $metric ): string {
			if ( 'pageviews' === $metric ) {
				return 'COUNT(*)';
			}
			if ( 'sessions' === $metric ) {
				return 'COUNT(DISTINCT(statistics.session_id))';
			}
			return 'COUNT(DISTINCT(statistics.uid_id))';
		}

		/**
		 * The aggregate that counts conversions by each goal's own metric and page,
		 * for a query with the goals join. Summed over goals, as the overview totals do.
		 *
		 * @param Goal[] $goals The goals.
		 * @return string SQL aggregate.
		 */
		public function get_goal_conversions_sql( array $goals ): string {
			global $wpdb;
			$columns = [
				'pageviews' => 'goals.ID',
				'sessions'  => 'statistics.session_id',
				'visitors'  => 'statistics.uid_id',
			];

			$cases = [];
			foreach ( $goals as $goal ) {
				$condition = $wpdb->prepare( 'goals.goal_id = %d', $goal->id );
				if ( $this->is_page_bound( $goal ) ) {
					$condition .= ' AND ' . $this->get_goal_url_condition( $goal );
				}
				$column  = $columns[ $goal->conversion_metric ] ?? $columns['visitors'];
				$cases[] = "WHEN {$condition} THEN CONCAT(goals.goal_id, '-', {$column})";
			}

			return empty( $cases ) ? '0' : 'COUNT(DISTINCT CASE ' . implode( ' ', $cases ) . ' END)';
		}

		/**
		 * Whether a goal only counts on its own page. Visit goals are already
		 * bound to their page by the tracker, so they never need the page condition.
		 *
		 * @param Goal $goal The goal.
		 * @return bool True when conversions must be limited to the goal's url.
		 */
		private function is_page_bound( Goal $goal ): bool {
			return '' !== $goal->url && '*' !== $goal->url && 'visits' !== $goal->type;
		}

		/**
		 * SQL condition that limits hits to a goal's page.
		 *
		 * @param Goal $goal A page bound goal.
		 * @return string Prepared condition, without a leading AND.
		 */
		private function get_goal_url_condition( Goal $goal ): string {
			global $wpdb;
			return $wpdb->prepare( 'statistics.page_url = %s', $goal->url );
		}

		/**
		 * Per-goal results for the goals dashboard: conversions, converting visitors
		 * and conversion rate for the period and the period before it, plus each
		 * goal's health.
		 *
		 * Inactive goals keep their row, so the list can still show them, but are
		 * left out of the totals.
		 *
		 * @param array $args Request args: date_start and date_end of the period (timestamps).
		 * @return array{
		 *     totals: array{conversions: int, conversions_previous: int, converting_visitors: int, converting_visitors_previous: int, conversion_rate: float, conversion_rate_previous: float},
		 *     goals: array<int, array{id: int, conversions: int, conversions_previous: int, converting_visitors: int, conversion_rate: float, health: array{status: string, last_conversion: int|null}}>
		 * }
		 */
		public function get_goals_overview( array $args = [] ): array {
			$start    = (int) ( $args['date_start'] ?? 0 );
			$end      = (int) ( $args['date_end'] ?? 0 );
			$previous = Statistics_Data::calculate_comparison_dates( $start, $end, [] );
			$goals    = ( new Goals() )->get_goals();

			$current_counts  = $this->get_goal_counts( $goals, $start, $end );
			$previous_counts = $this->get_goal_counts( $goals, $previous['start'], $previous['end'] );
			$visitors        = $this->get_visitors_count( $start, $end );
			$visitors_prev   = $this->get_visitors_count( $previous['start'], $previous['end'] );
			$health          = $this->get_goals_health( $goals );

			$rows        = [];
			$conversions = 0;
			$conv_prev   = 0;
			foreach ( $goals as $goal ) {
				$current_row  = $current_counts['goals'][ $goal->id ] ?? null;
				$previous_row = $previous_counts['goals'][ $goal->id ] ?? null;
				$count        = $current_row ? $this->pick_conversion_count( $current_row, $goal->conversion_metric ) : 0;
				$prev         = $previous_row ? $this->pick_conversion_count( $previous_row, $goal->conversion_metric ) : 0;
				$unique       = $current_row ? (int) $current_row->visitors : 0;

				if ( 'active' === $goal->status ) {
					$conversions += $count;
					$conv_prev   += $prev;
				}

				$rows[] = [
					'id'                   => $goal->id,
					'conversions'          => $count,
					'conversions_previous' => $prev,
					'converting_visitors'  => $unique,
					'conversion_rate'      => $this->get_rate( $unique, $visitors ),
					'health'               => $health[ $goal->id ] ?? [
						'status'          => 'ok',
						'last_conversion' => null,
					],
				];
			}

			return [
				'totals' => [
					'conversions'                  => $conversions,
					'conversions_previous'         => $conv_prev,
					'converting_visitors'          => $current_counts['active_visitors'],
					'converting_visitors_previous' => $previous_counts['active_visitors'],
					'conversion_rate'              => $this->get_rate( $current_counts['active_visitors'], $visitors ),
					'conversion_rate_previous'     => $this->get_rate( $previous_counts['active_visitors'], $visitors_prev ),
				],
				'goals'  => $rows,
			];
		}

		/**
		 * The count a goal reports as its conversions, from a grouped counts row.
		 *
		 * @param object $row    Row with visitors, sessions and pageviews.
		 * @param string $metric The goal's conversion metric.
		 * @return int The conversions.
		 */
		private function pick_conversion_count( object $row, string $metric ): int {
			if ( 'pageviews' === $metric || 'sessions' === $metric ) {
				return (int) $row->{$metric};
			}
			return (int) $row->visitors;
		}

		/**
		 * Percentage of a part in a whole, rounded to two decimals.
		 *
		 * @param int $part  The part.
		 * @param int $whole The whole.
		 * @return float The percentage, 0 when the whole is 0.
		 */
		private function get_rate( int $part, int $whole ): float {
			return $whole > 0 ? round( $part / $whole * 100, 2 ) : 0.0;
		}

		/**
		 * Visitors on the whole site in a period, the base of every conversion rate.
		 *
		 * @param int $start Start of the period (timestamp).
		 * @param int $end   End of the period (timestamp).
		 * @return int Unique visitors.
		 */
		private function get_visitors_count( int $start, int $end ): int {
			return (int) Statistics_Query::create( 'goals_overview_visitors' )
				->date_range( $start, $end )
				->select( [ 'visitors' ] )
				->fetch_var();
		}

		/**
		 * Visitors, sessions and pageviews that completed each goal in a period, in
		 * one query grouped by goal.
		 *
		 * WITH ROLLUP adds a total row (goal_id NULL) in the same pass. Its
		 * active_visitors column counts each visitor once across all active goals,
		 * which a sum of the per-goal rows cannot do.
		 *
		 * @param Goal[] $goals All goals.
		 * @param int    $start Start of the period (timestamp).
		 * @param int    $end   End of the period (timestamp).
		 * @return array{goals: array<int, object>, active_visitors: int} Counts per goal id, and unique visitors across active goals.
		 */
		private function get_goal_counts( array $goals, int $start, int $end ): array {
			$result = [
				'goals'           => [],
				'active_visitors' => 0,
			];
			if ( empty( $goals ) || ! self::database_upgrade_completed() ) {
				return $result;
			}

			global $wpdb;
			$conditions = [];
			$active_ids = [ 0 ];
			foreach ( $goals as $goal ) {
				$conditions[] = $this->is_page_bound( $goal )
					? $wpdb->prepare( '( goals.goal_id = %d AND ', $goal->id ) . $this->get_goal_url_condition( $goal ) . ' )'
					: $wpdb->prepare( 'goals.goal_id = %d', $goal->id );
				if ( 'active' === $goal->status ) {
					$active_ids[] = (int) $goal->id;
				}
			}
			$goal_sql   = implode( ' OR ', $conditions );
			$active_sql = implode( ',', $active_ids );

			// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- conditions are prepared above, ids are integers.
			$sql = $wpdb->prepare(
				"SELECT goals.goal_id AS goal_id,
					COUNT(DISTINCT(statistics.uid_id)) AS visitors,
					COUNT(DISTINCT(statistics.session_id)) AS sessions,
					COUNT(*) AS pageviews,
					COUNT(DISTINCT CASE WHEN goals.goal_id IN ({$active_sql}) THEN statistics.uid_id END) AS active_visitors
				FROM {$wpdb->prefix}burst_goal_statistics AS goals
				INNER JOIN {$wpdb->prefix}burst_statistics AS statistics ON statistics.ID = goals.statistic_id
				INNER JOIN {$wpdb->prefix}burst_sessions AS sessions ON statistics.session_id = sessions.ID
				WHERE ( {$goal_sql} ) AND statistics.time > %d AND statistics.time <= %d
				GROUP BY goals.goal_id WITH ROLLUP",
				$start,
				$end
			);
			// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared

			$rows = Query_Executor::create()
				->fingerprint( 'goals_overview_counts' )
				->cache_ttl( 30 )
				->cache_group( 'burst_stats_query_results' )
				->single_flight( false )
				->run( $this->add_query_timeout_hint( $sql, $this->get_goal_query_timeout_ms() ), 'get', 'OBJECT' );

			foreach ( (array) $rows as $row ) {
				if ( null === $row->goal_id ) {
					$result['active_visitors'] = (int) $row->active_visitors;
					continue;
				}
				$result['goals'][ (int) $row->goal_id ] = $row;
			}
			return $result;
		}

		/**
		 * Health of every goal: whether an active goal stopped counting while its
		 * page still gets visitors, which points at a tracking problem, not a
		 * traffic one.
		 *
		 * Independent of the selected date range, so the result is cached for an
		 * hour. The cache key covers the goal settings the check reads, so editing
		 * or toggling a goal is picked up at once. A failed query leaves the result
		 * empty and uncached: it says nothing about the goals.
		 *
		 * @param Goal[]|null $goals The goals, or null to load them.
		 * @return array<int, array{status: string, last_conversion: int|null}> Health per goal id, empty when the check could not run.
		 */
		public function get_goals_health( ?array $goals = null ): array {
			$goals = $goals ?? ( new Goals() )->get_goals();
			if ( ! self::database_upgrade_completed() ) {
				return [];
			}
			if ( empty( $goals ) ) {
				// The last goal was deleted: a task about it no longer applies.
				$this->maybe_schedule_health_task( [] );
				return [];
			}

			$cache_key = 'burst_goals_health_' . hash(
				'sha256',
				(string) wp_json_encode(
					array_map(
						static fn( Goal $goal ): array => [ $goal->id, $goal->status, $goal->url, $goal->type, $goal->date_created, $goal->date_start ?? 0 ],
						$goals
					)
				)
			);
			$cached    = get_transient( $cache_key );
			if ( is_array( $cached ) ) {
				return $cached;
			}

			try {
				$health = $this->check_goals_health( $goals );
			} catch ( \RuntimeException $e ) {
				self::error_log( 'Goal health check failed: ' . $e->getMessage() );
				return [];
			}

			set_transient( $cache_key, $health, HOUR_IN_SECONDS );

			// Only on a fresh check, so this runs at most once an hour.
			$this->maybe_schedule_health_task( $health );
			return $health;
		}

		/**
		 * Run the health check for each goal.
		 *
		 * @param Goal[] $goals The goals.
		 * @return array<int, array{status: string, last_conversion: int|null}> Health per goal id.
		 * @throws \RuntimeException When a query fails.
		 */
		private function check_goals_health( array $goals ): array {
			$window_start    = time() - self::HEALTH_WINDOW;
			$last_conversion = $this->get_last_conversion_times( $goals );
			$health          = [];
			foreach ( $goals as $goal ) {
				$last                = $last_conversion[ $goal->id ] ?? null;
				$health[ $goal->id ] = [
					'status'          => $this->is_not_counting( $goal, $last, $window_start ) ? 'not_counting' : 'ok',
					'last_conversion' => $last,
				];
			}
			return $health;
		}

		/**
		 * Run a health check query. A timeout or error returns the same empty result
		 * as no data, so it is raised here to keep it from reading as a healthy goal.
		 *
		 * @param string $sql         Prepared SQL.
		 * @param string $fingerprint Query fingerprint.
		 * @param string $method      Query_Executor method: get or get_var.
		 * @return mixed The query result, which depends on the method.
		 * @throws \RuntimeException When the query fails.
		 */
		private function run_health_query( string $sql, string $fingerprint, string $method ): mixed {
			$executor = Query_Executor::create()
				->fingerprint( $fingerprint )
				->cache_ttl( 0 )
				->single_flight( false );
			$result   = $executor->run( $this->add_query_timeout_hint( $sql, $this->get_goal_query_timeout_ms() ), $method );
			if ( $executor->failed ) {
				throw new \RuntimeException( esc_html( $fingerprint ) );
			}
			return $result;
		}

		/**
		 * Whether a goal stopped counting: active, running for longer than the window,
		 * converting regularly before the window but not in it, while its page still
		 * had pageviews in it.
		 *
		 * @param Goal     $goal            The goal.
		 * @param int|null $last_conversion Time of its latest conversion, null when it never converted.
		 * @param int      $window_start    Start of the health window (timestamp).
		 * @return bool True when the goal is not counting.
		 * @throws \RuntimeException When a query fails.
		 */
		private function is_not_counting( Goal $goal, ?int $last_conversion, int $window_start ): bool {
			// Reactivating a goal resets date_start: it needs the whole window to convert again.
			if ( 'active' !== $goal->status || max( $goal->date_created, $goal->date_start ?? 0 ) > $window_start ) {
				return false;
			}
			if ( null === $last_conversion || $last_conversion > $window_start ) {
				return false;
			}
			return $this->has_pageviews_since( $goal, $window_start ) && $this->converted_regularly_before( $goal, $last_conversion );
		}

		/**
		 * Whether a goal converted often enough before its last conversion for a
		 * quiet window to point at a problem.
		 *
		 * @param Goal $goal            The goal.
		 * @param int  $last_conversion Time of its latest conversion.
		 * @return bool True when it converted regularly.
		 * @throws \RuntimeException When the query fails.
		 */
		private function converted_regularly_before( Goal $goal, int $last_conversion ): bool {
			global $wpdb;
			$sql = $wpdb->prepare(
				"SELECT COUNT(*)
				FROM {$wpdb->prefix}burst_goal_statistics AS goals
				INNER JOIN {$wpdb->prefix}burst_statistics AS statistics ON statistics.ID = goals.statistic_id
				WHERE goals.goal_id = %d AND statistics.time > %d AND statistics.time <= %d",
				$goal->id,
				$last_conversion - self::HEALTH_BASELINE_WINDOW,
				$last_conversion
			);
			return (int) $this->run_health_query( $sql, 'goal_health_baseline_' . $goal->id, 'get_var' ) >= self::HEALTH_BASELINE_CONVERSIONS;
		}

		/**
		 * Time of each goal's latest conversion, in one grouped query.
		 *
		 * @param Goal[] $goals The goals.
		 * @return array<int, int> Timestamp per goal id, only for goals that converted.
		 * @throws \RuntimeException When the query fails.
		 */
		private function get_last_conversion_times( array $goals ): array {
			global $wpdb;
			$ids = implode( ',', array_map( static fn( Goal $goal ): int => $goal->id, $goals ) );

			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- ids are integers.
			$sql  = "SELECT goals.goal_id AS goal_id, MAX(statistics.time) AS last_conversion
				FROM {$wpdb->prefix}burst_goal_statistics AS goals
				INNER JOIN {$wpdb->prefix}burst_statistics AS statistics ON statistics.ID = goals.statistic_id
				WHERE goals.goal_id IN ({$ids})
				GROUP BY goals.goal_id";
			$rows = $this->run_health_query( $sql, 'goals_last_conversion', 'get' );

			$times = [];
			foreach ( (array) $rows as $row ) {
				$times[ (int) $row->goal_id ] = (int) $row->last_conversion;
			}
			return $times;
		}

		/**
		 * Whether a goal's page had a pageview since a moment: its own page for a
		 * page goal, any page for a whole site goal.
		 *
		 * @param Goal $goal  The goal.
		 * @param int  $since Timestamp.
		 * @return bool True when there was at least one pageview.
		 * @throws \RuntimeException When the query fails.
		 */
		private function has_pageviews_since( Goal $goal, int $since ): bool {
			global $wpdb;
			$url_sql = '' !== $goal->url && '*' !== $goal->url ? 'AND ' . $this->get_goal_url_condition( $goal ) : '';

			// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders -- the url condition is prepared.
			$sql = $wpdb->prepare( "SELECT 1 FROM {$wpdb->prefix}burst_statistics AS statistics WHERE statistics.time > %d {$url_sql} LIMIT 1", $since );
			// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders
			return null !== $this->run_health_query( $sql, 'goal_health_pageviews_' . $goal->id, 'get_var' );
		}

		/**
		 * Have the "stopped counting" task checked soon when it no longer matches the
		 * goals: a goal stopped counting without a task, or the goal the task names
		 * was fixed, paused or deleted. So the Activity overview is right the same day.
		 *
		 * @param array<int, array{status: string, last_conversion: int|null}> $health Health per goal id.
		 */
		private function maybe_schedule_health_task( array $health ): void {
			$tasks = \Burst\burst_loader()->admin->tasks ?? null;
			if ( null === $tasks ) {
				return;
			}

			$reportable = $this->get_reportable_goal_ids( $health );
			$stored     = Admin_Options::get( Admin_Option_Category::CORE, 'goal_not_counting', [] );
			$is_current = $tasks->has_task( 'goal_not_counting' )
				? in_array( (int) ( $stored['id'] ?? 0 ), $reportable, true )
				: empty( $reportable );

			if ( ! $is_current ) {
				$tasks->schedule_task_validation();
			}
		}

		/**
		 * The goals the task can report: not counting, and not dismissed by the user
		 * since their last conversion. A goal that recovers and stops again has a new
		 * last conversion, so it is reported again.
		 *
		 * @param array<int, array{status: string, last_conversion: int|null}> $health Health per goal id.
		 * @return int[] Goal ids.
		 */
		private function get_reportable_goal_ids( array $health ): array {
			$dismissed = Admin_Options::get( Admin_Option_Category::CORE, 'goal_not_counting_dismissed', [] );
			$goal_ids  = [];
			foreach ( $health as $goal_id => $goal_health ) {
				if ( 'not_counting' === $goal_health['status'] && ( $dismissed[ $goal_id ] ?? null ) !== $goal_health['last_conversion'] ) {
					$goal_ids[] = (int) $goal_id;
				}
			}
			return $goal_ids;
		}

		/**
		 * Remember which goal a dismissed task was about, so the task check does not
		 * bring it back. The task check removes the stored goal before it dismisses a
		 * task that no longer applies, so only a dismissal by the user gets here with one.
		 *
		 * @param string $task_id The dismissed task.
		 */
		public function remember_dismissed_goal( string $task_id ): void {
			if ( 'goal_not_counting' !== $task_id ) {
				return;
			}
			$stored = Admin_Options::get( Admin_Option_Category::CORE, 'goal_not_counting', [] );
			if ( empty( $stored['id'] ) ) {
				return;
			}
			$dismissed                  = Admin_Options::get( Admin_Option_Category::CORE, 'goal_not_counting_dismissed', [] );
			$dismissed[ $stored['id'] ] = (int) ( $stored['last_conversion'] ?? 0 );
			Admin_Options::update( Admin_Option_Category::CORE, 'goal_not_counting_dismissed', $dismissed );
		}

		/**
		 * Task condition: whether any goal stopped counting. Runs on the task
		 * validation cron, never on a page load, and keeps the first such goal for
		 * the task message. When the check could not run the task stays as it is.
		 *
		 * @return bool True when at least one goal is not counting.
		 */
		public static function has_not_counting_goal(): bool {
			$statistics = new self();
			$goals      = ( new Goals() )->get_goals();
			$health     = $statistics->get_goals_health( $goals );
			if ( empty( $health ) && ! empty( $goals ) ) {
				return ! empty( Admin_Options::get( Admin_Option_Category::CORE, 'goal_not_counting', [] ) );
			}

			$goal_id = $statistics->get_reportable_goal_ids( $health )[0] ?? 0;
			if ( 0 === $goal_id ) {
				Admin_Options::delete( Admin_Option_Category::CORE, 'goal_not_counting' );
				return false;
			}

			Admin_Options::update(
				Admin_Option_Category::CORE,
				'goal_not_counting',
				[
					'id'              => $goal_id,
					'title'           => ( new Goal( $goal_id ) )->title,
					'last_conversion' => $health[ $goal_id ]['last_conversion'],
				]
			);
			return true;
		}

		/**
		 * Get goals data for the goals block or statistics overview.
		 *
		 * @param array $args {
		 *     Optional. Arguments to filter the goal data.
		 * @type int    $date_start Start date (timestamp).
		 *     @type int    $date_end   End date (timestamp).
		 *     @type string $url        Page URL for filtering.
		 *     @type int    $goal_id    Goal ID to fetch.
		 * }
		 * @return array{
		 *     today: array{value: int, tooltip: string},
		 *     total: array{value: int, tooltip: string},
		 *     topPerformer: array{title: string, value: int},
		 *     conversionMetric: array{title: string, value: int, tooltip: string, icon: string},
		 *     conversionPercentage: array{title: string, value: int, tooltip: string},
		 *     bestDevice: array{title: string, value: int, icon: mixed},
		 *     dateCreated: int,
		 *     dateStart: int,
		 *     dateEnd: int,
		 *     status: string,
		 *     goalId: int|string
		 * }
		 */
		public function get_goals_data( array $args = [] ): array {
			if ( ! self::database_upgrade_completed() ) {
				return [
					'today'                => [
						'value'   => 0,
						'tooltip' => '',
					],
					'total'                => [
						'value'   => 0,
						'tooltip' => '',
					],
					'topPerformer'         => [
						'title'   => '',
						'value'   => 0,
						'tooltip' => '',
					],
					'conversionMetric'     => [
						'title'   => '',
						'value'   => 0,
						'tooltip' => '',
						'icon'    => '',
					],
					'conversionPercentage' => [
						'title'   => '',
						'value'   => 0,
						'tooltip' => '',
					],
					'bestDevice'           => [
						'title'   => '',
						'value'   => 0,
						'tooltip' => '',
						'icon'    => null,
					],
					'dateCreated'          => 0,
					'dateStart'            => 0,
					'dateEnd'              => 0,
					'status'               => '',
					'goalId'               => 0,
				];
			}

			global $wpdb;

			// Define default arguments.
			$defaults = [
				'date_start' => 0,
				'date_end'   => 0,
				'url'        => '',
				'goal_id'    => 0,
			];
			$args     = wp_parse_args( $args, $defaults );

			$default_data = [
				'today'                => [
					'value'   => 0,
					'tooltip' => '',
				],
				'total'                => [
					'value'   => 0,
					'tooltip' => '',
				],
				'topPerformer'         => [
					'title' => '-',
					'value' => 0,
				],
				'conversionMetric'     => [
					'title'   => __( 'Visitors', 'burst-statistics' ),
					'value'   => 0,
					'tooltip' => '',
					'icon'    => 'visitors',
				],
				'conversionPercentage' => [
					'title'   => __( 'Conversion rate', 'burst-statistics' ),
					'value'   => 0,
					'tooltip' => '',
				],
				'bestDevice'           => [
					'title' => __( 'Not enough data', 'burst-statistics' ),
					'value' => 0,
					'icon'  => 'desktop',
				],
				'dateCreated'          => 0,
				'dateStart'            => 0,
				'dateEnd'              => 0,
				'status'               => 'inactive',
				'goalId'               => 0,
			];

			$goal                  = null;
			$goal_url              = '';
			$active_goal_ids       = [];
			$earliest_date_created = 0;

			// Sanitize input.
			$goal_id = $args['goal_id'] === 'all' ? 'all' : (int) $args['goal_id'];

			if ( $goal_id !== 'all' ) {
				$goal       = new Goal( $goal_id );
				$goal_url   = $goal->url;
				$date_start = $goal->date_created;
				$date_end   = 0;
			} else {
				$active_goals = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}burst_goals WHERE status = 'active'" );
				if ( empty( $active_goals ) ) {
					$default_data['goalId'] = 'all';
					return $default_data;
				}
				$active_goal_ids       = [];
				$earliest_date_created = time();
				foreach ( $active_goals as $g ) {
					$active_goal_ids[] = (int) $g->ID;
					if ( (int) $g->date_created < $earliest_date_created ) {
						$earliest_date_created = (int) $g->date_created;
					}
				}
				$date_start = $earliest_date_created;
				$date_end   = 0;
			}

			// Initialize data array.
			$data = $default_data;

			if ( $goal_id !== 'all' ) {
				if ( $goal->conversion_metric === 'pageviews' ) {
					$data['conversionMetric'] = [
						'title'   => __( 'Pageviews', 'burst-statistics' ),
						'value'   => 0,
						'tooltip' => '',
						'icon'    => 'pageviews',
					];
					$count_sql                = 'COUNT(*)';
				} elseif ( $goal->conversion_metric === 'sessions' ) {
					$data['conversionMetric'] = [
						'title'   => __( 'Sessions', 'burst-statistics' ),
						'value'   => 0,
						'tooltip' => '',
						'icon'    => 'sessions',
					];
					$count_sql                = 'COUNT(DISTINCT(statistics.session_id))';
				} else {
					$count_sql = 'COUNT(DISTINCT(statistics.uid_id))';
				}
			} else {
				$count_sql = 'COUNT(DISTINCT(statistics.uid_id))';
			}

			if ( $goal_id === 'all' ) {
				$data['dateCreated'] = $earliest_date_created;
				$data['dateStart']   = $date_start;
				$data['dateEnd']     = $date_end;
				$data['status']      = 'active';
				$data['goalId']      = 'all';
			} else {
				$data['dateCreated'] = $goal->date_created;
				$data['dateStart']   = $date_start;
				$data['dateEnd']     = $date_end;
				$data['status']      = $goal->status;
				$data['goalId']      = $goal_id;
			}

			if ( $goal_id !== 0 ) {
				$query_goal_id = $goal_id === 'all' ? $active_goal_ids : $goal_id;

				// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- dynamic SQL parts and lists.
				// Query to get top performing page.
				$top_performer_sql  = $this->get_goal_completed_count_sql( $query_goal_id, $date_start );
				$top_performer_sql  = str_replace( ' AS value FROM ', ' AS value, statistics.page_url AS title FROM ', $top_performer_sql );
				$top_performer_sql .= ' GROUP BY statistics.page_url ORDER BY value DESC LIMIT 1';

				// Query to get total number of goal completions.
				$total_completed_sql = $this->get_goal_completed_count_sql( $query_goal_id, $date_start );

				// Query to get total number of visitors, sessions or pageviews with build_raw_sql.
				if ( $goal_id === 'all' ) {
					$date_end_sql = '';
					$goal_url_sql = '';
				} else {
					// @phpstan-ignore-next-line
					$date_end_sql = $date_end > 0 ? $wpdb->prepare( 'AND statistics.time < %s', $date_end ) : '';
					$goal_url_sql = $goal_url === '' || $goal_url === '*' || $goal->type === 'visits' ? '' : $wpdb->prepare( 'AND statistics.page_url = %s', $goal_url );
				}

				$conversion_metric = $wpdb->prepare(
					"SELECT {$count_sql} FROM {$wpdb->prefix}burst_statistics as statistics WHERE statistics.time > %s {$date_end_sql} {$goal_url_sql}",
					$date_start
				);

				// Query to get best performing device. device_id > 0: the
				// denominators (bitmap dimension counts and the sessions
				// fallback) only carry real devices, so an unresolved-device
				// numerator row would never find a denominator and silently
				// drop out of the ranking — exclude it up front so numerator
				// and denominator describe the same population.
				$completed_goals_per_device_sql  = $this->get_goal_completed_count_sql( $query_goal_id, $date_start );
				$completed_goals_per_device_sql  = str_replace( ' AS value FROM ', ' AS value, sessions.device_id AS device_id FROM ', $completed_goals_per_device_sql );
				$completed_goals_per_device_sql .= ' AND sessions.device_id > 0 GROUP BY sessions.device_id ORDER BY value DESC LIMIT 4';

				if ( $goal_id === 'all' ) {
					$pageviews_per_device_sql = $wpdb->prepare(
						"SELECT {$count_sql} AS value, sessions.device_id
						FROM {$wpdb->prefix}burst_statistics AS statistics
						INNER JOIN {$wpdb->prefix}burst_sessions AS sessions ON statistics.session_id = sessions.ID
						WHERE statistics.time > %d
						GROUP BY sessions.device_id
						ORDER BY value DESC
						LIMIT 4",
						$date_start
					);
				} else {
					$pageviews_per_device_sql = $wpdb->prepare(
						"SELECT {$count_sql} AS value, sessions.device_id
						FROM {$wpdb->prefix}burst_statistics AS statistics
						INNER JOIN {$wpdb->prefix}burst_sessions AS sessions
							ON statistics.session_id = sessions.ID
						WHERE statistics.time > %s {$date_end_sql} {$goal_url_sql}
						GROUP BY sessions.device_id
						ORDER BY value DESC
						LIMIT 4",
						$date_start
					);
				}
				// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared

				$top_performer_sql    = $this->add_query_timeout_hint( $top_performer_sql, $this->get_goal_query_timeout_ms() );
				$top_performer_result = Query_Executor::create()
					->fingerprint( 'goal_top_performer_' . $goal_id )
					->cache_ttl( 30 )
					->cache_group( 'burst_stats_query_results' )
					->single_flight( false )
					->run( $top_performer_sql, 'get_row', 'OBJECT' );
				if ( $top_performer_result ) {
					$data['topPerformer']['title'] = $top_performer_result->title;
					$data['topPerformer']['value'] = $top_performer_result->value;
				}

				// Query to get total number of goal completions.
				$total_completed_sql    = $this->add_query_timeout_hint( $total_completed_sql, $this->get_goal_query_timeout_ms() );
				$data['total']['value'] = Query_Executor::create()
					->fingerprint( 'goal_total_completed_' . $goal_id )
					->cache_ttl( 30 )
					->cache_group( 'burst_stats_query_results' )
					->single_flight( false )
					->run( $total_completed_sql, 'get_var' );

				// Query to get total number of visitors, sessions or pageviews with build_raw_sql.
				$conversion_metric                 = $this->add_query_timeout_hint( $conversion_metric, $this->get_goal_query_timeout_ms() );
				$data['conversionMetric']['value'] = Query_Executor::create()
					->fingerprint( 'goal_conversion_metric_' . $goal_id )
					->cache_ttl( 30 )
					->cache_group( 'burst_stats_query_results' )
					->single_flight( false )
					->run( $conversion_metric, 'get_var' );

				// Query to get best performing device.
				$completed_goals_per_device_sql = $this->add_query_timeout_hint( $completed_goals_per_device_sql, $this->get_goal_query_timeout_ms() );
				$completed_goals_per_device     = Query_Executor::create()
					->fingerprint( 'goal_completed_goals_per_device_' . $goal_id )
					->cache_ttl( 30 )
					->cache_group( 'burst_stats_query_results' )
					->single_flight( false )
					->run( $completed_goals_per_device_sql, 'get', 'OBJECT' );

				// The denominator per device (visitors/sessions/pageviews since
				// goal start) scans all hits in range on the raw path — try
				// the fast paths first: device-scope visitor bitmaps for the
				// visitors metric, the sessions table for the sessions metric.
				$device_metric = 'visitors';
				if ( 'all' !== $goal_id && in_array( $goal->conversion_metric, [ 'pageviews', 'sessions' ], true ) ) {
					$device_metric = $goal->conversion_metric;
				}
				$pageviews_per_device = '' === $goal_url_sql
					? $this->get_denominator_per_device( $device_metric, $date_start, 'all' === $goal_id ? 0 : $date_end )
					: null;

				if ( null === $pageviews_per_device ) {
					$pageviews_per_device_sql = $this->add_query_timeout_hint( $pageviews_per_device_sql, $this->get_goal_query_timeout_ms() );
					$pageviews_per_device     = Query_Executor::create()
						->fingerprint( 'goal_pageviews_per_device_' . $goal_id )
						->cache_ttl( 30 )
						->cache_group( 'burst_stats_query_results' )
						->single_flight( false )
						->run( $pageviews_per_device_sql, 'get', 'OBJECT' );
				}

				// create lookupt table for faster access to pageviews per device.
				$pageviews_lookup = [];
				foreach ( $pageviews_per_device as $row ) {
					$pageviews_lookup[ $row->device_id ] = $row->value;
				}

				// calculate conversion rate and select the highest percentage.
				$highest_percentage = 0;
				foreach ( $completed_goals_per_device as $device ) {
					if ( isset( $pageviews_lookup[ $device->device_id ] ) && $pageviews_lookup[ $device->device_id ] > 0 ) {
						$percentage = round( ( $device->value / $pageviews_lookup[ $device->device_id ] ) * 100, 2 );
						if ( $percentage > $highest_percentage ) {
							$device_string               = \Burst\burst_loader()->admin->statistics->get_lookup_table_name_by_id( 'device', $device->device_id );
							$highest_percentage          = $percentage;
							$data['bestDevice']['title'] = $this->get_device_name( $device_string );
							$data['bestDevice']['icon']  = ( $device_string && $device_string !== 'other' ) ? $device_string : 'desktop';
							$data['bestDevice']['value'] = $percentage;
						}
					}
				}
			}

			return $data;
		}

		/**
		 * Denominator per device for the best-device conversion rate, via the
		 * fast paths where the metric allows: visitors come from the device-scope
		 * visitor bitmaps (start floored to the site-timezone day — the sub-day
		 * offset of a goal's creation moment is noise for a device ratio),
		 * sessions from the sessions table directly. Returns null when the metric
		 * or migration state requires the raw statistics scan.
		 *
		 * @param string $metric     Conversion metric: 'visitors', 'sessions' or 'pageviews'.
		 * @param int    $date_start Range start (unix timestamp).
		 * @param int    $date_end   Range end (unix timestamp, 0 = open-ended).
		 * @return array<int, object>|null Rows with ->value and ->device_id, or null for the raw fallback.
		 */
		private function get_denominator_per_device( string $metric, int $date_start, int $date_end ): ?array {
			$date_end = $date_end > 0 ? $date_end : time();

			if ( 'sessions' === $metric ) {
				return $this->sessions_denominator_per_device( 'COUNT(*)', $date_start, $date_end );
			}

			if ( 'visitors' !== $metric ) {
				// Pageviews need the hit rows; only the raw path can count them.
				return null;
			}

			$timezone  = wp_timezone();
			$start_day = ( new \DateTimeImmutable( '@' . $date_start ) )->setTimezone( $timezone )->setTime( 0, 0 )->getTimestamp();
			$bitmaps   = new Visitor_Bitmaps();

			// One grouped store read serves every device at once (one coverage
			// check, one live-tail scan), and the serve/fallback is recorded so
			// Site Health shows when this path degrades.
			$bitmap_start = microtime( true );
			$per_device   = $bitmaps->get_visitors_by_dimension( 'device_id', $start_day, $date_end );
			$bitmaps->record_serve( null === $per_device ? null : count( $per_device ), microtime( true ) - $bitmap_start );

			if ( null === $per_device ) {
				// Store not ready for this range: count distinct visitors
				// per device from the sessions table instead — the session
				// start convention every session-grain query uses, no
				// statistics scan, no per-row join. This is the middle
				// ground that keeps the goals block off the raw
				// all-history statistics/sessions join (the heaviest query
				// the dashboard used to run) even when the bitmap store
				// cannot serve the range. NULLIF: the uid_id-0 bucket is
				// many unresolved visitors, not one — same convention as
				// the visitors metric.
				return $this->sessions_denominator_per_device( 'COUNT(DISTINCT NULLIF(uid_id, 0))', $date_start, $date_end );
			}

			$rows = [];
			foreach ( $per_device as $device_id => $visitors ) {
				$rows[] = (object) [
					'value'     => $visitors,
					'device_id' => $device_id,
				];
			}
			usort( $rows, static fn( object $a, object $b ): int => $b->value <=> $a->value );
			return array_slice( $rows, 0, 4 );
		}

		/**
		 * Per-device denominator from the sessions table: one grouped pass over
		 * the (start_time-indexed) sessions rows. Shared by the sessions metric
		 * and the visitors bitmap fallback.
		 *
		 * @param string $count_expr Aggregate for the value column — an internal
		 *                           constant ('COUNT(*)' or the distinct-uid_id
		 *                           variant), never request data.
		 * @param int    $date_start Range start (unix timestamp).
		 * @param int    $date_end   Range end (unix timestamp).
		 * @return array<int, object>|null Rows with ->value and ->device_id, or null for the raw fallback.
		 */
		private function sessions_denominator_per_device( string $count_expr, int $date_start, int $date_end ): ?array {
			if ( ! Session_Grain_Shape::session_grain_ready() ) {
				return null;
			}
			global $wpdb;
			// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- fixed table name and internal aggregate, values prepared.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT {$count_expr} AS value, device_id FROM {$wpdb->prefix}burst_sessions
					WHERE start_time > %d AND start_time <= %d AND has_pageview = 1 AND device_id > 0
					GROUP BY device_id ORDER BY value DESC LIMIT 4",
					$date_start,
					$date_end
				)
			);
			// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			return is_array( $rows ) ? $rows : null;
		}

		/**
		 * Get translatable device name based on device type
		 */
		public function get_device_name(
			string $device
		): string {
			switch ( $device ) {
				case 'desktop':
					$device_name = __( 'Desktop', 'burst-statistics' );
					break;
				case 'mobile':
					$device_name = __( 'Mobile', 'burst-statistics' );
					break;
				case 'tablet':
					$device_name = __( 'Tablet', 'burst-statistics' );
					break;
				case 'other':
				default:
					$device_name = __( 'Other', 'burst-statistics' );
					break;
			}

			return $device_name;
		}

		/**
		 * Schema of the goal statistics table, read by install_goal_statistics_table() and the schema check.
		 *
		 * @return array<string, array{columns: string, indexes?: array<int, string[]>}>
		 */
		protected function get_schema_definition(): array {
			return [
				'burst_goal_statistics' => [
					'columns' => '
                `ID` int NOT NULL AUTO_INCREMENT,
                `statistic_id` int NOT NULL,
                `goal_id` int NOT NULL,
                PRIMARY KEY (ID),
                UNIQUE KEY goal_statistic_unique (goal_id, statistic_id)
            ',
					'indexes' => [
						[ 'statistic_id' ],
						[ 'goal_id' ],
					],
				],
			];
		}

		/**
		 * Install goal statistic table
		 * */
		public function install_goal_statistics_table(): void {
			$this->install_schema( [ 'burst_goal_statistics' ] );
		}
	}
}
