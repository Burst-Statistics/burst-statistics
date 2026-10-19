<?php
namespace Burst\Admin\Engagement;

use Burst\Admin\Database\Query;
use Burst\Admin\Database\Query_Executor;
use Burst\Admin\Statistics\Co2_Config;
use Burst\Admin\Statistics\Green_Hosting;
use Burst\Admin\Statistics\Page_Weight_Store;
use Burst\Admin\Statistics\Statistics_Data;
use Burst\Admin\Statistics\Statistics_Query;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

class Page_Weight {
	use Admin_Helper;
	use Database_Helper;
	use Helper;

	/**
	 * Rows shown in the compact block. The full list lives in the overlay,
	 * which goes through the page-weight datatable instead.
	 *
	 * @var int
	 */
	private const TOP_PAGES = 5;

	/**
	 * Initialize the page weight class.
	 */
	public function init(): void {
		add_filter( 'burst_get_data', [ $this, 'get_page_weight_data' ], 10, 3 );
		add_filter( 'burst_datatable_config', [ $this, 'register_page_weight_datatable' ] );
		add_filter( 'burst_datatable_query', [ $this, 'adjust_page_weight_datatable' ], 10, 2 );
		add_filter( 'burst_datatable_id_tab_map', [ $this, 'register_page_weight_tab_mapping' ] );
		add_filter( 'burst_endpoint_tab_map', [ $this, 'register_page_weight_endpoint_mapping' ] );
		add_filter( 'burst_do_action', [ $this, 'handle_do_action' ], 10, 2 );
	}

	/**
	 * Register the page-weight datatable (metrics allow-list + capability).
	 *
	 * @param array $config Existing datatable config keyed by datatable id.
	 * @return array Config including the page-weight datatable.
	 */
	public function register_page_weight_datatable( array $config ): array {
		$config['page-weight'] = [
			'metrics'    => [ 'page_url', 'page_weight', 'pageviews', 'co2' ],
			'capability' => 'view_burst_statistics',
		];
		return $config;
	}

	/**
	 * Make the page-weight overlay list the same pages, at the same weights,
	 * as the block.
	 *
	 * For a past range it weighs the pages as of the range's end, so the
	 * overlay does not show today's weights next to the block's. For every
	 * range it drops pages without a reportable weight, as the block's top
	 * pages do, instead of listing them with an empty weight.
	 *
	 * @param Statistics_Query $query The datatable query.
	 * @param array            $args  The datatable request arguments.
	 * @return Statistics_Query The adjusted query.
	 */
	public function adjust_page_weight_datatable( Statistics_Query $query, array $args ): Statistics_Query {
		if ( 'page-weight' !== ( $args['id'] ?? '' ) ) {
			return $query;
		}

		$known_at = $this->weights_known_at( (int) ( $args['date_end'] ?? 0 ) );
		if ( null !== $known_at ) {
			$this->weigh_query( $query, $known_at, null );
		}

		// On the joined column rather than the page_weight alias: the reader can
		// hide the weight column, and the alias goes with it. with() is a no-op
		// when weigh_query() already joined page_weights to the history.
		$query->with( 'page_weights' );
		$query->having_raw( 'MAX(page_weights.page_weight) IS NOT NULL' );
		return $query;
	}

	/**
	 * Map the page-weight datatable to the engagement tab for shared viewer access control.
	 *
	 * @param array<string, string> $map Datatable ID => tab slug.
	 * @return array<string, string> Map including the page-weight datatable.
	 */
	public function register_page_weight_tab_mapping( array $map ): array {
		$map['page-weight'] = 'engagement';
		return $map;
	}

	/**
	 * Map the block's own endpoint to the engagement tab for shared viewer access.
	 *
	 * The datatable mapping above only covers the fullscreen overlay. The block
	 * itself reads data/page_weight, and Share_Routing denies any endpoint it
	 * cannot resolve to a tab, so without this the block fails on every shared
	 * Engagement dashboard.
	 *
	 * @param array<string, string> $map Endpoint path => tab slug.
	 * @return array<string, string> Map including the page weight endpoint.
	 */
	public function register_page_weight_endpoint_mapping( array $map ): array {
		$map['data/page_weight'] = 'engagement';
		return $map;
	}

