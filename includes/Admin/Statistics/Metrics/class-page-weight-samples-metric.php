<?php
/**
 * Page weight samples metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Page_Weight_Store;
use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || die();

/**
 * Handles SQL generation for the 'page_weight_samples' metric.
 */
class Page_Weight_Samples_Metric implements Metric_Handler_Interface {

	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'page_weight_samples';
	}

	/**
	 * Accumulates SELECT expression and required joins onto the Statistics_Query object.
	 *
	 * Sums, over the pageviews, how many samples each pageview's page has,
	 * capped at MIN_SAMPLES. Held against MIN_SAMPLES * pageviews this is how
	 * far sampling has come, and unlike measured_pageviews it moves with every
	 * sample. Reads the sample_counts join, which a caller can point at the
	 * counts known at an earlier moment.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		$samples = 'LEAST(COALESCE(sample_counts.samples, 0), ' . Page_Weight_Store::MIN_SAMPLES . ')';

		// Same pageviews as Pageviews_Metric counts, so the share stays within 0 and 1.
		if ( $qd->get_exclude_bounces() ) {
			$samples = "CASE WHEN COALESCE(sessions.bounce, 0) = 0 THEN {$samples} ELSE 0 END";
			$qd->with( 'sessions' );
		}

		$qd->add_select( "SUM({$samples}) AS page_weight_samples" );
		$qd->with( 'sample_counts' );
	}
}
