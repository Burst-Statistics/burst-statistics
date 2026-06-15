<?php
/**
 * Allowlist resolver for Statistics_Query.
 *
 * @package Burst\Admin\Statistics
 */
namespace Burst\Admin\Statistics;

defined( 'ABSPATH' ) || die();

/**
 * Resolves whitelisted metrics, filter keys, group_by tokens, and order_by tokens for a
 * Statistics_Query based on strict mode.
 *
 * Strict mode = consumer is NOT a trusted admin/REST caller (frontend shortcodes, share-link
 * viewers, unauthenticated contexts). Strict mode restricts the metric catalog and disables
 * the filter keys / group_by / order_by tokens that could leak data beyond the share link's
 * intended scope.
 *
 * Lives as a sibling of Statistics_Query rather than inside it so the SQL builder stays
 * focused on assembly; whitelisting/validation is a separable concern with its own filters.
 */
class Statistics_Allowlist {

	/**
	 * Resolved allowed metrics (key => label) after strict-mode + filter hooks.
	 *
	 * @var array<string, string>
	 */
	private array $allowed_metrics;

	/**
	 * Resolved allowed filter keys.
	 *
	 * @var array<int, string>
	 */
	private array $allowed_filter_keys;

	/**
	 * Resolved allowed group_by tokens.
	 *
	 * @var array<int, string>
	 */
	private array $allowed_group_by;

	/**
	 * Resolved allowed order_by tokens (each metric with ASC/DESC variants).
	 *
	 * @var array<int, string>
	 */
	private array $allowed_order_by;

	/**
	 * Full metric catalog (key => label) before strict-mode filtering.
	 *
	 * @var array<string, string>
	 */
	private array $metrics_catalog;

	/**
	 * Metric keys that remain permitted in strict mode (frontend / share-link).
	 *
	 * @var array<int, string>
	 */
	private array $strict_metric_keys = [
		'pageviews',
		'visitors',
		'sessions',
		'bounce_rate',
		'avg_time_on_page',
		'first_time_visitors',
		'page_url',
		'referrer',
		'device',
	];

	/**
	 * Build the allowlist once for a given strict-mode setting.
	 *
	 * @param bool $strict Whether the parent query runs in strict mode.
	 */
	public function __construct( private bool $strict ) {
		$this->metrics_catalog = [
			'host'                 => 'Domain',
			'page_url'             => 'Page',
			'referrer'             => 'Referrer',
			'pageviews'            => 'Pageviews',
			'sessions'             => 'Sessions',
			'visitors'             => 'Visitors',
			'avg_time_on_page'     => 'Avg. time on page',
			'avg_session_duration' => 'Avg. session duration',
			'conversion_rate'      => 'Goal conv. rate',
			'first_time_visitors'  => 'New visitors',
			'conversions'          => 'Goal completions',
			'bounces'              => 'Bounced visitors',
			'bounce_rate'          => 'Bounce rate',
			'device'               => 'Device',
			'browser'              => 'Browser',
			'platform'             => 'Platform',
			'device_id'            => 'Device',
			'browser_id'           => 'Browser',
			'platform_id'          => 'Platform',
			'count'                => 'Count',
			'period'               => 'Period',
			'active_time'          => 'Active time',
			'time_on_page'         => 'Time on page',
			'time'                 => 'Time',
			'uid'                  => 'UID',
			'page_id'              => 'Page ID',
		];

		// Order matters: order_by + group_by both derive from the allowed-metrics list.
		$this->init_allowed_metrics();
		$this->init_allowed_filter_keys();
		$this->init_allowed_group_by();
		$this->init_allowed_order_by();
	}

	/**
	 * Return the full metric catalog (unfiltered).
	 *
	 * @return array<string, string> key => label.
	 */
	public function metrics_catalog(): array {
		return $this->metrics_catalog;
	}

	/**
	 * Return allowed metric keys after strict-mode filtering.
	 *
	 * @return array<int, string>
	 */
	public function metrics(): array {
		return array_keys( $this->allowed_metrics );
	}

	/**
	 * Return allowed filter keys.
	 *
	 * @return array<int, string>
	 */
	public function filter_keys(): array {
		return $this->allowed_filter_keys;
	}

	/**
	 * Return allowed group_by tokens.
	 *
	 * @return array<int, string>
	 */
	public function group_by(): array {
		return $this->allowed_group_by;
	}

	/**
	 * Return allowed order_by tokens.
	 *
	 * @return array<int, string>
	 */
	public function order_by(): array {
		return $this->allowed_order_by;
	}