	/**
	 * Run a green hosting check on request from the Page weight block.
	 *
	 * This button is the only thing that ever contacts the Green Web
	 * Foundation: the click is the consent, both for this request and for the
	 * weekly refreshes that keep the answer current afterwards. A verified
	 * result goes straight into the numbers. Whether the lookup succeeded is
	 * read from the returned status: a forced refresh resets failed_attempts
	 * on success and increments it on every failure.
	 *
	 * @param array  $output The output from earlier burst_do_action handlers.
	 * @param string $action The requested action.
	 * @return array The green hosting state for check_green_hosting, otherwise $output.
	 */
	public function handle_do_action( array $output, string $action ): array {
		if ( 'check_green_hosting' !== $action ) {
			return $output;
		}

		Green_Hosting::refresh( true );

		return [ 'green_hosting' => $this->get_green_hosting_state() ];
	}

	/**
	 * Provide the Page weight block payload for the `page_weight` REST type.
	 *
	 * @param array  $data The pre-existing data (returned untouched for other types).
	 * @param string $type The requested data type.
	 * @param array  $args Normalized request args (includes date_start/date_end as unix timestamps).
	 * @return array The block payload for the page_weight type, otherwise $data.
	 */
	public function get_page_weight_data( array $data, string $type, array $args ): array {
		if ( $type !== 'page_weight' ) {
			return $data;
		}

		$start   = isset( $args['date_start'] ) ? (int) $args['date_start'] : 0;
		$end     = isset( $args['date_end'] ) ? (int) $args['date_end'] : time();
		$filters = (array) ( $args['filters'] ?? [] );

		$current_weights_known_at = $this->weights_known_at( $end );
		$current                  = $this->query_summary( $start, $end, $filters, $current_weights_known_at, null, true );
		$pageviews                = (int) $current['pageviews'];

		// Both figures are reported over measured pageviews only: the total is
		// what Burst actually observed, and the average divides it by the same
		// pageviews it came from. Dividing by every pageview instead would
		// scale the average down by the share of the site still unmeasured and
		// drag the carbon rating down with it. The block states the coverage
		// alongside, so neither number is read as covering the whole site.
		$measured_pageviews = (int) $current['measured_pageviews'];
		$co2_per_pageview   = $measured_pageviews > 0 ? (float) $current['co2'] / $measured_pageviews : 0.0;

		return [
			'avg_bytes'              => (int) $current['page_weight'],
			'weight_trend'           => $this->get_weight_trend( $start, $end, $filters, $args, $current_weights_known_at ),
			'pageviews'              => $pageviews,
			// Ongoing only while the block is on live weights. A range reaching
			// now always is; every other range, yesterday included, is weighed
			// as of its end and never changes, so the block must not show it a
			// progress bar that cannot move — except during the bootstrap
			// window, where weights_known_at() keeps a past range live so the
			// measuring state shows instead of a dead "not enough data".
			'is_ongoing'             => null === $current_weights_known_at,
			'measured_ratio'         => $pageviews > 0 ? $measured_pageviews / $pageviews : 0.0,
			// How far sampling has come towards MIN_SAMPLES on every pageview's
			// page. It moves with each sample, where measured_ratio only moves
			// once a page has all its samples; the measuring state shows this.
			'sampling_progress'      => $pageviews > 0 ? min( 1, $current['samples'] / ( Page_Weight_Store::MIN_SAMPLES * $pageviews ) ) : 0.0,
			'total_co2_grams'        => (float) $current['co2'],
			'co2_per_pageview_grams' => $co2_per_pageview,
			'carbon_rating'          => Co2_Config::get_carbon_rating( $co2_per_pageview ),
			'green_preview'          => $this->get_green_preview( (float) $current['co2'], $co2_per_pageview ),
			'rows'                   => $this->query_top_pages( $start, $end, $filters, $current_weights_known_at ),
			'green_hosting'          => $this->get_green_hosting_state(),
		];
	}

