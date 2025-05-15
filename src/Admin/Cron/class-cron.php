<?php
namespace Burst\Admin\Cron;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
class Cron {
	/**
	 * Constructor
	 */
	public function __construct() {
		add_action( 'plugins_loaded', [ $this, 'schedule_cron' ], 10, 2 );
		add_action( 'cron_schedules', [ $this, 'filter_cron_schedules' ], 10, 2 );
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