	/**
	 * Return localized labels for allowed metrics.
	 *
	 * Labels come from a translation-aware filter and are intersected with the allowed-metric
	 * keys, so strict-mode and the `burst_allowed_metrics` filter both narrow the result.
	 *
	 * @return array<string, string> key => localized label.
	 */
	public function metric_labels(): array {
		$labels = apply_filters(
			'burst_allowed_metrics_labels',
			[
				'host'                  => __( 'Domain', 'burst-statistics' ),
				'page_url'              => __( 'Page', 'burst-statistics' ),
				'referrer'              => __( 'Referrer', 'burst-statistics' ),
				'pageviews'             => __( 'Pageviews', 'burst-statistics' ),
				'sessions'              => __( 'Sessions', 'burst-statistics' ),
				'visitors'              => __( 'Visitors', 'burst-statistics' ),
				'avg_time_on_page'      => __( 'Avg. time on page', 'burst-statistics' ),
				'avg_session_duration'  => __( 'Avg. session duration', 'burst-statistics' ),
				'conversion_rate'       => __( 'Goal conv. rate', 'burst-statistics' ),
				'first_time_visitors'   => __( 'New visitors', 'burst-statistics' ),
				'conversions'           => __( 'Goal completions', 'burst-statistics' ),
				'bounces'               => __( 'Bounced visitors', 'burst-statistics' ),
				'bounce_rate'           => __( 'Bounce rate', 'burst-statistics' ),
				'device'                => __( 'Device', 'burst-statistics' ),
				'browser'               => __( 'Browser', 'burst-statistics' ),
				'platform'              => __( 'Platform', 'burst-statistics' ),
				'device_id'             => __( 'Device', 'burst-statistics' ),
				'browser_id'            => __( 'Browser', 'burst-statistics' ),
				'platform_id'           => __( 'Platform', 'burst-statistics' ),
				'country_code'          => __( 'Country', 'burst-statistics' ),
				'city'                  => __( 'City', 'burst-statistics' ),
				'state'                 => __( 'State', 'burst-statistics' ),
				'continent'             => __( 'Continent', 'burst-statistics' ),
				'continent_code'        => __( 'Continent', 'burst-statistics' ),
				'source'                => __( 'Source', 'burst-statistics' ),
				'medium'                => __( 'Medium', 'burst-statistics' ),
				'campaign'              => __( 'Campaign', 'burst-statistics' ),
				'term'                  => __( 'Term', 'burst-statistics' ),
				'content'               => __( 'Content', 'burst-statistics' ),
				'parameter'             => __( 'Parameter', 'burst-statistics' ),
				'parameters'            => __( 'Parameters', 'burst-statistics' ),
				'product'               => __( 'Product', 'burst-statistics' ),
				'sales'                 => __( 'Sales', 'burst-statistics' ),
				'revenue'               => __( 'Revenue', 'burst-statistics' ),
				'page_value'            => __( 'Page value', 'burst-statistics' ),
				'sales_conversion_rate' => __( 'Sales conv. rate', 'burst-statistics' ),
				'entrances'             => __( 'Entrances', 'burst-statistics' ),
				'exit_rate'             => __( 'Exit rate', 'burst-statistics' ),
				'avg_order_value'       => __( 'Avg. order value', 'burst-statistics' ),
				'adds_to_cart'          => __( 'Added to cart', 'burst-statistics' ),
			]
		);

		$allowed_keys = array_keys( $this->allowed_metrics );
		return array_intersect_key( $labels, array_flip( $allowed_keys ) );
	}

	/**
	 * Resolve allowed metrics. In strict mode the catalog is narrowed to $strict_metric_keys
	 * (with the `burst_allowed_metric_keys` filter giving extensions a hook). Both modes pass
	 * through `burst_allowed_metrics` so callers can add or remove entries dynamically.
	 */
	private function init_allowed_metrics(): void {
		$metrics = $this->metrics_catalog;
		if ( $this->strict ) {
			$keys    = apply_filters( 'burst_allowed_metric_keys', $this->strict_metric_keys, $this->strict );
			$metrics = array_intersect_key( $metrics, array_flip( $keys ) );
		}

		$this->allowed_metrics = apply_filters( 'burst_allowed_metrics', $metrics, $this->strict );
	}

	/**
	 * Resolve allowed filter keys. Strict mode exposes only safe dimensions (page/referrer/
	 * device family); non-strict additionally permits goal_id, bounce/new-visitor toggles,
	 * lookup-ID variants, and time_per_session — these can leak detailed visitor info and
	 * are restricted to authenticated admin contexts.
	 */
	private function init_allowed_filter_keys(): void {
		$keys = [
			'page_type',
			'page_id',
			'page_url',
			'referrer',
			'device',
			'browser',
			'platform',
		];

		if ( ! $this->strict ) {
			$extra = [
				'goal_id',
				'bounces',
				'new_visitor',
				'device_id',
				'browser_id',
				'platform_id',
				'time_per_session',
			];

			$keys = array_merge( $keys, $extra );
		}

		$this->allowed_filter_keys = apply_filters( 'burst_statistics_allowed_filter_keys', $keys, $this->strict );
	}

	/**
	 * Resolve allowed group_by tokens. Strict mode uses an explicit hardcoded list so callers
	 * can't group by arbitrary metric values. Non-strict mode allows any allowed metric plus
	 * 'period' (the synthetic date-bucket dimension).
	 */
	private function init_allowed_group_by(): void {
		if ( $this->strict ) {
			$group_by = [
				'page_type',
				'page_id',
				'page_url',
				'referrer',
				'device',
				'browser',
				'platform',
				'period',
				'continent_code',
			];
		} else {
			$group_by   = $this->metrics();
			$group_by[] = 'period';
		}

		$this->allowed_group_by = apply_filters( 'burst_statistics_allowed_group_by', $group_by, $this->strict );
	}

	/**
	 * Resolve allowed order_by tokens. Each allowed metric gets three variants (bare, ASC,
	 * DESC) so the validator in Statistics_Query can match the user-supplied token verbatim.
	 */
	private function init_allowed_order_by(): void {
		$order_by = [];
		foreach ( $this->metrics() as $metric ) {
			$order_by[] = $metric . ' DESC';
			$order_by[] = $metric . ' ASC';
			$order_by[] = $metric;
		}

		$this->allowed_order_by = apply_filters( 'burst_statistics_allowed_order_by', $order_by, $this->strict );
	}
}
