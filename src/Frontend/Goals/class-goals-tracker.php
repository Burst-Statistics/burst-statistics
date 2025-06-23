<?php
namespace Burst\Frontend\Goals;

use Burst\Frontend\Tracking\Tracking;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die();

if ( ! class_exists( 'goals_tracker' ) ) {
	class Goals_Tracker {
		use Helper;

		/**
		 * Constructor
		 */
		public function __construct() {
			add_action( 'init', [ $this, 'add_dynamic_hooks' ] );
		}

		/**
		 * Add dynamic hooks for goals, to track hooks triggers in other plugins
		 */
		public function add_dynamic_hooks(): void {
			$goals = \Burst\burst_loader()->frontend->tracking->get_active_goals( true );
			foreach ( $goals as $goal ) {
				$goal = new Goal( $goal['ID'] );
				if ( $goal->type !== 'hook' ) {
					continue;
				}
				$hook = $goal->hook;
				if ( $hook ) {
					add_action(
						$hook,
						function () use ( $hook ): void {
							$this->handle_hook( $hook );
						}
					);
				}
			}
		}

		/**
		 * Get the goal by hook name
		 */
		public function get_goal_by_hook_name( string $find_hook_name ): int {
			$goals = \Burst\burst_loader()->frontend->tracking->get_active_goals( true );

			foreach ( $goals as $goal ) {
				$goal = new Goal( $goal['ID'] );
				if ( $goal->type !== 'hook' ) {
					continue;
				}

				$hook = $goal->hook;
				if ( $hook === $find_hook_name ) {
					return $goal->id;
				}
			}

			return 0;
		}

		/**
		 * Process the execution of a hook as goal achieved
		 */
		public function handle_hook( string $hook_name ): void {

			// get cookie burst_uid.
			$burst_uid = isset( $_COOKIE['burst_uid'] ) ? \Burst\burst_loader()->frontend->tracking->sanitize_uid( $_COOKIE['burst_uid'] ) : false;
			// we assume there has at least been one interaction clientside, so there should be a uid.
			if ( $burst_uid ) {
				$statistic    = \Burst\burst_loader()->frontend->tracking->get_last_user_statistic( $burst_uid, '' );
				$statistic_id = $statistic['ID'] ?? false;
				if ( ! $statistic_id ) {
					return;
				}
				$page_url   = $statistic['page_url'] ?? '';
				$parameters = $statistic['parameters'] ?? '';
				$page_url  .= $parameters;
				// get the goal by $hook_name.
				$goal_id = $this->get_goal_by_hook_name( $hook_name );
				if ( $goal_id === 0 ) {
					return;
				}
				$goal = new Goal( $goal_id );
				// if the goal should be tracked on a specific page only, check if the current page is the page to track.
				if ( $goal->page_or_website === 'page' ) {
					// this is a relative url.
					$tracking_page = $goal->specific_page;
					if ( ! empty( $page_url ) && strpos( $page_url, $tracking_page ) === false ) {
						return;
					}
				}

				$goal_arr = [
					'goal_id'      => $goal->id,
					'statistic_id' => $statistic_id,
				];

				\Burst\burst_loader()->frontend->tracking->create_goal_statistic( $goal_arr );
			} else {
				self::error_log( 'No burst_uid found in handle_hook' );
			}
		}
	}

}
