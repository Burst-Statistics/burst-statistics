<?php
/**
 * avg_max_scroll is a core metric.
 *
 * max_scroll is written by the shared tracker, and the shared reading
 * engagement block selects avg_max_scroll whenever the column exists. When
 * the metric was only registered by Pro, the free plugin logged
 * "Metric 'avg_max_scroll' is not allowed" on every engagement request and
 * silently scored on time only.
 *
 * The free suite boots a real WordPress install (see bootstrap.php) without
 * wp-phpunit, so this extends the plain PHPUnit TestCase.
 *
 * @package Burst
 */

use PHPUnit\Framework\TestCase;
use Burst\Admin\Statistics\Statistics_Allowlist;
use Burst\Admin\Statistics\Statistics_Query;

class AvgMaxScrollMetricTest extends TestCase {

	/**
	 * Boot the shared admin (registers the core metric handlers).
	 */
	protected function setUp(): void {
		parent::setUp();

		// User 1 is the administrator created by `wp core install`.
		wp_set_current_user( 1 );

		$loader                   = \Burst\burst_loader();
		$loader->has_admin_access = true;
		if ( ! isset( $loader->admin ) ) {
			$loader->admin = new \Burst\Admin\Admin();
		}
		$loader->admin->init();
	}

	/**
	 * The non-strict allowlist accepts the metric without any Pro filter.
	 */
	public function test_metric_is_allowed_without_pro_filters(): void {
		remove_all_filters( 'burst_allowed_metrics' );
		$allowlist = new Statistics_Allowlist( false );
		$this->assertContains( 'avg_max_scroll', $allowlist->metrics() );
	}

	/**
	 * The core handler emits the AVG expression, so the sanitizer no longer
	 * replaces the metric with 'pageviews'.
	 */
	public function test_select_sql_averages_max_scroll(): void {
		$end = time();
		$sql = Statistics_Query::create( 'reading_engagement' )
			->date_range( $end - DAY_IN_SECONDS, $end )
			->select( [ 'page_url', 'avg_time_on_page', 'avg_max_scroll' ] )
			->group_by( [ 'page_url' ] )
			->to_query()
			->prepare_sql();

		$this->assertStringContainsString( 'AVG( statistics.max_scroll ) AS avg_max_scroll', $sql );
	}
}
