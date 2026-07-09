<?php
/**
 * Tracking health detector.
 *
 * Lives in core (not Pro/) so it syncs to the free plugin and runs for all users.
 * Runs once a day on `burst_daily` and decides whether yesterday's recorded hits
 * have fallen away compared to a same-weekday baseline. It only computes and stores
 * an internal status — it does not render UI or send mail.
 *
 * @package Burst\Admin
 */

namespace Burst\Admin;

use Burst\Admin\Cron\Cron;
use Burst\Admin\Statistics\Statistics_Query;

defined( 'ABSPATH' ) || exit;

/**
 * Class Tracking_Health
 *
 * Detects a collapse in recorded tracking hits. A "hit" is a row in the
 * burst_statistics table (counted via the `pageviews` metric, i.e.
 * COUNT(DISTINCT statistics.ID)); when the beacon stops recording, this count
 * drops to zero or a small fraction of the historical baseline.
 */
class Tracking_Health {

	/**
	 * Number of previous same-weekdays averaged into the baseline.
	 *
	 * @var int
	 */
	protected const COMPARISON_WEEKS = 4;

	/**
	 * Minimum number of past weeks that must have data before a baseline is
	 * trusted. Below this we never alarm — protects brand-new sites.
	 *
	 * @var int
	 */
	protected const MIN_WEEKS_WITH_DATA = 2;

	/**
	 * Default soft-signal threshold: yesterday below this fraction of the
	 * baseline is treated as a suspect drop. Filterable.
	 *
	 * @var float
	 */
	private const DEFAULT_DROP_THRESHOLD = 0.10;

	/**
	 * Default minimum baseline (hits/day). A drop is not meaningful on very
	 * low-traffic sites, so baselines below this are ignored. Filterable.
	 *
	 * @var float
	 */
	private const DEFAULT_MIN_BASELINE = 10.0;

	/**
	 * Confidence added per extra consecutive 'down' incident day. One quiet day
	 * can be coincidence; several consecutive days of zero hits while a baseline
	 * exists is close to conclusive, so 'down' escalates faster than 'suspect'.
	 *
	 * @var float
	 */
	private const ESCALATION_STEP_DOWN = 0.15;

	/**
	 * Confidence added per extra consecutive 'suspect' incident day.
	 *
	 * @var float
	 */
	private const ESCALATION_STEP_SUSPECT = 0.10;

	/**
	 * Option key holding the last detection result and incident state.
	 *
	 * @var string
	 */
	private const OPTION = 'burst_tracking_health';

	/**
	 * Register hooks.
	 */
	public function init(): void {
		add_action( 'burst_daily', [ $this, 'run_daily_check' ] );
	}

	/**
	 * Daily cron handler: run the detector, track the incident for de-duplication
	 * and persist the result. Consecutive incident days escalate the confidence,
	 * since detect() judges each day on its own and would otherwise cap
	 * weak-baseline or dead-cron sites below the e-mail threshold forever.
	 * Fires `burst_tracking_health_checked` so a later notification layer can
	 * act on the outcome.
	 */
	public function run_daily_check(): void {
		$result = $this->detect();

		$previous    = get_option( self::OPTION, [] );
		$prev_status = $previous['status'] ?? 'ok';

		if ( 'ok' === $result['status'] ) {
			// Healthy again: close any open incident.
			$result['incident_since'] = '';
			$result['incident_days']  = 0;
		} elseif ( 'ok' === $prev_status || empty( $previous['incident_since'] ) ) {
			// Transition from healthy: a new incident starts today.
			$result['incident_since'] = $result['checked_date'];
			$result['incident_days']  = 1;
		} else {
			// Same ongoing incident: keep the original start date (de-dup) and
			// count consecutive incident days. A re-run on the same checked
			// date is not an extra day.
			$result['incident_since'] = $previous['incident_since'];
			$previous_days            = max( 1, (int) ( $previous['incident_days'] ?? 1 ) );
			$same_day                 = ( $previous['checked_date'] ?? '' ) === $result['checked_date'];
			$result['incident_days']  = $same_day ? $previous_days : $previous_days + 1;
		}

		$result = $this->escalate_confidence( $result );

		update_option( self::OPTION, $result, false );
		do_action( 'burst_tracking_health_checked', $result );
	}