	/**
	 * Compare the average weight against the previous period over the same pages.
	 *
	 * Only pages already measured by the end of the previous period count on
	 * both sides. Otherwise every page sampled since would move the average,
	 * and the trend would report coverage growth as a change in weight.
	 *
	 * @param int      $start                    Period start as a unix timestamp.
	 * @param int      $end                      Period end as a unix timestamp.
	 * @param array    $filters                  Active dashboard filters.
	 * @param array    $args                     Request args, for an explicit comparison range.
	 * @param int|null $current_weights_known_at Cutoff the current period is weighed at, null for live weights.
	 * @return array{current_avg_bytes: int, previous_avg_bytes: int}|null Null when either side has nothing measured, so the block hides the trend instead of comparing against nothing.
	 */
	private function get_weight_trend( int $start, int $end, array $filters, array $args, ?int $current_weights_known_at ): ?array {
		$previous_range            = Statistics_Data::calculate_comparison_dates( $start, $end, $args );
		$previous_weights_known_at = min( $previous_range['end'], time() );

		// Weighed as of its own end, the previous period already only covers
		// the pages measured by then.
		$previous = $this->query_summary( $previous_range['start'], $previous_range['end'], $filters, $previous_weights_known_at );
		if ( $previous['measured_pageviews'] <= 0 ) {
			return null;
		}

		$current = $this->query_summary( $start, $end, $filters, $current_weights_known_at, $previous_weights_known_at );
		if ( $current['measured_pageviews'] <= 0 ) {
			return null;
		}

		return [
			'current_avg_bytes'  => (int) $current['page_weight'],
			'previous_avg_bytes' => (int) $previous['page_weight'],
		];
	}

	/**
	 * The same figures recalculated on green hosting.
	 *
	 * Emissions are linear in grams-per-GB, so the green figures are the real
	 * ones scaled by the ratio between the two intensities. Sending them with
	 * the payload is what lets the block's preview toggle be pure display: no
	 * request, no stored state, and nothing that changes the numbers anyone
	 * else sees.
	 *
	 * @param float $total_grams      Emissions for the period as currently calculated.
	 * @param float $grams_per_view   Emissions per measured pageview as currently calculated.
	 * @return array{total_co2_grams: float, co2_per_pageview_grams: float, carbon_rating: string}
	 */
	private function get_green_preview( float $total_grams, float $grams_per_view ): array {
		$current = Co2_Config::get_grams_per_gb();
		$ratio   = $current > 0 ? Co2_Config::get_green_grams_per_gb() / $current : 1.0;

		$green_per_view = $grams_per_view * $ratio;

		return [
			'total_co2_grams'        => $total_grams * $ratio,
			'co2_per_pageview_grams' => $green_per_view,
			'carbon_rating'          => Co2_Config::get_carbon_rating( $green_per_view ),
		];
	}

	/**
	 * Query the period totals behind the block's headline figures.
	 *
	 * @param int      $start                  Period start as a unix timestamp.
	 * @param int      $end                    Period end as a unix timestamp.
	 * @param array    $filters                Active dashboard filters.
	 * @param int|null $weights_known_at       When given, weigh the pages with the
	 *                                         weights known at this timestamp
	 *                                         instead of today's.
	 * @param int|null $only_pages_measured_by When given, only count pages
	 *                                         measured at or before this timestamp.
	 * @param bool     $with_samples           Also sum each pageview's samples,
	 *                                         capped at MIN_SAMPLES, for the
	 *                                         sampling progress. Headline only.
	 * @return array{pageviews: int, measured_pageviews: int, page_weight: int, co2: float, samples: int}
	 */
	private function query_summary( int $start, int $end, array $filters, ?int $weights_known_at = null, ?int $only_pages_measured_by = null, bool $with_samples = false ): array {
		$query = Statistics_Query::create( $with_samples ? 'page_weight_summary_sampling' : 'page_weight_summary' )
			->date_range( $start, $end )
			->filters( $filters );

		$this->weigh_query( $query, $weights_known_at, $only_pages_measured_by );

		$metrics = [ 'pageviews', 'measured_pageviews', 'page_weight', 'co2' ];

		if ( $with_samples ) {
			$this->count_samples_known_at( $query, $weights_known_at );
			$metrics[] = 'page_weight_samples';
		}

		$row = $query
			->select( $metrics )
			->fetch( ARRAY_A );

		$row = $row[0] ?? [];

		return [
			'pageviews'          => (int) ( $row['pageviews'] ?? 0 ),
			'measured_pageviews' => (int) ( $row['measured_pageviews'] ?? 0 ),
			'page_weight'        => (int) ( $row['page_weight'] ?? 0 ),
			'co2'                => (float) ( $row['co2'] ?? 0 ),
			'samples'            => (int) ( $row['page_weight_samples'] ?? 0 ),
		];
	}

