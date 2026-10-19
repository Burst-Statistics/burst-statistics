<?php
/**
 * Page weight storage for CO2 reporting.
 *
 * @package Burst\Admin\Statistics
 */
namespace Burst\Admin\Statistics;

defined( 'ABSPATH' ) || die();

/**
 * Stores the data a pageview actually transferred, as a rolling average per page.
 *
 * Samples come from every visitor, new or returning, so the average already
 * reflects how much of the page browsers had cached: the CO2 metric charges it
 * to every pageview as it is, with no caching model on top.
 */
class Page_Weight_Store {

	public const MIN_BYTES              = 1024;
	public const MAX_BYTES              = 10485760;
	public const DEFAULT_SAMPLE_RATE    = 0.1;
	public const DEFAULT_REMEASURE_DAYS = 1;

	/**
	 * Samples a page needs before its weight is reported. A single sample can
	 * come from a warm-cache visit and sit far from the page's real weight, so
	 * a page below this counts as unmeasured everywhere: average, coverage,
	 * CO2 and the top pages. At one sample per remeasure interval a page needs
	 * at least MIN_SAMPLES intervals before it counts.
	 */
	public const MIN_SAMPLES = 3;

	/**
	 * Ceiling on the sample count used to weight the stored average. Past this
	 * many samples, a new sample always contributes 1/(MAX_ROLLING_SAMPLES+1)
	 * of the average (an exponential decay), so old measurements lose influence
	 * instead of accumulating forever — without this cap the formula below is an
	 * all-time equal-weight mean that a redesign can take roughly a year to
	 * reflect even halfway, at the default remeasure interval.
	 */
	private const MAX_ROLLING_SAMPLES = 12;

	/**
	 * Return the client-side sample rate.
	 *
	 * Filterable rather than stored: there is no setting for it, and the only
	 * caller that needs another value is the page weight e2e test, which forces
	 * 1 so every run measures.
	 */
	public static function get_sample_rate(): float {
		$rate = (float) apply_filters( 'burst_page_weight_sample_rate', self::DEFAULT_SAMPLE_RATE );
		return min( 1, max( 0, $rate ) );
	}

	/**
	 * Maybe process a validated update-hit page weight sample.
	 *
	 * @param array<string, mixed> $data         Sanitized tracking data.
	 * @param string               $hit_type     Tracking operation type.
	 * @param array<string, mixed> $previous_hit Existing statistic matched by the update.
	 */
	public static function maybe_store_sample( array $data, string $hit_type, array $previous_hit ): void {
		if ( $hit_type !== 'update' || empty( $previous_hit['ID'] ) || empty( $previous_hit['session_id'] ) ) {
			return;
		}

		$bytes = (int) ( $data['page_weight_bytes'] ?? 0 );
		if ( $bytes < self::MIN_BYTES || $bytes > self::MAX_BYTES ) {
			return;
		}

		$page_url = (string) ( $data['page_url'] ?? '' );
		if ( $page_url === '' || strlen( $page_url ) > 191 ) {
			return;
		}

		if ( ! hash_equals( (string) ( $previous_hit['page_url'] ?? '' ), $page_url ) ) {
			return;
		}

		$parameters = (string) ( $data['parameters'] ?? '' );
		if ( ! hash_equals( (string) ( $previous_hit['parameters'] ?? '' ), $parameters ) ) {
			return;
		}

		// Weights are keyed on page_id, because that is the grain the statistics
		// aggregation groups at: one url can carry several page_ids (an old
		// slug, a reused path), and keying on the url would hand one page's
		// measurement to every other page sharing it. page_id 0 is the tracker's
		// marker for a hit it could not resolve — 404s above all — and every
		// such hit would collide on the same key, so those are not sampled.
		$page_id = (int) ( $previous_hit['page_id'] ?? 0 );
		if ( 0 === $page_id ) {
			return;
		}

		self::store_sample( $page_id, $bytes );
	}

	/**
	 * Fold a sample into the page's rolling average and record the result.
	 *
	 * Written on the hit itself. A page measured within the remeasure interval
	 * keeps its stored weight: every column is only replaced when the stored
	 * row is stale, so the upsert leaves a fresh row untouched and reports no
	 * change.
	 *
	 * @param int $page_id The page the sample belongs to.
	 * @param int $bytes   The bytes the pageview transferred.
	 */
	private static function store_sample( int $page_id, int $bytes ): void {
		global $wpdb;

		$now       = time();
		$stale_cut = $now - ( self::DEFAULT_REMEASURE_DAYS * DAY_IN_SECONDS );

		// Inside ON DUPLICATE KEY UPDATE a bare column is the stored row and
		// VALUES() is the new sample. Every column is only replaced when the
		// stored row is older than the remeasure cutoff. The weighting term is capped
		// at MAX_ROLLING_SAMPLES so a new sample always contributes at least
		// 1/(MAX_ROLLING_SAMPLES+1) of the average once a page has enough
		// history, instead of shrinking forever. MySQL applies the assignments
		// left to right, so measured_at is set last: every IF() before it must
		// still read the stored timestamp.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$stored = $wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$wpdb->prefix}burst_page_weights (page_id, page_weight, samples, measured_at)
				VALUES (%d, %d, 1, %d)
				ON DUPLICATE KEY UPDATE
					page_weight = IF(
						measured_at < %d,
						ROUND( ( page_weight * LEAST( samples, %d ) + VALUES(page_weight) ) / ( LEAST( samples, %d ) + 1 ) ),
						page_weight
					),
					samples = IF( measured_at < %d, samples + 1, samples ),
					measured_at = IF( measured_at < %d, VALUES(measured_at), measured_at )",
				$page_id,
				$bytes,
				$now,
				$stale_cut,
				self::MAX_ROLLING_SAMPLES,
				self::MAX_ROLLING_SAMPLES,
				$stale_cut,
				$stale_cut
			)
		);

		// Nothing changed: the page was measured recently enough.
		if ( empty( $stored ) ) {
			return;
		}

		// burst_page_weights only ever holds the current average per page, so the
		// value just written is the only record that this was the weight at this
		// moment. Copy it into the history table, which is what lets a comparison
		// against an earlier period use the weight that was known back then
		// instead of today's. Keyed on (page_id, measured_at), so a second
		// write within the same second updates rather than duplicates.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$wpdb->prefix}burst_page_weight_history (page_id, page_weight, measured_at)
				SELECT page_id, page_weight, measured_at
				FROM {$wpdb->prefix}burst_page_weights
				WHERE page_id = %d
				ON DUPLICATE KEY UPDATE page_weight = VALUES(page_weight)",
				$page_id
			)
		);
	}
}