	/**
	 * Escalate confidence for consecutive incident days.
	 *
	 * A streak of bad days is itself strong evidence: every extra consecutive
	 * incident day adds a fixed step, so any real outage crosses the e-mail
	 * threshold within a few days regardless of baseline strength or a dead cron.
	 *
	 * @param array $result Detection result including incident_days.
	 * @return array The result with escalated confidence.
	 */
	private function escalate_confidence( array $result ): array {
		$days = (int) ( $result['incident_days'] ?? 0 );
		if ( $days <= 1 || 'ok' === ( $result['status'] ?? 'ok' ) ) {
			return $result;
		}

		$step                 = 'down' === $result['status'] ? self::ESCALATION_STEP_DOWN : self::ESCALATION_STEP_SUSPECT;
		$result['confidence'] = round( min( 1.0, (float) $result['confidence'] + $step * ( $days - 1 ) ), 2 );

		return $result;
	}

	/**
	 * Run the detection for yesterday and return the status without persisting.
	 *
	 * @return array{
	 *     status: string,
	 *     confidence: float,
	 *     reason: string,
	 *     checked_date: string,
	 *     hits: int,
	 *     baseline: float,
	 *     ratio: float|null,
	 *     weeks_with_data: int,
	 *     cron_active: bool
	 * } Detection result. status is one of 'ok', 'suspect', 'down'.
	 */
	public function detect(): array {
		$yesterday       = ( new \DateTimeImmutable( 'now', wp_timezone() ) )->modify( '-1 day' );
		[ $start, $end ] = $this->day_bounds( $yesterday );

		$hits          = $this->get_metric_total( $start, $end );
		$baseline_data = $this->get_baseline( $yesterday );
		$baseline      = $baseline_data['average'];
		$weeks         = $baseline_data['weeks_with_data'];
		$cron_active   = Cron::is_cron_active();

		$threshold    = (float) apply_filters( 'burst_tracking_health_drop_threshold', self::DEFAULT_DROP_THRESHOLD );
		$min_baseline = (float) apply_filters( 'burst_tracking_health_min_baseline', self::DEFAULT_MIN_BASELINE );

		$result = [
			'status'          => 'ok',
			'confidence'      => 0.0,
			'reason'          => '',
			'checked_date'    => $yesterday->format( 'Y-m-d' ),
			'hits'            => $hits,
			'baseline'        => round( $baseline, 2 ),
			'ratio'           => null,
			'weeks_with_data' => $weeks,
			'cron_active'     => $cron_active,
		];

		// Guard: never alarm without a prior baseline (new sites).
		if ( $weeks < self::MIN_WEEKS_WITH_DATA ) {
			$result['reason'] = 'insufficient_baseline';
			return $result;
		}

		// Guard: a drop is not meaningful on very low-traffic sites.
		if ( $baseline < $min_baseline ) {
			$result['reason'] = 'baseline_below_minimum';
			return $result;
		}

		$ratio           = $baseline > 0 ? $hits / $baseline : 0.0;
		$result['ratio'] = round( $ratio, 4 );

		// Baseline strength scales confidence: 2..4 weeks of data → 0.5..1.0.
		$strength = $weeks / self::COMPARISON_WEEKS;

		if ( 0 === $hits ) {
			// Hard signal: no hits at all while a baseline exists.
			$result['status'] = 'down';
			$result['reason'] = 'zero_hits';
			$confidence       = 0.9 * $strength;
		} elseif ( $ratio < $threshold ) {
			// Soft signal: hits collapsed to a small fraction of the baseline.
			$result['status'] = 'suspect';
			$result['reason'] = 'below_threshold';
			$confidence       = 0.6 * $strength;
		} else {
			$result['reason'] = 'within_normal_range';
			return $result;
		}

		// A dead cron makes the whole environment unreliable: a zero/low reading
		// may be an artifact of broken WP-Cron rather than lost tracking, so we
		// are less confident the drop reflects a real tracking failure.
		if ( ! $cron_active ) {
			$confidence *= 0.5;
		}

		$result['confidence'] = round( min( 1.0, $confidence ), 2 );
		return $result;
	}