	/**
	 * Point the page_weight_samples metric at the sample counts known at a
	 * moment. Without one it keeps the registered live join.
	 *
	 * @param Statistics_Query $query            The summary query.
	 * @param int|null         $weights_known_at Count the samples known at this timestamp, null for today's.
	 */
	private function count_samples_known_at( Statistics_Query $query, ?int $weights_known_at ): void {
		if ( null === $weights_known_at ) {
			return;
		}

		// Every accepted sample writes one history row, so the rows up to the
		// cutoff are the samples known then.
		$counts = Query::create()
			->select( [ 'page_id', 'COUNT(*) AS samples' ] )
			->from( 'burst_page_weight_history' )
			->where( 'measured_at', $weights_known_at, '<=', '%d' )
			->group_by( 'page_id' )
			->prepare_sql();

		$query->join( 'sample_counts', '(' . $counts . ')', 'sample_counts.page_id = statistics.page_id', 'LEFT' );
	}

	/**
	 * The cutoff a range's weights are known at, null for live weights.
	 *
	 * A range that ends in the past is weighed as the pages were at its end,
	 * the same way the previous period is, so a past range is not judged by
	 * today's weights. A range reaching now keeps the live table: history as
	 * of now holds the same weights, and the direct join is cheaper.
	 *
	 * The bootstrap window is the exception: while the history holds nothing
	 * at the cutoff yet, the feature is newer than the range, and weighing at
	 * the cutoff can only produce an empty result. The default dashboard range
	 * ends yesterday, so right after install that empty result would be the
	 * first thing every user sees — a "not enough data" dead end hiding the
	 * sampling already under way. Falling through to live weights shows the
	 * measuring state (and its progress) instead.
	 *
	 * @param int $end Range end as a unix timestamp.
	 * @return int|null The timestamp to weigh the pages at, null for live weights.
	 */
	private function weights_known_at( int $end ): ?int {
		if ( $end >= time() ) {
			return null;
		}

		return $this->history_exists_by( $end ) ? $end : null;
	}

	/**
	 * Whether any page had a measurement on record by the cutoff.
	 *
	 * @param int $cutoff Unix timestamp.
	 * @return bool True once the history holds a row at or before the cutoff.
	 */
	private function history_exists_by( int $cutoff ): bool {
		$sql = Query::create()
			->select( [ 'measured_at' ] )
			->from( 'burst_page_weight_history' )
			->where( 'measured_at', $cutoff, '<=', '%d' )
			->limit( 1 )
			->prepare_sql();

		$sql = $this->add_query_timeout_hint(
			$sql,
			$this->resolve_query_timeout_ms( 'burst_query_timeout_ms', 'burst_query_timeout_ms_background' )
		);

		return null !== Query_Executor::create()
			->fingerprint( 'page_weight_history_exists' )
			->run( $sql, 'get_var' );
	}

	/**
	 * Point a query's page weights at a moment and/or at the pages measured by
	 * a moment. Without either it keeps the registered live join.
	 *
	 * @param Statistics_Query $query                  The query to adjust.
	 * @param int|null         $weights_known_at       Weigh each page with the weight known at this timestamp.
	 * @param int|null         $only_pages_measured_by Keep only pages measured at or before this timestamp.
	 */
	private function weigh_query( Statistics_Query $query, ?int $weights_known_at, ?int $only_pages_measured_by ): void {
		if ( null === $weights_known_at && null === $only_pages_measured_by ) {
			return;
		}

		$query->join( 'page_weights', $this->weights_subquery( $weights_known_at, $only_pages_measured_by ), 'page_weights.page_id = statistics.page_id', 'LEFT' );
	}

