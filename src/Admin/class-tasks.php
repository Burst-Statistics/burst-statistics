<?php
namespace Burst\Admin;

// don't remove, it is used in the Tasks code.
use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die();
class Tasks {
	use Helper;
	use Admin_Helper;

	public array $tasks = [];

	/**
	 * Get all structured app data.
	 *
	 * @return array{
	 *     tasks: array<int, array{
	 *         id: string,
	 *         icon: string,
	 *         condition: array<string, mixed>|callable[],
	 *         status: string,
	 *         label: string
	 *     }>
	 * }
	 */
	public function get(): array {
		return [
			'tasks' => $this->get_tasks(),
		];
	}

	/**
	 * Add initial tasks that are marked with ['condition']['type'] === activation by inserting an option
	 */
	public function add_initial_tasks(): void {
		$tasks = $this->get_raw_tasks();
		foreach ( $tasks as $task ) {
			if ( isset( $task['condition']['type'] ) && $task['condition']['type'] === 'activation' ) {
				$this->add_task( $task['id'] );
			}
		}
	}

	/**
	 * Tasks should never get validated directly, always use this schedule function
	 */
	public function schedule_task_validation(): void {
		if ( ! wp_next_scheduled( 'burst_validate_tasks' ) ) {
			wp_schedule_single_event( time() + 30, 'burst_validate_tasks' );
		}
	}
	/**
	 * Insert a task
	 */
	public function add_task( string $task_id ): void {
		$current_tasks = get_option( 'burst_tasks', [] );
		if ( ! in_array( $task_id, $current_tasks, true ) ) {
			$current_tasks[] = sanitize_title( $task_id );
			update_option( 'burst_tasks', $current_tasks, false );
		}
	}

	/**
	 * Dismiss a task
	 */
	public function dismiss_task( string $task_id ): void {
		$current_tasks = get_option( 'burst_tasks', [] );
		if ( in_array( sanitize_title( $task_id ), $current_tasks, true ) ) {
			do_action( 'burst_dismiss_task', $task_id );
			$current_tasks = array_diff( $current_tasks, [ $task_id ] );
			update_option( 'burst_tasks', $current_tasks, false );
		}
		delete_transient( 'burst_plusone_count' );
	}

	/**
	 * Check if a task is active
	 */
	private function has_task( string $task_id ): bool {
		$current_tasks = get_option( 'burst_tasks', [] );
		return in_array( sanitize_title( $task_id ), $current_tasks, true );
	}

	/**
	 * Validate tasks
	 * Don't call directly. Use the schedule_task_validation function
	 */
	public function validate_tasks(): void {
		$tasks = $this->get_raw_tasks();
		foreach ( $tasks as $task ) {
			if ( isset( $task['condition']['type'] ) && $task['condition']['type'] === 'serverside' ) {
				$invert   = str_contains( $task['condition']['function'], '!' );
				$function = $invert ? substr( $task['condition']['function'], 1 ) : $task['condition']['function'];
				$is_valid = $this->validate_function( $function );
				if ( $invert ) {
					$is_valid = ! $is_valid;
				}
				if ( $is_valid ) {
					$this->add_task( $task['id'] );
				} else {
					$this->dismiss_task( $task['id'] );
				}
			}
		}
		delete_transient( 'burst_plusone_count' );
	}

	/**
	 * Get raw tasks directly from the config file and apply transformations.
	 *
	 * @return array<int, array{
	 *     id: string,
	 *     url?: string,
	 *     icon?: string,
	 *     condition?: mixed
	 * }>
	 */
	public function get_raw_tasks(): array {
		if ( empty( $this->tasks ) ) {
			$tasks       = require BURST_PATH . 'src/Admin/App/config/tasks.php';
			$this->tasks = apply_filters( 'burst_tasks', $tasks );
		}

		// convert URL to website URL.
		foreach ( $this->tasks as $key => $task ) {
			if ( isset( $task['url'] ) ) {
				// if url starts with #, we want to link internally. So we can just return the url.
				if ( strpos( $task['url'], '#' ) === 0 ) {
					continue;
				}
				$this->tasks[ $key ]['url'] = $this->get_website_url(
					$task['url'],
					[
						'utm_source'  => 'tasks',
						'utm_content' => $task['id'],
					]
				);
			}
		}

		return $this->tasks;
	}

	/**
	 * Get array of tasks with metadata, filtered and sorted.
	 *
	 * Each task contains:
	 * - 'id': string
	 * - 'icon': string ('open', 'success', 'error', 'warning', etc.)
	 * - 'condition': callable[]|array<string, mixed>
	 * - 'status': string ('open' or 'completed')
	 * - 'label': string
	 *
	 * @return array<int, array{
	 *     id: string,
	 *     icon: string,
	 *     condition: array<string, mixed>|callable[],
	 *     status: string,
	 *     label: string
	 * }>
	 */
	public function get_tasks(): array {
		$tasks = $this->get_raw_tasks();
		foreach ( $tasks as $index => $task ) {
			$tasks[ $index ] = wp_parse_args(
				$task,
				[
					'condition' => [],
					'icon'      => 'open',
				]
			);
		}
		// Filter out tasks that do not apply, or are dismissed.
		$dismiss_non_error_tasks = $this->get_option_bool( 'dismiss_non_error_notices' );

		foreach ( $tasks as $index => $task ) {
			// set task status based on current icon.
			$tasks[ $index ]['status'] = $task['icon'] !== 'success' ? 'open' : 'completed';

			// get the translated label.
			$tasks[ $index ]['label'] = $this->get_label( $task['icon'] );

			if ( isset( $task['condition']['type'] ) && $task['condition']['type'] === 'clientside' ) {
				continue;
			}

			// remove this option if it's dismissed.
			if ( ! $this->has_task( $task['id'] ) ) {
				unset( $tasks[ $index ] );
			}

			// dismiss all non error tasks if this option is enabled.
			if ( $dismiss_non_error_tasks && $task['icon'] !== 'error' ) {
				unset( $tasks[ $index ] );
			}
		}

		$tasks = $this->filter_unique_ids( $tasks );

		// sort so warnings are on top.
		$warnings = [];
		$open     = [];
		$other    = [];
		foreach ( $tasks as $index => $task ) {
			if ( $task['icon'] === 'warning' ) {
				$warnings[ $index ] = $task;
			} elseif ( $task['icon'] === 'open' ) {
				$open[ $index ] = $task;
			} else {
				$other[ $index ] = $task;
			}
		}
		return $warnings + $open + $other;
	}

