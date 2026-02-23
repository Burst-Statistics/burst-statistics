<?php

namespace Burst\Admin\Data_Sharing\Data_Collectors;

use Burst\Frontend\Goals\Goals;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Goals Data
 */
class Goals_Data extends Data_Collector {
	private int $capture_data_from;

	private int $capture_data_to;

	/**
	 * Constructor
	 */
	public function __construct( int $capture_data_from, int $capture_data_to ) {
		$this->capture_data_from = $capture_data_from;
		$this->capture_data_to   = $capture_data_to;
	}

	/**
	 * Collect data from the goals
	 */
	public function collect_data(): array {
		$goals_obj = new Goals();
		$goals     = $goals_obj->get_goals(
			[
				'date_start' => $this->capture_data_from,
				'date_end'   => $this->capture_data_to,
			]
		);

		$total_goals_last_month = count( $goals );

		return [
			'total_goals_last_month' => $total_goals_last_month,
			'goals'                  => array_map(
				function ( $goal ) {
					return [
						'status'            => $goal->status,
						'type'              => $goal->type,
						'conversion_metric' => $goal->conversion_metric,
						'hook_name'         => $goal->hook,
					];
				},
				$goals
			),
		];
	}
}