	/**
	 * A stand-in for burst_page_weights, weighed at a moment and/or limited to
	 * the pages measured by a moment.
	 *
	 * Registered under the page_weights alias, so the page_weight, co2 and
	 * measured_pageviews metrics need no change — only what they read from does.
	 * Pages left out are absent, which the metrics already treat as unmeasured
	 * rather than as zero.
	 *
	 * @param int|null $weights_known_at       Weigh each page with the weight known at this timestamp, null for live weights.
	 * @param int|null $only_pages_measured_by Keep only pages measured at or before this timestamp, null for all.
	 * @return string A derived table, ready to use as a join source.
	 */
	private function weights_subquery( ?int $weights_known_at, ?int $only_pages_measured_by ): string {
		if ( null === $weights_known_at ) {
			$weights = Query::create()
				->select( [ 'w.page_id', 'w.page_weight' ] )
				->from( 'burst_page_weights', 'w' )
				->where( 'w.samples', Page_Weight_Store::MIN_SAMPLES, '>=', '%d' );
		} else {
			$weights = Query::create()
				->select( [ 'w.page_id', 'w.page_weight' ] )
				->from( 'burst_page_weight_history', 'w' )
				->inner_join( '(' . $this->latest_measurements_sql( $weights_known_at ) . ')', 'latest.page_id = w.page_id AND latest.measured_at = w.measured_at', 'latest' );
		}

		if ( null !== $only_pages_measured_by ) {
			$weights->inner_join( '(' . $this->latest_measurements_sql( $only_pages_measured_by ) . ')', 'measured.page_id = w.page_id', 'measured' );
		}

		// The joined queries come back fully prepared, so the result can be
		// handed to the outer query as a finished join source.
		return '(' . $weights->prepare_sql() . ')';
	}

	/**
	 * The newest history row of each page measured often enough by a cutoff.
	 *
	 * Every accepted sample writes one history row, so the row count up to the
	 * cutoff is the page's sample count at that moment: the same rule the live
	 * join applies with burst_page_weights.samples.
	 *
	 * @param int $cutoff Unix timestamp.
	 * @return string Prepared SQL selecting page_id and measured_at.
	 */
	private function latest_measurements_sql( int $cutoff ): string {
		return Query::create()
			->select( [ 'page_id', 'MAX(measured_at) AS measured_at' ] )
			->from( 'burst_page_weight_history' )
			->where( 'measured_at', $cutoff, '<=', '%d' )
			->group_by( 'page_id' )
			->having_raw( 'COUNT(*) >= ' . Page_Weight_Store::MIN_SAMPLES )
			->prepare_sql();
	}

	/**
	 * Query the heaviest measured pages of the period.
	 *
	 * Unmeasured pages join to a NULL weight and are dropped in HAVING, so the
	 * list only ever shows pages Burst has actually sampled.
	 *
	 * @param int      $start            Period start as a unix timestamp.
	 * @param int      $end              Period end as a unix timestamp.
	 * @param array    $filters          Active dashboard filters.
	 * @param int|null $weights_known_at When given, list the pages with the
	 *                                   weights known at this timestamp, so the
	 *                                   table agrees with the headline.
	 * @return array<int, array{page_url: string, page_weight: int, pageviews: int}>
	 */
	private function query_top_pages( int $start, int $end, array $filters, ?int $weights_known_at = null ): array {
		$query = Statistics_Query::create( 'page_weight_top_pages' )
			->date_range( $start, $end )
			->filters( $filters );
		$this->weigh_query( $query, $weights_known_at, null );

		$rows = $query
			->select( [ 'page_url', 'page_weight', 'pageviews' ] )
			->where( 'statistics.page_url', '', '!=' )
			->group_by( 'page_url' )
			->having_raw( 'page_weight IS NOT NULL' )
			->order_by( 'page_weight DESC' )
			->limit( self::TOP_PAGES )
			->fetch( ARRAY_A );

		return array_map(
			static function ( array $row ): array {
				return [
					'page_url'    => (string) $row['page_url'],
					'page_weight' => (int) $row['page_weight'],
					'pageviews'   => (int) $row['pageviews'],
				];
			},
			$rows
		);
	}

	/**
	 * Return the green hosting state the block renders its footer from.
	 *
	 * @return array{checked: bool, status: array}
	 */
	private function get_green_hosting_state(): array {
		return [
			'checked' => Green_Hosting::has_been_checked(),
			'status'  => Green_Hosting::get_status(),
		];
	}
}