	/**
	 * Get the last stored detection result (including incident state).
	 *
	 * @return array Stored result, or an empty array if no check has run yet.
	 */
	public function get_status(): array {
		return get_option( self::OPTION, [] );
	}

	/**
	 * Whether any hits were recorded in the last 24 hours.
	 *
	 * Backs the dashboard tracking notice and the loopback re-test interval: a
	 * failed probe is only a real error when no hits have come in recently, so a
	 * probe that fails while tracking still records hits raises no false alarm and
	 * does not need to be retried aggressively.
	 *
	 * @return bool True when at least one hit was recorded in the last day.
	 */
	public function has_recent_hits(): bool {
		$now = time();
        error_log("has recent hits: ");
        $hits = $this->get_metric_total( $now - DAY_IN_SECONDS, $now ) > 0;
        error_log($hits);
		return $this->get_metric_total( $now - DAY_IN_SECONDS, $now ) > 0;
	}

	/**
	 * Average of the configured metric for the same weekday over the previous weeks.
	 *
	 * Only weeks that actually have data are counted, so missing history lowers
	 * weeks_with_data rather than dragging the average toward zero.
	 *
	 * @param \DateTimeImmutable $reference_day The day whose weekday is compared.
	 * @return array{average: float, weeks_with_data: int}
	 */
	protected function get_baseline( \DateTimeImmutable $reference_day ): array {
		$total           = 0;
		$weeks_with_data = 0;

		for ( $week = 1; $week <= self::COMPARISON_WEEKS; $week++ ) {
			$day             = $reference_day->modify( '-' . ( $week * 7 ) . ' days' );
			[ $start, $end ] = $this->day_bounds( $day );
			$count           = $this->get_metric_total( $start, $end );

			if ( $count > 0 ) {
				$total += $count;
				++$weeks_with_data;
			}
		}

		return [
			'average'         => $weeks_with_data > 0 ? $total / $weeks_with_data : 0.0,
			'weeks_with_data' => $weeks_with_data,
		];
	}

	/**
	 * The statistics metric this detector counts. Subclasses override this to
	 * count a different metric (e.g. anomaly detection counts 'visitors').
	 *
	 * @return string Metric key understood by Statistics_Query.
	 */
	protected function get_metric(): string {
		return 'pageviews';
	}

	/**
	 * Count the configured metric over a timestamp range.
	 *
	 * @param int $start Range start as a Unix timestamp.
	 * @param int $end   Range end as a Unix timestamp.
	 * @return int Metric total for the range.
	 */
	protected function get_metric_total( int $start, int $end ): int {
		$metric = $this->get_metric();
		$value  = Statistics_Query::create( 'baseline_' . $metric )
			->date_range( $start, $end )
			->select( [ $metric ] )
			->fetch_var();

		return (int) $value;
	}

	/**
	 * Resolve the start/end Unix timestamps for a full day in the site timezone.
	 *
	 * @param \DateTimeImmutable $day A day (timezone-aware) to bound.
	 * @return array{0: int, 1: int} Start and end timestamps.
	 */
	protected function day_bounds( \DateTimeImmutable $day ): array {
		return [
			$day->setTime( 0, 0, 0 )->getTimestamp(),
			$day->setTime( 23, 59, 59 )->getTimestamp(),
		];
	}
}
