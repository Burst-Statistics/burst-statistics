<?php
defined( 'ABSPATH' ) or die();
if ( ! class_exists( "burst_tasks" ) ) {
	class burst_tasks {
		private static $_this;

		public $tasks;

		function __construct( $args = array() ) {
			if ( isset( self::$_this ) ) {
				wp_die( burst_sprintf( '%s is a singleton class and you cannot create a second instance.',
					get_class( $this ) ) );
			}

		}
		static function this() {
			return self::$_this;
		}

		public function get(): array
        {
            return [
				'tasks' => $this->get_tasks(),
			];
		}

        /**
         * Add initial tasks that are marked with ['condition']['type'] === activation by inserting an option
         *
         * @return void
         */
        public function add_initial_tasks(): void {
            $tasks = $this->get_raw_tasks();
            foreach ( $tasks as $task ) {
                if ( isset($task['condition']['type']) && $task['condition']['type'] === 'activation' ) {
                    $this->add_task( $task['id'] );
                }
            }
        }

        /**
         * Tasks should never get validated directly, always use this schedule function
         *
         * @return void
         */
        public function schedule_task_validation(): void
        {
            if ( ! wp_next_scheduled( 'burst_validate_tasks' ) ) {
                wp_schedule_single_event(time() + 30, 'burst_validate_tasks');
            }
        }
        /**
         * Insert a task
         *
         * @param string $task_id
         */
        private function add_task(string $task_id ): void {
            $current_tasks = get_option( 'burst_tasks', array() );
            if ( !in_array( $task_id, $current_tasks ) ) {
                $current_tasks[] = sanitize_title( $task_id );
                update_option( 'burst_tasks', $current_tasks, false );
            }
        }

        /**
         * Dismiss a task
         *
         * @param string $task_id
         *
         * @return void
         */
        public function dismiss_task( string $task_id ): void {
            $current_tasks = get_option( 'burst_tasks', array() );
            if ( in_array( sanitize_title($task_id) , $current_tasks ) ) {
                $current_tasks = array_diff( $current_tasks, array( $task_id ) );
                update_option( 'burst_tasks', $current_tasks, false );
            }
            delete_transient( 'burst_plusone_count' );
        }

        /**
         * Check if a task is active
         *
         * @param string $task_id
         * @return bool
         */
        private function has_task( string $task_id ): bool {
            $current_tasks = get_option( 'burst_tasks', array() );
            return in_array( sanitize_title($task_id), $current_tasks );
        }


        /**
         * Validate tasks
         * Don't call directly. Use the schedule_task_validation function
         *
         * @return void
         */
        public function validate_tasks(): void {
            $tasks = $this->get_raw_tasks();
            foreach ( $tasks as $task ) {
                if ( isset($task['condition']['type']) && $task['condition']['type'] === 'serverside' ) {
                    $invert = str_contains( $task['condition']['function'], '!' );
                    $function = $invert ? substr( $task['condition']['function'], 1 ) : $task['condition']['function'];
                    $is_valid = $this->validate_function( $function );
                    if ( $invert ) {
                        $is_valid = !$is_valid;
                    }
                    if ( $is_valid ) {
                        $this->add_task($task['id']);
                    } else {
                        $this->dismiss_task($task['id']);
                    }
                }
            }
            delete_transient('burst_plusone_count');
        }

        /**
         * Get raw tasks directly from the config
         *
         * @return array
         */
        public function get_raw_tasks(): array {
            if ( empty($this->tasks) ) {
                $this->tasks = require_once(burst_path . 'includes/Config/Tasks.php');
            }

            return apply_filters('burst_tasks', $this->tasks );
        }

		/**
		 * Get array of tasks
		 * - condition: function returning boolean, if task should be shown or not
		 * @return array
		 */

		public function get_tasks(): array
        {
            $tasks = $this->get_raw_tasks();
			foreach ($tasks as $index => $task) {
                $tasks[$index] = wp_parse_args($task, array(
                    'condition' => array(),
                    'icon' => 'open',
                ));
			}
//            return [];
			/**
			 * Filter out tasks that do not apply, or are dismissed
			 */
            $dismiss_non_error_tasks = burst_get_option( 'dismiss_non_error_notices' );

			foreach ( $tasks as $index => $task ) {
                //set task status based on current icon
                $tasks[$index]['status'] = $task['icon'] !== 'success' ? 'open' : 'completed';

                //get the translated label
                $tasks[$index]['label'] = $this->get_label( $task['icon'] );

				// remove this option if it's dismissed
                if ( !$this->has_task( $task['id'] ) ) {
					unset($tasks[$index]);
				}

                //dismiss all non error tasks if this option is enabled.
                if ( $dismiss_non_error_tasks && $task['icon']!=='error' ) {
                    unset($tasks[$index]);
                }
			}

            $tasks = $this->filter_unique_ids($tasks);

			//sort so warnings are on top
			$warnings = array();
			$open = array();
			$other = array();
			foreach ($tasks as $index => $task){
				if ($task['icon']==='warning') {
					$warnings[$index] = $task;
				} else if ($task['icon']==='open') {
					$open[$index] = $task;
				} else {
					$other[$index] = $task;
				}
			}
            return $warnings + $open + $other;
		}

        /**
         * Get translated label
         *
         * @param string $icon
         * @return string
         */
        private function get_label(string $icon): string
        {
            $icon_labels = [
                'completed' => __( "Completed", "burst-statistics" ),
                'new'     => __( "New!", "burst-statistics" ),
                'warning' => __( "Warning", "burst-statistics" ),
                'error' => __( "Error", "burst-statistics" ),
                'open'    => __( "Open", "burst-statistics" ),
                'pro' => __( "Pro", "burst-statistics" ),
                'sale' => __( "Sale", "burst-statistics" ),
            ];
            return $icon_labels[$icon];
        }

        /**
         * Remove duplicate ids from the tasks array
         *
         * @param $tasks
         * @return array
         */
        private function filter_unique_ids( $tasks ): array
        {
            $unique_tasks = [];
            foreach ($tasks as $task) {
                // Check if the id already exists in the unique array
                if (!in_array($task['id'], array_column($unique_tasks, 'id'))) {
                    // If the id is not in the unique array, add the current task
                    $unique_tasks[] = $task;
                } else {
                    //if it is already in the array, replace the previous one
                    $index = array_search($task['id'], array_column($unique_tasks, 'id'));
                    $unique_tasks[$index] = $task;
                }
            }
            return $unique_tasks;
        }



		/**
		 * Count the plusones
		 *
		 * @return int
		 *
		 * @since 3.2
		 */

		public function plusone_count(): int
        {
			if ( ! burst_user_can_manage() ) {
				return 0;
			}

			$cache = !$this->is_burst_page();
			$count = get_transient( 'burst_plusone_count' );
			if ( !$cache || ($count === false) ) {
				$count = 0;
				$notices = $this->get_tasks();
				foreach ( $notices as $id => $notice ) {
					$success = isset( $notice['icon']) && $notice['icon'] === 'success';
					if ( ! $success
					     && isset( $notice['plusone'] )
					     && $notice['plusone']
					) {
						$count++;
					}
				}

				if ( $count==0 ) {
					$count = 'empty';
				}
				set_transient( 'burst_plusone_count', $count, DAY_IN_SECONDS );
			}
            
			if ( $count==='empty' ) {
				return 0;
			}
			return $count;
		}

        /**
         * Check if we're on the Burst page
         *
         * @return bool
         */
		public function is_burst_page(): bool
        {
			if ( burst_is_logged_in_rest() ) {
				return true;
			}

			if ( !isset($_SERVER['QUERY_STRING']) ) {
				return false;
			}

			parse_str($_SERVER['QUERY_STRING'], $params);
			if ( array_key_exists("page", $params) && ($params["page"] == "burst") ) {
				return true;
			}

			return false;
		}

		/**
		 * Get output of function, in format 'function', or 'class()->sub()->function'
		 * @param string $func
		 * @return bool
		 */

		private function validate_function(string $func ): bool
        {
            $invert = false;
			if ( str_contains($func, 'NOT ') ) {
				$func = str_replace('NOT ', '', $func);
				$invert = true;
			}

			if ( str_contains($func, 'wp_option_') ) {
                $output = get_option(str_replace('wp_option_', '', $func) )!==false;
			} else {
				if ( preg_match( '/(.*)\(\)\-\>(.*)->(.*)/i', $func, $matches)) {
                    $base = $matches[1];
					$class = $matches[2];
					$function = $matches[3];
					$output = call_user_func( array( $base()->{$class}, $function ) );
				} else {
					$output = $func();
				}

				if ( $invert ) {
					$output = !$output;
				}
			}

			return (bool) $output;
		}
	}
}