	/**
	 * Get translated label
	 */
	private function get_label( string $icon ): string {
		$icon_labels = [
			'completed' => __( 'Completed', 'burst-statistics' ),
			'new'       => __( 'New!', 'burst-statistics' ),
			'warning'   => __( 'Warning', 'burst-statistics' ),
			'error'     => __( 'Error', 'burst-statistics' ),
			'open'      => __( 'Open', 'burst-statistics' ),
			'pro'       => __( 'Pro', 'burst-statistics' ),
			'sale'      => __( 'Sale', 'burst-statistics' ),
			'offer'     => __( 'Offer', 'burst-statistics' ),
			'milestone' => __( 'Milestone', 'burst-statistics' ),
			'insight'   => __( 'Update', 'burst-statistics' ),
		];
		return $icon_labels[ $icon ];
	}

	/**
	 * Remove duplicate IDs from the tasks array, keeping the last occurrence.
	 *
	 * @return array<int, array{id: string, icon: string, condition: mixed, status: string, label: string}>
	 */
	private function filter_unique_ids( array $tasks ): array {
		$unique_tasks = [];
		foreach ( $tasks as $task ) {
			// Check if the id already exists in the unique array.
			if ( ! in_array( $task['id'], array_column( $unique_tasks, 'id' ), true ) ) {
				// If the id is not in the unique array, add the current task.
				$unique_tasks[] = $task;
			} else {
				// if it is already in the array, replace the previous one.
				$index                  = array_search( $task['id'], array_column( $unique_tasks, 'id' ), true );
				$unique_tasks[ $index ] = $task;
			}
		}
		return $unique_tasks;
	}

	/**
	 * Get a task by ID.
	 */
	public function get_task_by_id( string $task_id ): ?array {
		$tasks = $this->get_raw_tasks();
		foreach ( $tasks as $task ) {
			if ( $task['id'] === $task_id ) {
				return $task;
			}
		}
		return null;
	}



	/**
	 * Count the plusones
	 *
	 * @since 3.2
	 */
	public function plusone_count(): int {
		if ( ! $this->user_can_manage() ) {
			return 0;
		}

		$cache = ! $this->is_burst_page();
		$count = get_transient( 'burst_plusone_count' );
		if ( ! $cache || ( $count === false ) ) {
			$count   = 0;
			$notices = $this->get_tasks();
			foreach ( $notices as $id => $notice ) {
				$success = isset( $notice['icon'] ) && $notice['icon'] === 'success';
				if ( ! $success
					&& isset( $notice['plusone'] )
					&& $notice['plusone']
				) {
					++$count;
				}
			}

			if ( $count === 0 ) {
				$count = 'empty';
			}
			set_transient( 'burst_plusone_count', $count, DAY_IN_SECONDS );
		}

		if ( $count === 'empty' ) {
			return 0;
		}
		return $count;
	}

	/**
	 * Get output of function, in format 'function', or 'class()->sub()->function'
	 */
	private function validate_function( string $func ): bool {

		$invert = false;
		if ( str_contains( $func, '! ' ) ) {
			$func   = str_replace( '!', '', $func );
			$invert = true;
		}

		if ( str_contains( $func, 'wp_option_' ) ) {
			$output = get_option( str_replace( 'wp_option_', '', $func ) ) !== false;
		} else {
			if ( preg_match( '/(.*)\(\)\-\>(.*)->(.*)/i', $func, $matches ) ) {
				$base     = $matches[1];
				$class    = $matches[2];
				$function = $matches[3];
				$output   = call_user_func( [ $base()->{$class}, $function ] );
			} elseif ( preg_match( '/^\s*([\w\\\\]+)::(\w+)\s*\(\s*\)\s*$/', $func, $matches ) ) {
				$class    = $matches[1];
				$function = $matches[2];
				if ( $class === 'Tasks' ) {
					// @phpstan-ignore-next-line
					$output = self::$function();
				} else {
					// @phpstan-ignore-next-line
					$output = $class::$function();
				}
			} elseif ( preg_match( '/\s*\(\s*new\s+(.*)\s*\(\s*\)\s*\)\s*->\s*(.*)\s*\(\s*\)/', $func, $matches ) ) {
				$class    = $matches[1];
				$function = $matches[2];
				if ( $class === 'Tasks' ) {
					$output = call_user_func( [ $this, $function ] );
				} else {
					$class_obj = new $class();
					$output    = call_user_func( [ $class_obj, $function ] );
				}
			} else {
				$output = $func();
			}

			if ( $invert ) {
				$output = ! $output;
			}

			if ( $invert ) {
				$output = ! $output;
			}
		}

		return (bool) $output;
	}
}
