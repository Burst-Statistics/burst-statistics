<?php
/**
 * Page URL metric handler.
 *
 * @package Burst\Admin\Statistics\Metrics
 */
namespace Burst\Admin\Statistics\Metrics;

use Burst\Admin\Statistics\Statistics_Query;
use Burst\Traits\Database_Helper;

defined( 'ABSPATH' ) || die();

/**
 * Class Page_Url_Metric - Handles SQL generation for the 'page_url' metric.
 *
 * When the query groups on page_url and the page dictionary is ready, the
 * grouping is rewritten to the integer statistics.page_id column (positive =
 * WP post id, negative = burst_page_urls.ID for urls that resolve to no
 * post), and the display url is joined back from the dictionary. Grouping on
 * a 4-byte int instead of the varchar url is what lets the aggregation run on
 * the narrow (time, page_id, uid_id) index; url variants of one post (an old
 * slug, comment pagination) merge into one row showing the canonical url.
 */
class Page_Url_Metric implements Metric_Handler_Interface {
	use Database_Helper;

	/**
	 * Returns the metric key.
	 */
	public function key(): string {
		return 'page_url';
	}

	/**
	 * Accumulates SELECT expression onto the Statistics_Query object.
	 *
	 * @param Statistics_Query $qd The query data accumulator.
	 */
	public function apply( Statistics_Query $qd ): void {
		if ( ! in_array( 'page_url', $qd->get_group_by(), true ) || ! $this->page_dictionary_ready() || $this->status_filter_allows_404( $qd ) ) {
			$qd->add_select( 'statistics.page_url AS page_url' );
			return;
		}

		// The aggregation stays a pure covering scan over (time, page_id, uid_id):
		// no joins and no page_url column in the SQL — a per-row dictionary
		// join (or selecting statistics.page_url) would probe/read the wide
		// clustered rows for every hit in range and undo the entire win. The
		// integer page_id lands under the page_url alias; fetch() hydrates it
		// to the display url afterwards, over only the grouped result rows.
		$qd->add_select( 'statistics.page_id AS page_url' );
		$qd->set_group_by_aliases( [ 'page_url' => 'statistics.page_id' ] );
		$qd->request_page_url_hydration();
	}

	/**
	 * Whether the query's status filter lets 404 hits into the result set.
	 *
	 * 404 hits are stored with page_id = 0 by design (the tracker never assigns
	 * them a dictionary id and the backfill skips them), so under page-grain
	 * grouping every distinct 404 url would collapse into a single row whose
	 * page_id 0 hydrates to an empty url. Without a status filter the builder
	 * appends page_type != '404' itself (see build_query_internal()), which
	 * keeps the page-grain path safe. With one, the rows are excluded only for
	 * '200' include or '404' exclude — 'all' skips the page_type condition
	 * entirely, and '404' include / '200' exclude select 404 rows. In those
	 * cases the caller must keep grouping on the url string.
	 *
	 * @param Statistics_Query $qd The query being built.
	 */
	private function status_filter_allows_404( Statistics_Query $qd ): bool {
		$filters = $qd->get_filters();
		if ( ! isset( $filters['status'] ) ) {
			return false;
		}

		// The sanitizer casts numeric values to int; compare as string like
		// add_filter_condition() effectively does after PHP's type coercion.
		$status     = (string) $filters['status'];
		$is_exclude = ( $qd->get_filter_exclusions()['status'] ?? 'include' ) === 'exclude';
		return 'all' === $status || ( ( '404' === $status ) !== $is_exclude );
	}
}
