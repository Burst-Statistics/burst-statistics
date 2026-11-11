<?php
/**
 * Measures the site's traffic peak, to recommend high-traffic buffer mode.
 */
namespace Burst\Admin;

use Burst\Admin\DomainTypes\Admin_Option_Category;
use Burst\Admin\Statistics\Statistics_Data;
use Burst\Frontend\Tracking\High_Traffic_Buffer;

defined( 'ABSPATH' ) || exit;

/**
 * Class Traffic_Peak
 */
class Traffic_Peak {
	/**
	 * Pageviews in the busiest hour from which buffer mode is recommended.
	 *
	 * Statistics have no finer grain than an hour, and an hour averages out its
	 * busiest minutes, which run at about 1.5 to 2 times the hourly rate. 3000 per
	 * hour therefore means peaks of about 75 to 100 pageviews per minute. At 2 to 3
	 * tracking requests per pageview that is about 3 to 5 requests per second: a
	 * noticeable share of a single shared CPU core. These are estimates, not measurements.
	 */
	public const PAGEVIEWS_THRESHOLD = 3000;

	/**
	 * Admin option key holding the highest hourly pageviews seen.
	 */
	private const PEAK_OPTION_KEY = 'peak_hourly_pageviews';

	/**
	 * Initialize hooks.
	 */
	public function init(): void {
		add_action( 'burst_daily', [ $this, 'update_peak' ] );
	}

	/**
	 * Keep the highest hourly pageviews seen, and revalidate the tasks when the
	 * site crosses the threshold.
	 *
	 * The peak never goes down. A task whose condition turns false is dismissed for
	 * good (Tasks::dismiss_task()), so a peak that rolled out of the seven day window
	 * would end the recommendation before the user saw it, and it would never return.
	 */
	public function update_peak(): void {
		$peak          = $this->get_peak_from_statistics();
		$previous_peak = self::get_peak();
		if ( $peak <= $previous_peak ) {
			return;
		}

		Admin_Options::update( Admin_Option_Category::CORE, self::PEAK_OPTION_KEY, $peak );

		if ( $previous_peak < self::PAGEVIEWS_THRESHOLD && $peak >= self::PAGEVIEWS_THRESHOLD ) {
			\Burst\burst_loader()->admin->tasks->schedule_task_validation();
		}
	}

	/**
	 * Whether to recommend buffer mode: the site reached the threshold, the mode is
	 * off and it can be switched on here.
	 *
	 * @return bool True if the recommendation applies.
	 */
	public static function should_recommend_buffer_mode(): bool {
		return self::get_peak() >= self::PAGEVIEWS_THRESHOLD
			&& ! High_Traffic_Buffer::is_buffer_enabled()
			&& ! High_Traffic_Buffer::is_settings_disabled();
	}

	/**
	 * Get the stored peak.
	 *
	 * @return int Highest hourly pageviews seen.
	 */
	private static function get_peak(): int {
		return (int) Admin_Options::get( Admin_Option_Category::CORE, self::PEAK_OPTION_KEY, 0 );
	}

	/**
	 * Read the busiest hour of the last seven days from the statistics.
	 *
	 * @return int Pageviews in the busiest hour.
	 */
	private function get_peak_from_statistics(): int {
		$now  = time();
		$data = ( new Statistics_Data() )->get_insights_data(
			[
				'date_start' => $now - 7 * DAY_IN_SECONDS,
				'date_end'   => $now,
				'metrics'    => [ 'pageviews' ],
				'group_by'   => 'hour',
			]
		);

		$hours = array_map( 'intval', $data['datasets'][0]['data'] ?? [] );

		return [] === $hours ? 0 : max( $hours );
	}
}
