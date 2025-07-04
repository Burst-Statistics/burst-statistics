<?php
namespace Burst\Admin\Cron;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
class Cron {
	/**
	 * Constructor
	 */
	public function init(): void {
		add_action( 'plugins_loaded', [ $this, 'schedule_cron' ], 10, 2 );
		add_action( 'cron_schedules', [ $this, 'filter_cron_schedules' ], 10, 2 );
		add_action( 'burst_every_hour', [ $this, 'test_hourly_cron' ] );
	}

	/**
	 * Check if the hourly cron is working.
	 */
	public function test_hourly_cron(): void {
		// This is just a test function to check if the hourly cron is working.
		// You can remove this function once you have verified that the cron is working.
		update_option( 'burst_last_cron_hit', time(), false );
	}

	/**
	 * Schedule cron jobs
	 *
	 * Else start the functions.
	 */
	public function schedule_cron(): void {
		if ( ! wp_next_scheduled( 'burst_every_hour' ) ) {
			wp_schedule_event( time(), 'burst_every_hour', 'burst_every_hour' );
		}
		if ( ! wp_next_scheduled( 'burst_daily' ) ) {
			wp_schedule_event( time(), 'burst_daily', 'burst_daily' );
		}
		if ( ! wp_next_scheduled( 'burst_weekly' ) ) {
			wp_schedule_event( time(), 'burst_weekly', 'burst_weekly' );
		}
	}

	/**
	 * Check if the cron has run the last 24 hours
	 */
	public function cron_active(): bool {
		$now           = time();
		$last_cron_hit = get_option( 'burst_last_cron_hit', 0 );
		$diff          = $now - $last_cron_hit;

		$cron_active = $diff <= DAY_IN_SECONDS;
		if ( $cron_active ) {
			\Burst\burst_loader()->admin->tasks->dismiss_task( 'cron' );
		}
		return $cron_active;
	}

	/**
	 * Filter to add custom cron schedules.
	 *
	 * @param array<string, array{interval: int, display: string}> $schedules An array of existing cron schedules.
	 * @return array<string, array{interval: int, display: string}> Modified cron schedules.
	 */
	public function filter_cron_schedules( array $schedules ): array {
		$schedules['burst_daily']      = [
			'interval' => DAY_IN_SECONDS,
			'display'  => 'Once every day',
		];
		$schedules['burst_every_hour'] = [
			'interval' => HOUR_IN_SECONDS,
			'display'  => 'Once every hour',
		];
		$schedules['burst_weekly']     = [
			'interval' => WEEK_IN_SECONDS,
			'display'  => 'Once every week',
		];

		return $schedules;
	}
}
