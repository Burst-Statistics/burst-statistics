<?php
namespace Burst\Frontend\Goals;

use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die();

if ( ! class_exists( 'goals_tracker' ) ) {
	class Goals_Tracker {
		use Helper;

		/**
		 * Constructor
		 */
		public function init(): void {}

		/**
		 * Get the goal by hook name
		 */
		public function get_goal_by_hook_name( string $find_hook_name ): int {
			return 0;
		}

		/**
		 * Process the execution of a hook as goal achieved
		 */
		public function handle_hook( string $hook_name ): void {}
	}

}
