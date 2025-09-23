<?php
/**
 * Milestone class to handle all milestone related functionality.
 */
namespace Burst\Admin;

use Burst\Admin\Statistics\Query_Data;
use Burst\Traits\Helper;
use function Burst\burst_loader;

defined( 'ABSPATH' ) || exit;

/**
 * Class Milestones
 */
class Milestones {
	use Helper;

	/**
	 * Initialize hooks.
	 */
	public function init(): void {
		add_action( 'burst_dismiss_task', [ $this, 'pageviews_milestone_dismiss' ] );
	}

	/**
	 * Check if a new pageviews milestone has been reached.
	 *
	 * @return bool True if milestone reached, false otherwise.
	 */
	public static function pageviews_milestone_reached(): bool {
		// Get last milestone.
		$last_milestone = (int) get_option( 'burst_last_pageviews_milestone', 0 );

		// If no milestone yet, check activation date.
		if ( $last_milestone === 0 ) {
			$activated = (int) get_option( 'burst_activation_time', 0 );

			// Not active long enough → skip.
			if ( $activated === 0 || $activated > strtotime( '-1 month' ) ) {
				return false;
			}
		}

		// Current month pageviews.
		$current_month_start = strtotime( gmdate( 'Y-m-01 00:00:00' ) );
		$current_month_end   = strtotime( gmdate( 'Y-m-t 23:59:59' ) );

		$current_pv = self::get_pageviews( $current_month_start, $current_month_end );

		// If we have a milestone, check previous month for 80% rule.
		if ( $last_milestone > 0 ) {
			$previous_month_start = strtotime( gmdate( 'Y-m-01 00:00:00', strtotime( '-1 month' ) ) );
			$previous_month_end   = strtotime( gmdate( 'Y-m-t 23:59:59', strtotime( '-1 month' ) ) );
			$previous_pv          = self::get_pageviews( $previous_month_start, $previous_month_end );
			if ( $previous_pv > 0 && $current_pv < ( 0.8 * $previous_pv ) ) {
				return false;
			}
		}

		// Determine next milestone.
		$next_milestone = self::get_next_milestone( $current_pv );
		if ( $next_milestone >= $last_milestone ) {
			update_option( 'burst_current_pageviews_milestone', $next_milestone, false );
			return true;
		}

		return false;
	}

	/**
	 * Query DB for pageviews in given range.
	 *
	 * @param int $start Start timestamp.
	 * @param int $end   End timestamp.
	 * @return int Number of pageviews.
	 */
	private static function get_pageviews( int $start, int $end ): int {
		global $wpdb;

		$qd = new Query_Data(
			[
				'date_start' => $start,
				'date_end'   => $end,
				'select'     => [ 'pageviews' ],
			]
		);

		$sql    = burst_loader()->admin->statistics->get_sql_table( $qd );
		$result = $wpdb->get_row( $sql, 'ARRAY_A' );

		return $result ? (int) $result['pageviews'] : 0;
	}

	/**
	 * Get the next milestone number based on the last one.
	 *
	 * @param int $current_pageviews Current pageviews.
	 * @return int The next milestone.
	 */
	private static function get_next_milestone( int $current_pageviews ): int {
		// First, find the milestone that's closest below current_pv.
		if ( $current_pageviews < 1000 ) {
			// Find the highest 100-step milestone below current_pv.
			$milestone_below_current = floor( $current_pageviews / 100 ) * 100;
		} elseif ( $current_pageviews < 10000 ) {
			// Find the highest 1000-step milestone below current_pv.
			$milestone_below_current = floor( $current_pageviews / 1000 ) * 1000;
		} elseif ( $current_pageviews < 100000 ) {
			// Find the highest 10000-step milestone below current_pv.
			$milestone_below_current = floor( $current_pageviews / 10000 ) * 10000;
		} else {
			// Find the highest 100000-step milestone below current_pv.
			$milestone_below_current = floor( $current_pageviews / 100000 ) * 100000;
		}
		$milestone_below_current = (int) round( $milestone_below_current, 0 );
		// Now calculate the next milestone from that point.
		if ( $milestone_below_current < 1000 ) {
			return $milestone_below_current + 100;
		}

		if ( $milestone_below_current < 10000 ) {
			return $milestone_below_current + 1000;
		}

		if ( $milestone_below_current < 100000 ) {
			return $milestone_below_current + 10000;
		}

		return $milestone_below_current + 100000;
	}

	/**
	 * Handle dismissal of pageviews milestone task.
	 *
	 * @param string $task_id The ID of the dismissed task.
	 * @return void Returns void.
	 */
	public function pageviews_milestone_dismiss( string $task_id ): void {
		if ( $task_id !== 'pageviews_milestone' ) {
			return;
		}

		$current_pageviews_milestone = (int) get_option( 'burst_current_pageviews_milestone', 0 );
		delete_option( 'burst_current_pageviews_milestone' );
		update_option( 'burst_last_pageviews_milestone', $current_pageviews_milestone, false );
	}

	/**
	 * Format milestone number for display. Alias for format_number_short from Helper trait.
	 *
	 * @param int $number The milestone number.
	 * @return string Formatted milestone.
	 */
	public function format_milestone( int $number ): string {
		return $this->format_number_short( $number );
	}
}
