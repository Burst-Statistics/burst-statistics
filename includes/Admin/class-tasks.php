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
	 * Default drip interval: 3 days in seconds (3 * 86400).
	 *
	 * @var int
	 */
	public const DEFAULT_DRIP_INTERVAL = 259200;

	/**
	 * Icons that are shown even when "Dismiss all notices except critical
	 * ones" is enabled. 'important' marks notices the user must see but that
	 * are not an error, such as a running database upgrade.
	 *
	 * @var string[]
	 */
	public const CRITICAL_ICONS = [ 'error', 'important' ];

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

		$this->maybe_advance_drip_task();
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
		$current_tasks         = get_option( 'burst_tasks', [] );
		$permanently_dismissed = $this->is_dismissed_permanently( $task_id );
		if ( $permanently_dismissed ) {
			return;
		}

		if ( ! in_array( $task_id, $current_tasks, true ) ) {
			$current_tasks[] = sanitize_title( $task_id );
			update_option( 'burst_tasks', $current_tasks, false );
			delete_transient( 'burst_plusone_count' );
			$this->maybe_advance_drip_task();
		}
	}

	/**
	 * Check if this task is permanently dismissed.
	 */
	private function is_dismissed_permanently( string $task_id ): bool {
		$task = $this->get_task_by_id( $task_id );
		if ( isset( $task['dismiss_permanently'] ) && $task['dismiss_permanently'] ) {
			$permanently_dismissed = get_option( 'burst_tasks_permanently_dismissed', [] );
			if ( in_array( $task_id, $permanently_dismissed, true ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Remove a task from the permanently dismissed list.
	 */
	public function undismiss_task( string $task_id ): bool {
		$permanently_dismissed = get_option( 'burst_tasks_permanently_dismissed', [] );
		$key                   = array_search( $task_id, $permanently_dismissed, true );
		$un_dismissed          = false;
		if ( $key !== false ) {
			unset( $permanently_dismissed[ $key ] );
			$permanently_dismissed = array_values( $permanently_dismissed );
			update_option( 'burst_tasks_permanently_dismissed', $permanently_dismissed, false );
			$un_dismissed = true;
		}

		return $un_dismissed;
	}

	/**
	 * Dismiss a task.
	 *
	 * @param string $task_id Task ID.
	 * @param bool   $user_action Whether this dismissal was triggered by a user action.
	 */
	public function dismiss_task( string $task_id, bool $user_action = true ): void {
		$current_tasks = get_option( 'burst_tasks', [] );
		if ( in_array( sanitize_title( $task_id ), $current_tasks, true ) ) {
			do_action( 'burst_dismiss_task', $task_id );
			$current_tasks = array_diff( $current_tasks, [ $task_id ] );
			update_option( 'burst_tasks', $current_tasks, false );

			// only dismiss permanently if the task exists in the tasks array.
			$this->maybe_dismiss_permanently( $task_id );
		}

		$active_drip_task = (string) get_option( 'burst_active_drip_task', '' );
		if ( $user_action && $task_id === $active_drip_task ) {
			update_option( 'burst_drip_last_dismissed_time', time(), false );
			delete_option( 'burst_active_drip_task' );
		} elseif ( $task_id === $active_drip_task ) {
			delete_option( 'burst_active_drip_task' );
			$this->maybe_advance_drip_task();
		}

		delete_transient( 'burst_plusone_count' );
	}

	/**
	 * Dismiss a task for good, whether or not it is active right now. For
	 * tasks that are added by the cron validation later (a serverside
	 * condition), dismiss_task() at upgrade time is a no-op: the task is not
	 * in the active list yet, so nothing gets written and the next validation
	 * adds it anyway. Only tasks flagged dismiss_permanently can be dismissed
	 * this way; add_task() refuses them from then on.
	 */
	public function dismiss_task_permanently( string $task_id ): void {
		$this->dismiss_task( $task_id );
		$this->maybe_dismiss_permanently( $task_id );
	}

	/**
	 * Store task as dismissed permanently
	 */
	private function maybe_dismiss_permanently( string $task_id ): void {
		$task = $this->get_task_by_id( $task_id );
		if ( isset( $task['dismiss_permanently'] ) && $task['dismiss_permanently'] ) {
			$permanently_dismissed = get_option( 'burst_tasks_permanently_dismissed', [] );
			if ( ! in_array( $task_id, $permanently_dismissed, true ) ) {
				$permanently_dismissed[] = $task_id;
			}
			update_option( 'burst_tasks_permanently_dismissed', $permanently_dismissed, false );
		}
	}

	/**
	 * Check if a task is active
	 */
	public function has_task( string $task_id ): bool {
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
				if ( isset( $task['condition']['constant'] ) ) {
					$invert   = str_contains( $task['condition']['constant'], '!' );
					$constant = $invert ? substr( $task['condition']['constant'], 1 ) : $task['condition']['constant'];
					$is_valid = defined( $constant );
					if ( $invert ) {
						$is_valid = ! $is_valid;
					}
				} else {
					// one function or an array of functions; all must pass.
					$functions = (array) $task['condition']['function'];
					$is_valid  = true;
					foreach ( $functions as $function ) {
						$invert   = str_contains( $function, '!' );
						$function = $invert ? substr( $function, 1 ) : $function;
						$valid    = $this->validate_function( $function );
						if ( $invert ) {
							$valid = ! $valid;
						}
						if ( ! $valid ) {
							$is_valid = false;
							break;
						}
					}
				}

				if ( $is_valid ) {
					$this->add_task( $task['id'] );
				} else {
					$this->dismiss_task( $task['id'], false );
				}
			}
		}
		$this->maybe_advance_drip_task();
		delete_transient( 'burst_plusone_count' );
	}

	/**
	 * Get raw tasks directly from the config file and apply transformations.
	 *
	 * @return array<int, array{
	 *     id: string,
	 *     mainwp: bool,
	 *     url?: string,
	 *     icon?: string,
	 *     condition?: mixed,
	 *     drip_order?: int
	 * }>
	 */
	public function get_raw_tasks(): array {
		if ( empty( $this->tasks ) ) {
			$tasks       = require BURST_PATH . 'includes/Admin/App/config/tasks.php';
			$this->tasks = $this->require_mainwp_flag( apply_filters( 'burst_tasks', $tasks ) );
		}

		// convert URL to website URL.
		foreach ( $this->tasks as $key => $task ) {
			if ( isset( $task['url'] ) ) {
				// if url starts with #, we want to link internally. So we can just return the url.
				if ( str_starts_with( $task['url'], '#' ) ) {
					continue;
				}
				// if url starts with https://, it's not a link to burst-statistics, but to an external website.
				if ( strpos( $task['url'], 'https://' ) === 0 ) {
					continue;
				}
				// internal wp-admin links (e.g. the tour launcher) must be left untouched.
				if ( strpos( $task['url'], admin_url() ) === 0 ) {
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
	 * Every task must state whether it is relevant inside the MainWP dashboard
	 * (`mainwp` => true|false): the MainWP app runs against this site and only
	 * receives tasks flagged true. A task without the flag is a bug in its
	 * definition; it is reported and hidden from MainWP.
	 *
	 * @param array<int, array<string, mixed>> $tasks Raw task definitions.
	 * @return array<int, array<string, mixed>>
	 */
	private function require_mainwp_flag( array $tasks ): array {
		foreach ( $tasks as $index => $task ) {
			if ( isset( $task['mainwp'] ) && is_bool( $task['mainwp'] ) ) {
				continue;
			}
			_doing_it_wrong(
				__METHOD__,
				sprintf( 'Task "%s" must declare mainwp => true|false.', esc_html( (string) ( $task['id'] ?? '' ) ) ),
				'3.7.2'
			);
			$tasks[ $index ]['mainwp'] = false;
		}
		return $tasks;
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
		$is_mainwp_request       = $this->is_mainwp_request();

		foreach ( $tasks as $index => $task ) {
			// the MainWP dashboard only receives tasks that make sense there.
			if ( $is_mainwp_request && ! $task['mainwp'] ) {
				unset( $tasks[ $index ] );
				continue;
			}

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

			// dismiss all non critical tasks if this option is enabled.
			if ( $dismiss_non_error_tasks && ! $this->is_critical_task( $task ) ) {
				unset( $tasks[ $index ] );
			}
		}

		$tasks = $this->filter_unique_ids( $tasks );

		$tasks = $this->filter_drip_tasks( $tasks );

		// sort so important notices and warnings are on top.
		$important = [];
		$warnings  = [];
		$open      = [];
		$other     = [];
		foreach ( $tasks as $index => $task ) {
			if ( $task['icon'] === 'important' ) {
				$important[ $index ] = $task;
			} elseif ( $task['icon'] === 'warning' ) {
				$warnings[ $index ] = $task;
			} elseif ( $task['icon'] === 'open' ) {
				$open[ $index ] = $task;
			} else {
				$other[ $index ] = $task;
			}
		}
		return $important + $warnings + $open + $other;
	}

	/**
	 * Whether a task stays visible when "Dismiss all notices except critical
	 * ones" is enabled.
	 *
	 * @param array<string, mixed> $task Task definition.
	 */
	public function is_critical_task( array $task ): bool {
		return in_array( $task['icon'] ?? 'open', self::CRITICAL_ICONS, true );
	}

	/**
	 * Filter tasks so only one eligible informative/new task is surfaced at a time,
	 * adhering to the 3-day interval after dismissals.
	 * Critical errors, warnings, clientside tasks, and sales notices are never filtered.
	 *
	 * @param array<int, array<string, mixed>> $tasks Active tasks list.
	 * @return array<int, array<string, mixed>> Filtered tasks list.
	 */
	public function filter_drip_tasks( array $tasks ): array {
		$non_drip_tasks  = [];
		$drip_candidates = [];

		foreach ( $tasks as $index => $task ) {
			if ( ! $this->is_drip_task( $task ) ) {
				$non_drip_tasks[ $index ] = $task;
			} else {
				$drip_candidates[ $index ] = $task;
			}
		}

		if ( empty( $drip_candidates ) ) {
			return $non_drip_tasks;
		}

		$active_id = (string) get_option( 'burst_active_drip_task', '' );
		if ( '' !== $active_id ) {
			foreach ( $drip_candidates as $index => $candidate ) {
				if ( ( $candidate['id'] ?? '' ) === $active_id ) {
					return $non_drip_tasks + [ $index => $candidate ];
				}
			}
		}

		return $non_drip_tasks;
	}

	/**
	 * Advance to the next active drip task if none is active or current is no longer valid,
	 * respecting the cooldown interval after dismissals.
	 */
	public function maybe_advance_drip_task(): void {
		$active_id = (string) get_option( 'burst_active_drip_task', '' );

		// Check if cooldown is active.
		$last_dismissed = (int) get_option( 'burst_drip_last_dismissed_time', 0 );
		if ( 0 !== $last_dismissed && ( time() - $last_dismissed ) < $this->get_drip_interval() ) {
			if ( '' !== $active_id ) {
				delete_option( 'burst_active_drip_task' );
			}
			return;
		}

		// Find all eligible drip candidates.
		$raw_tasks  = $this->get_raw_tasks();
		$candidates = [];
		foreach ( $raw_tasks as $task ) {
			if ( ! $this->is_drip_task( $task ) ) {
				continue;
			}
			if ( ! $this->has_task( $task['id'] ) ) {
				continue;
			}
			if ( $this->is_dismissed_permanently( $task['id'] ) ) {
				continue;
			}
			$candidates[] = $task;
		}

		if ( empty( $candidates ) ) {
			delete_option( 'burst_active_drip_task' );
			return;
		}

		// Sort by drip_order ascending.
		usort(
			$candidates,
			static function ( array $a, array $b ): int {
				$order_a = $a['drip_order'] ?? 0;
				$order_b = $b['drip_order'] ?? 0;
				return $order_a <=> $order_b;
			}
		);

		$next_task = reset( $candidates );

		// If current active task is still active and valid in burst_tasks.
		if ( '' !== $active_id && $this->has_task( $active_id ) ) {
			$active_task  = $this->get_task_by_id( $active_id );
			$active_order = (int) ( $active_task['drip_order'] ?? PHP_INT_MAX );
			$next_order   = (int) ( $next_task['drip_order'] ?? PHP_INT_MAX );
			// Keep current active task unless a strictly higher-priority (lower drip_order) candidate is available.
			if ( $active_order <= $next_order ) {
				return;
			}
		}

		update_option( 'burst_active_drip_task', $next_task['id'], false );
		delete_transient( 'burst_plusone_count' );
	}

	/**
	 * Check if a task is an informative/new task subject to dripping.
	 *
	 * @param array<string, mixed> $task Task definition.
	 */
	public function is_drip_task( array $task ): bool {
		return isset( $task['drip_order'] );
	}

	/**
	 * Get the drip interval in seconds (default 3 days).
	 */
	public function get_drip_interval(): int {
		/**
		 * Filter the interval between dripped tasks.
		 *
		 * @param int $interval Interval in seconds.
		 */
		return (int) apply_filters( 'burst_drip_interval', self::DEFAULT_DRIP_INTERVAL );
	}

	/**
	 * Handle tour completion: immediately advance to next drip task (bypass 3-day wait).
	 */
	public function on_tour_completed(): void {
		delete_option( 'burst_drip_last_dismissed_time' );
		$this->dismiss_task( 'interactive_tour', false );
		$this->maybe_dismiss_permanently( 'interactive_tour' );
		if ( get_option( 'burst_active_drip_task' ) === 'interactive_tour' ) {
			delete_option( 'burst_active_drip_task' );
		}

		delete_transient( 'burst_plusone_count' );
		$this->schedule_task_validation();
		$this->maybe_advance_drip_task();
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
			'important' => __( 'Important', 'burst-statistics' ),
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

			$ttl            = DAY_IN_SECONDS;
			$last_dismissed = (int) get_option( 'burst_drip_last_dismissed_time', 0 );
			if ( 0 !== $last_dismissed ) {
				$elapsed  = time() - $last_dismissed;
				$interval = $this->get_drip_interval();
				if ( $elapsed < $interval ) {
					$remaining = $interval - $elapsed;
					$ttl       = min( DAY_IN_SECONDS, max( 60, $remaining ) );
				}
			}

			set_transient( 'burst_plusone_count', $count, $ttl );
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
		if ( str_contains( $func, 'burst_option_' ) ) {
			$output = $this->get_option_bool( str_replace( 'burst_option_', '', $func ) );
		} elseif ( str_contains( $func, 'wp_option_' ) ) {
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

	/**
	 * Whether the MainWP Child plugin is active.
	 */
	public static function is_mainwp_child_active(): bool {
		$mainwp_child_plugin = 'mainwp-child/mainwp-child.php';

		if ( ! file_exists( WP_PLUGIN_DIR . '/' . $mainwp_child_plugin ) ) {
			return false;
		}

		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$is_mainwp_child_active = is_plugin_active( $mainwp_child_plugin );
		if ( is_multisite() ) {
			$is_mainwp_child_active = $is_mainwp_child_active || is_plugin_active_for_network( $mainwp_child_plugin );
		}

		return $is_mainwp_child_active;
	}

	/**
	 * Check if WP Consent API is active.
	 */
	public static function is_wp_consent_api_active(): bool {
		return function_exists( 'wp_has_consent' );
	}

	/**
	 * Plugin directory slugs of the most common cookie banner plugins.
	 *
	 * @var string[]
	 */
	private const COOKIE_BANNER_SLUGS = [
		'complianz-gdpr',
		'complianz-gdpr-premium',
		// CookieYes.
		'cookie-law-info',
		// Cookie Notice & Compliance.
		'cookie-notice',
		// Moove GDPR Cookie Compliance.
		'gdpr-cookie-compliance',
		'cookiebot',
		'real-cookie-banner',
		'real-cookie-banner-pro',
		'borlabs-cookie',
		'iubenda-cookie-law-solution',
		// WP Cookie Consent (WPEka).
		'gdpr-cookie-consent',
		// Termly.
		'uk-cookie-consent',
		// WPConsent.
		'wpconsent-cookies-banner-privacy-suite',
	];

	/**
	 * Check if a consent banner is active: the WP Consent API, or one of the
	 * most common cookie banner plugins. A banner without the Consent API can
	 * still withhold tracking (script blockers), so both count.
	 */
	public static function consent_banner_active(): bool {
		if ( self::is_wp_consent_api_active() ) {
			return true;
		}

		$active = (array) get_option( 'active_plugins', [] );
		if ( is_multisite() ) {
			$active = array_merge( $active, array_keys( (array) get_site_option( 'active_sitewide_plugins', [] ) ) );
		}

		foreach ( $active as $basename ) {
			$slug = strtok( (string) $basename, '/' );
			if ( in_array( $slug, self::COOKIE_BANNER_SLUGS, true ) ) {
				return true;
			}
		}

		return false;
	}
}
