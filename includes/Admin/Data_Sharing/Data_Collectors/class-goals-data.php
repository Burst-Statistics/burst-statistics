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

	/**
	 * Collect data from the goals
	 */
	public function collect_data(): array {
		$goals_obj = new Goals();
		$goals     = $goals_obj->get_goals();

		return [
			'goals' => array_map(
				function ( $goal ) {
					return [
						'goal_id'           => $goal->id,
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
