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
		add_action( 'init', [ $this, 'schedule_cron' ], 10, 2 );
		add_action( 'admin_init', [ $this, 'maybe_handle_cron_task' ], 10, 2 );
		add_action( 'cron_schedules', [ $this, 'filter_cron_schedules' ], 10, 2 );
		add_action( 'burst_every_hour', [ $this, 'test_hourly_cron' ] );
	}

	/**
	 * Check if the hourly cron is working.
	 */
	public function test_hourly_cron(): void {
		update_option( 'burst_last_cron_hit', time(), false );
	}

	/**
	 * Schedule cron jobs
	 *
	 * Else start the functions.
	 */
	public function schedule_cron(): void {
		if ( ! wp_next_scheduled( 'burst_every_ten_minutes' ) ) {
			wp_schedule_event( time(), 'burst_every_ten_minutes', 'burst_every_ten_minutes' );
		}

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
	public function is_cron_active(): bool {
		$now           = time();
		$last_cron_hit = get_option( 'burst_last_cron_hit', 0 );
		$diff          = $now - $last_cron_hit;
		return $diff <= DAY_IN_SECONDS;
	}

	/**
	 * Check if the cron has run the last 24 hours
	 */
	public function maybe_handle_cron_task(): void {
		$cron_active     = $this->is_cron_active();
		$cron_task_added = \Burst\burst_loader()->admin->tasks->has_task( 'cron' );
		if ( $cron_active && $cron_task_added ) {
			\Burst\burst_loader()->admin->tasks->dismiss_task( 'cron' );
		}

		if ( ! $cron_active && ! $cron_task_added ) {
			\Burst\burst_loader()->admin->tasks->add_task( 'cron' );
		}
	}

	/**
	 * Filter to add custom cron schedules.
	 *
	 * @param array<string, array{interval: int, display: string}> $schedules An array of existing cron schedules.
	 * @return array<string, array{interval: int, display: string}> Modified cron schedules.
	 */
	public function filter_cron_schedules( array $schedules ): array {
		$schedules['burst_daily']             = [
			'interval' => DAY_IN_SECONDS,
			'display'  => 'Once every day',
		];
		$schedules['burst_every_ten_minutes'] = [
			'interval' => 10 * MINUTE_IN_SECONDS,
			'display'  => 'Once every 10 minutes',
		];
		$schedules['burst_every_hour']        = [
			'interval' => HOUR_IN_SECONDS,
			'display'  => 'Once every hour',
		];
		$schedules['burst_weekly']            = [
			'interval' => WEEK_IN_SECONDS,
			'display'  => 'Once every week',
		];

		return $schedules;
	}
}
