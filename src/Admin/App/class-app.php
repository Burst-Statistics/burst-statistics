<?php
namespace Burst\Admin\App;

use Burst\Admin\App\Fields\Fields;
use Burst\Admin\App\Menu\Menu;
use Burst\Admin\Burst_Onboarding\Burst_Onboarding;
use Burst\Pro\Pro_Statistics;
use Burst\TeamUpdraft\Installer\Installer;
use Burst\Admin\Statistics\Goal_Statistics;
use Burst\Admin\Statistics\Statistics;
use Burst\Admin\Tasks;
use Burst\Frontend\Endpoint;
use Burst\Frontend\Goals\Goal;
use Burst\Frontend\Goals\Goals;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Save;
use Burst\Traits\Sanitize;
use Burst\TeamUpdraft\Onboarding\Onboarding;
use function Burst\burst_loader;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once BURST_PATH . 'src/Admin/App/rest-api-optimizer/rest-api-optimizer.php';
require_once BURST_PATH . 'src/Admin/App/media/media-override.php';

class App {
	use Helper;
	use Admin_Helper;
	use Save;
	use Sanitize;

	public Menu $menu;
	public Fields $fields;
	public Tasks $tasks;

	/**
	 * Initialize the App class
	 */
	public function init(): void {
		add_action( 'admin_menu', [ $this, 'add_menu' ] );
		add_action( 'wp_ajax_burst_rest_api_fallback', [ $this, 'rest_api_fallback' ] );
		add_action( 'admin_footer', [ $this, 'fix_duplicate_menu_item' ], 1 );
		add_action( 'burst_after_save_field', [ $this, 'update_for_multisite' ], 10, 4 );
		add_action( 'rest_api_init', [ $this, 'settings_rest_route' ], 8 );
		add_filter( 'burst_localize_script', [ $this, 'extend_localized_settings_for_dashboard' ], 10, 1 );
		add_action( 'burst_weekly', [ $this, 'weekly_clear_referrers_table' ] );
		$this->menu   = new Menu();
		$this->fields = new Fields();
		$onboarding   = new Burst_Onboarding();
		$onboarding->init();

		add_action( 'admin_init', [ $this, 'maybe_redirect_to_settings_page' ] );
	}

	/**
	 * After activation, redirect the user to the settings page.
	 */
	public function maybe_redirect_to_settings_page(): void {
		// not processing form data, only a conditional redirect, which is available only temporarily.
        // phpcs:ignore
		if ( get_transient( 'burst_redirect_to_settings_page' ) && ( ! isset( $_GET['page'] ) || $_GET['page'] !== 'burst' ) ) {
			delete_transient( 'burst_redirect_to_settings_page' );
			wp_safe_redirect( $this->admin_url( 'burst' ) );
			exit;
		}
	}

	/**
	 * Remove the fallback notice if REST API is working again
	 */
	public function remove_fallback_notice(): void {
		if ( get_option( 'burst_ajax_fallback_active' ) !== false ) {
			delete_option( 'burst_ajax_fallback_active' );
			delete_option( 'burst_ajax_fallback_active_timestamp' );
			\Burst\burst_loader()->admin->tasks->schedule_task_validation();
		}
	}

	/**
	 * Fix the duplicate menu item
	 */
	public function fix_duplicate_menu_item(): void {
		/**
		 * Handles URL changes to update the active menu item
		 * Ensures the WordPress admin menu stays in sync with the React app navigation
		 */
		// not processing form data, only a conditional script on the burst page.
        // phpcs:ignore
		if ( isset( $_GET['page'] ) && $_GET['page'] === 'burst' ) {
			?>
			<script>
				window.addEventListener("load", () => {
					const submenu = document.querySelector('li.wp-has-current-submenu.toplevel_page_burst .wp-submenu');
					const burstMain = document.querySelector('li.toplevel_page_burst ul.wp-submenu li.wp-first-item a');
					if (burstMain) burstMain.href = '#/';
					if (!submenu) return;

					const menuItems = submenu.querySelectorAll('li');

					const getBaseHash = (url) => {
						const [base, hash = ''] = url.split('#');
						const section = hash.split('/')[1] || '';
						return `${base}#/${section}`;
					};

					const normalize = (url) => {
						try {
							const u = new URL(url);
							const page = u.searchParams.get('page');
							if (!page) return url;
							const hash = url.includes('#') ? '#' + url.split('#')[1] : '';
							return getBaseHash(`${u.origin}${u.pathname}?page=${page}${hash}`);
						} catch {
							return url;
						}
					};

					const updateActiveMenu = () => {
						const current = normalize(location.href);
						menuItems.forEach(item => {
							const link = item.querySelector('a');
							item.classList.toggle('current', link && normalize(link.href) === current);
						});
					};

					updateActiveMenu();

					['pushState', 'replaceState'].forEach(type => {
						const original = history[type];
						history[type] = function () {
							original.apply(this, arguments);
							updateActiveMenu();
						};
					});

					window.addEventListener('popstate', updateActiveMenu);
					window.addEventListener('hashchange', updateActiveMenu);
				});
			</script>
			<?php
		}
	}


	/**
	 * Add a menu item for the plugin
	 */
	public function add_menu(): void {
		if ( ! $this->user_can_view() ) {
			return;
		}

		// if track network wide is enabled, show the menu only on the main site.
		if ( is_multisite() && get_site_option( 'burst_track_network_wide' ) && self::is_networkwide_active() ) {
			if ( ! is_main_site() ) {
				return;
			}
		}

		$menu_label    = __( 'Statistics', 'burst-statistics' );
		$count         = burst_loader()->admin->tasks->plusone_count();
		$warning_title = esc_attr( $this->sprintf( '%d plugin warnings', $count ) );
		if ( $count > 0 ) {
			$warning_title .= ' ' . esc_attr( $this->sprintf( '(%d plus ones)', $count ) );
			$menu_label    .=
				"<span class='update-plugins count-$count' title='$warning_title'>
			<span class='update-count'>
				" . number_format_i18n( $count ) . '
			</span>
		</span>';
		}

		$page_hook_suffix = add_menu_page(
			'Burst Statistics',
			$menu_label,
			'view_burst_statistics',
			'burst',
			[ $this, 'dashboard' ],
			BURST_URL . 'assets/img/burst-wink.svg',
			apply_filters( 'burst_menu_position', 3 )
		);

		// Get menu configuration and create submenu items dynamically.
		$menu_config = $this->get_menu_config();
		$this->create_submenu_items( $menu_config );

		// Add "Upgrade to Pro" menu item if not Pro version.
		$this->add_upgrade_menu_item();

		add_action( "admin_print_scripts-{$page_hook_suffix}", [ $this, 'plugin_admin_scripts' ], 1 );
	}

	/**
	 * Get menu configuration from config file
	 *
	 * @return array<int, array<string, mixed>> Menu configuration array
	 */
	private function get_menu_config(): array {
		$config_file = BURST_PATH . 'src/Admin/App/config/menu.php';
		if ( ! file_exists( $config_file ) ) {
			return [];
		}

		$menu_config = include $config_file;
		return is_array( $menu_config ) ? $menu_config : [];
	}

	/**
	 * Create submenu items from configuration
	 *
	 * @param array<int, array<string, mixed>> $menu_config Menu configuration array.
	 */
	private function create_submenu_items( array $menu_config ): void {
		foreach ( $menu_config as $menu_item ) {
			// Skip items that shouldn't appear in WordPress admin menu.
			if ( ! isset( $menu_item['show_in_admin'] ) || ! $menu_item['show_in_admin'] ) {
				continue;
			}

			$capability = $menu_item['capabilities'] ?? 'view_burst_statistics';
			if ( ! current_user_can( $capability ) ) {
				continue;
			}

			$page_title = $menu_item['title'] ?? '';
			$menu_title = $menu_item['title'] ?? '';
			$menu_slug  = $menu_item['menu_slug'] ?? 'burst';

			add_submenu_page(
				'burst',
				$page_title,
				$menu_title,
				$capability,
				$menu_slug,
				[ $this, 'dashboard' ]
			);
		}
	}

	/**
	 * Add "Upgrade to Pro" menu item if not Pro version
	 */
    // phpcs:disable
	private function add_upgrade_menu_item(): void {
		if ( defined( 'BURST_PRO' ) ) {
			return;
		}

		global $submenu;
		if ( ! isset( $submenu['burst'] ) ) {
			return;
		}

		$class              = 'burst-link-upgrade';
		$highest_index      = count( $submenu['burst'] );
		$submenu['burst'][] = [
			__( 'Upgrade to Pro', 'burst-statistics' ),
			'manage_burst_statistics',
			$this->get_website_url( 'pricing/', [ 'utm_source' => 'plugin-submenu-upgrade' ] ),
		];

		if ( isset( $submenu['burst'][ $highest_index ] ) ) {
			if ( ! isset( $submenu['burst'][ $highest_index ][4] ) ) {
				$submenu['burst'][ $highest_index ][4] = '';
			}
			$submenu['burst'][ $highest_index ][4] .= ' ' . $class;
		}
	}
    // phpcs:enable

	/**
	 * Enqueue scripts for the plugin
	 */
	public function plugin_admin_scripts(): void {
		$js_data = $this->get_chunk_translations( 'src/Admin/App/build' );
		if ( empty( $js_data ) ) {
			return;
		}

		// Add cache busting only in development. Check for WP_DEBUG.
		// @phpstan-ignore-next-line.
		$dev_mode = defined( 'WP_DEBUG' ) && WP_DEBUG;
		$version  = $dev_mode ? time() : $js_data['version'];

		wp_enqueue_style(
			'burst-tailwind',
			plugins_url( '/src/tailwind.generated.css', __FILE__ ),
			[],
			$version
		);

		// @phpstan-ignore-next-line
		burst_wp_enqueue_media();

		// add 'wp-core-data' to the dependencies.
		$js_data['dependencies'][] = 'wp-core-data';

		// Load the main script in the head with high priority.
		wp_enqueue_script(
			'burst-settings',
			plugins_url( 'build/' . $js_data['js_file'], __FILE__ ),
			$js_data['dependencies'],
			$js_data['version'],
			[
				'strategy'  => 'async',
				'in_footer' => false,
			]
		);

		// Add high priority to the script.
		add_filter(
			'script_loader_tag',
			function ( $tag, $handle, $src ) {
				// Unused variable, but required by the function signature.
				unset( $src );
				if ( $handle === 'burst-settings' ) {
					return str_replace( ' src', ' fetchpriority="high" src', $tag );
				}
				return $tag;
			},
			10,
			3
		);

		// In development mode, force no caching for our scripts.
		if ( $dev_mode ) {
			add_filter(
				'script_loader_src',
				function ( $src, $handle ) {
					if ( $handle === 'burst-settings' ) {
						return add_query_arg( 'ver', time(), $src );
					}
					return $src;
				},
				10,
				2
			);
		}
		$path = defined( 'BURST_PRO' ) ? BURST_PATH . 'languages' : false;
		wp_set_script_translations( 'burst-settings', 'burst-statistics', $path );

		wp_localize_script(
			'burst-settings',
			'burst_settings',
			$this->localized_settings( $js_data )
		);
	}

	/**
	 * Get available date ranges for the dashboard.
	 *
	 * @return string[] List of date range slugs.
	 */
	public function get_date_ranges(): array {
		return apply_filters(
			'burst_date_ranges',
			[
				'today',
				'yesterday',
				'last-7-days',
				'last-30-days',
				'last-90-days',
				'last-month',
				'last-year',
				'week-to-date',
				'month-to-date',
				'year-to-date',
			]
		);
	}

	/**
	 * Extend the localized settings for the dashboard.
	 *
	 * @param array<string, mixed> $data
	 * @return array<string, mixed>
	 */
	public function extend_localized_settings_for_dashboard( array $data ): array {
		$data['menu']   = $this->menu->get();
		$data['fields'] = $this->fields->get();
		return $data;
	}

	/**
	 * If the rest api is blocked, the code will try an admin ajax call as fall back.
	 */
	public function rest_api_fallback(): void {
		$response  = [];
		$error     = false;
		$action    = false;
		$do_action = false;
		$data      = [];
		$data_type = false;

		if ( ! $this->user_can_view() ) {
			$error = true;
		}

		// --- Parse GET ---
        // phpcs:ignore
        if ( isset( $_GET['rest_action'] ) ) {
            // phpcs:ignore
            $action = sanitize_text_field( $_GET['rest_action'] );
			if ( strpos( $action, 'burst/v1/data/' ) !== false ) {
				$data_type = strtolower( str_replace( 'burst/v1/data/', '', $action ) );
			}
		}

		// --- Collect GET params ---
        // phpcs:ignore
        $get_params = $_GET;
		unset( $get_params['rest_action'] );

		// --- Parse POST body, if present ---
		$request_data = json_decode( file_get_contents( 'php://input' ), true );
		if ( is_array( $request_data ) ) {
			$req_path = isset( $request_data['path'] ) ? sanitize_text_field( $request_data['path'] ) : false;
			if ( $req_path ) {
				// override if provided by POST.
				$action = $req_path;
				if ( ! $data_type && strpos( $action, 'burst/v1/data/' ) !== false ) {
					// Extract data type for /data/* when using POST.
					$data_type = strtolower( str_replace( 'burst/v1/data/', '', $action ) );
				}
			}
			$data = isset( $request_data['data'] ) && is_array( $request_data['data'] ) ? $request_data['data'] : [];

			if ( strpos( $action, 'burst/v1/do_action/' ) !== false ) {
				$do_action = strtolower( str_replace( 'burst/v1/do_action/', '', $action ) );
			}
		}

		$nonce = $get_params['nonce'] ?? ( $request_data['data']['nonce'] ?? null );
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			$response = new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'The provided nonce is not valid.',
				]
			);
			ob_get_clean();
			header( 'Content-Type: application/json' );
			echo wp_json_encode( $response );
			exit;
		}

		// Fallback notice.
		$fallback_already_active = (int) get_option( 'burst_ajax_fallback_active_timestamp', 0 );
		if ( $fallback_already_active === 0 ) {
			update_option( 'burst_ajax_fallback_active_timestamp', time(), false );
		}
		if ( $fallback_already_active > 0 && ( time() - $fallback_already_active ) > 48 * HOUR_IN_SECONDS ) {
			update_option( 'burst_ajax_fallback_active', true, false );
		}

		// Normalize/merge params from GET and POST data.
		$merged = $get_params;
		foreach ( [ 'goal_id', 'type', 'date_start', 'date_end', 'args', 'search', 'filters', 'metrics', 'group_by' ] as $k ) {
			if ( array_key_exists( $k, $data ) ) {
				$merged[ $k ] = $data[ $k ];
			}
		}

		// Convert metrics string -> array.
		if ( isset( $merged['metrics'] ) && is_string( $merged['metrics'] ) ) {
			$merged['metrics'] = explode( ',', $merged['metrics'] );
		}

		// Handle filters slashes (string JSON coming from GET); keep arrays as-is.
		if ( isset( $merged['filters'] ) && is_string( $merged['filters'] ) ) {
			$merged['filters'] = stripslashes( $merged['filters'] );
		}

		// Build WP_REST_Request with merged params.
		$request = new \WP_REST_Request();
		foreach ( [ 'goal_id', 'type', 'nonce', 'date_start', 'date_end', 'args', 'search', 'filters', 'metrics', 'group_by' ] as $arg ) {
			if ( isset( $merged[ $arg ] ) ) {
				$request->set_param( $arg, $merged[ $arg ] );
			}
		}

		// If we detected /data/, make sure 'type' is set from the path.
		if ( $data_type ) {
			$request->set_param( 'type', $data_type );
		}

		if ( ! $error ) {
			if ( strpos( $action, '/fields/get' ) !== false ) {
				$response = $this->rest_api_fields_get( $request );
			} elseif ( strpos( $action, '/fields/set' ) !== false ) {
				$response = $this->rest_api_fields_set( $request, $data );
			} elseif ( strpos( $action, '/options/set' ) !== false ) {
				$response = $this->rest_api_options_set( $request, $data );
			} elseif ( strpos( $action, '/goals/get' ) !== false ) {
				$response = $this->rest_api_goals_get( $request );
			} elseif ( strpos( $action, '/goals/add' ) !== false ) {
				$response = $this->rest_api_goals_add( $request, $data );
			} elseif ( strpos( $action, '/goals/delete' ) !== false ) {
				$response = $this->rest_api_goals_delete( $request, $data );
			} elseif ( strpos( $action, '/goal_fields/get' ) !== false ) {
				$response = $this->rest_api_goal_fields_get( $request );
			} elseif ( strpos( $action, '/goals/set' ) !== false ) {
				$response = $this->rest_api_goals_set( $request, $data );
			} elseif ( strpos( $action, '/posts/' ) !== false ) {
				$response = $this->get_posts( $request, $data );
			} elseif ( strpos( $action, '/data/' ) !== false ) {
				$response = $this->get_data( $request );
			} elseif ( $do_action ) {
				$req = new \WP_REST_Request();
				$req->set_param( 'action', $do_action );
				$response = $this->do_action( $req, $data );
			}
		}

		ob_get_clean();
		header( 'Content-Type: application/json' );
		echo wp_json_encode( $response );
		exit;
	}

	/**
	 * Render the settings page
	 */
	public function dashboard(): void {
		if ( ! $this->user_can_view() ) {
			return;
		}
		?>
		<style id="burst-skeleton-styles">
			/* Hide notices in the Burst menu */
			.toplevel_page_burst .notice {
				display: none;
			}
			
			/* Base styles for the Burst statistics container */
			#burst-statistics {
				/* Add any base styles for the container */
			}
			
			/* Background colors */
			#burst-statistics .bg-white {
				--tw-bg-opacity: 1;
				background-color: rgb(255 255 255 / var(--tw-bg-opacity));
			}
			
			#burst-statistics .bg-gray-200 {
				--tw-bg-opacity: 1;
				background-color: rgb(229 231 235 / var(--tw-bg-opacity));
			}
			
			/* Layout */
			#burst-statistics .mx-auto {
				margin-left: auto;
				margin-right: auto;
			}
			
			#burst-statistics .flex {
				display: flex;
			}
			
			#burst-statistics .grid {
				display: grid;
			}
			
			#burst-statistics .grid-cols-12 {
				grid-template-columns: repeat(12, minmax(0, 1fr));
			}
			
			#burst-statistics .grid-rows-5 {
				grid-template-rows: repeat(5, minmax(0, 1fr));
			}
			
			#burst-statistics .col-span-6 {
				grid-column: span 6 / span 6;
			}
			
			#burst-statistics .col-span-3 {
				grid-column: span 3 / span 3;
			}
			
			#burst-statistics .row-span-2 {
				grid-row: span 2 / span 2;
			}
			
			#burst-statistics .items-center {
				align-items: center;
			}
			
			/* Spacing */
			#burst-statistics .gap-5 {
				gap: 1.25rem;
			}
			
			#burst-statistics .px-5 {
				padding-left: 1.25rem;
				padding-right: 1.25rem;
			}
			
			#burst-statistics .py-2 {
				padding-top: 0.5rem;
				padding-bottom: 0.5rem;
			}
			
			#burst-statistics .py-6 {
				padding-top: 1.5rem;
				padding-bottom: 1.5rem;
			}
			
			#burst-statistics .p-5 {
				padding: 1.25rem;
			}
			
			#burst-statistics .m-5 {
				margin: 1.25rem;
			}
			
			#burst-statistics .mb-5 {
				margin-bottom: 1.25rem;
			}
			
			#burst-statistics .ml-2 {
				margin-left: 0.5rem;
			}
			
			/* Sizing */
			#burst-statistics .h-6 {
				height: 1.5rem;
			}
			
			#burst-statistics .h-11 {
				height: 2.75rem;
			}
			
			#burst-statistics .w-auto {
				width: auto;
			}
			
			#burst-statistics .w-1\/2 {
				width: 50%;
			}
			
			#burst-statistics .w-4\/5 {
				width: 80%;
			}
			
			#burst-statistics .w-5\/6 {
				width: 83.333333%;
			}
			
			#burst-statistics .w-full {
				width: 100%;
			}
			
			#burst-statistics .min-h-full {
				min-height: 100%;
			}
			
			#burst-statistics .max-w-screen-2xl {
				max-width: 1600px;
			}
			
			/* Effects */
			#burst-statistics .shadow-md {
				--tw-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
				--tw-shadow-colored: 0 4px 6px -1px var(--tw-shadow-color), 0 2px 4px -2px var(--tw-shadow-color);
				box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
			}
			
			#burst-statistics .rounded-md {
				border-radius: 0.375rem;
			}
			
			#burst-statistics .rounded-xl {
				border-radius: 0.75rem;
			}
			
			#burst-statistics .animate-pulse {
				animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
			}
			
			@keyframes pulse {
				0%, 100% {
					opacity: 1;
				}
				50% {
					opacity: .5;
				}
			}
			
			#burst-statistics .blur-sm {
				--tw-blur: blur(4px);
				filter: var(--tw-blur);
			}

			/* Borders */
			#burst-statistics .border-b-4 {
				border-bottom-width: 4px;
			}
			
			#burst-statistics .border-transparent {
				border-color: transparent;
			}
		</style>
		<div id="burst-statistics" class="burst">
			<div class="bg-white">
				<div class="mx-auto flex max-w-screen-2xl items-center gap-5 px-5">
					<div>
						<img width="100" src="<?php echo esc_url_raw( BURST_URL ) . 'assets/img/burst-logo.svg'; ?>" alt="Logo Burst" class="h-11 w-auto px-5 py-2">
					</div>
					<div class="flex items-center blur-sm animate-pulse">
						<div class="py-6 px-5 border-b-4 border-transparent"><?php esc_html_e( 'Dashboard', 'burst-statistics' ); ?></div>
						<div class="py-6 px-5 border-b-4 border-transparent ml-2"><?php esc_html_e( 'Statistics', 'burst-statistics' ); ?></div>
						<div class="py-6 px-5 border-b-4 border-transparent ml-2"><?php esc_html_e( 'Settings', 'burst-statistics' ); ?></div>
					</div>
				</div>
			</div>

			<!-- Content Grid -->
			<div class="mx-auto flex max-w-screen-2xl">
				<div class="m-5 grid min-h-full w-full grid-cols-12 grid-rows-5 gap-5">
					<!-- Left Block -->
					<div class="col-span-6 row-span-2 bg-white shadow-md rounded-xl p-5">
						<div class="h-6 w-1/2 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-4/5 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-full px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-4/5 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-full px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
					</div>

					<!-- Middle Block -->
					<div class="col-span-3 row-span-2 bg-white shadow-md rounded-xl p-5">
						<div class="h-6 w-1/2 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-4/5 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-full px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-4/5 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-full px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
					</div>

					<!-- Right Block -->
					<div class="col-span-3 row-span-2 bg-white shadow-md rounded-xl p-5">
						<div class="h-6 w-1/2 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-4/5 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-full px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-4/5 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-full px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
						<div class="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
					</div>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Register REST API routes for the plugin.
	 */
	public function settings_rest_route(): void {
		// for our ajax fallback test, we don't want to register the REST API routes.
		if ( defined( 'BURST_FALLBACK_TEST' ) ) {
			return;
		}
		register_rest_route(
			'burst/v1',
			'menu',
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'rest_api_menu' ],
				'permission_callback' => function () {
					return $this->user_can_manage();
				},
			]
		);

		register_rest_route(
			'burst/v1',
			'options/set',
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_api_options_set' ],
				'permission_callback' => function () {
					return $this->user_can_manage();
				},
			]
		);

		register_rest_route(
			'burst/v1',
			'fields/get',
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'rest_api_fields_get' ],
				'permission_callback' => function () {
					return $this->user_can_manage();
				},
			]
		);

		register_rest_route(
			'burst/v1',
			'fields/set',
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_api_fields_set' ],
				'permission_callback' => function () {
					return $this->user_can_manage();
				},
			]
		);

		register_rest_route(
			'burst/v1',
			'goals/get',
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'rest_api_goals_get' ],
				'permission_callback' => function () {
					return $this->user_can_view();
				},
			]
		);

		register_rest_route(
			'burst/v1',
			'goals/delete',
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_api_goals_delete' ],
				'permission_callback' => function () {
					return $this->user_can_manage();
				},
			]
		);

		register_rest_route(
			'burst/v1',
			'goals/add_predefined',
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_api_goals_add_predefined' ],
				'permission_callback' => function () {
					return $this->user_can_manage();
				},
			]
		);
		// add_predefined.
		register_rest_route(
			'burst/v1',
			'goals/add',
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_api_goals_add' ],
				'permission_callback' => function () {
					return $this->user_can_manage();
				},
			]
		);

		register_rest_route(
			'burst/v1',
			'goals/set',
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'rest_api_goals_set' ],
				'permission_callback' => function () {
					return $this->user_can_manage();
				},
			]
		);

		register_rest_route(
			'burst/v1',
			'data/(?P<type>[a-z\_\-]+)',
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_data' ],
				'permission_callback' => function () {
					return $this->user_can_view();
				},
			]
		);

		register_rest_route(
			'burst/v1',
			'do_action/(?P<action>[a-z\_\-]+)',
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'do_action' ],
				'permission_callback' => function () {
					return $this->user_can_view();
				},
			]
		);

		register_rest_route(
			'burst/v1',
			'/posts/',
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_posts' ],
				'args'                => [
					'search_input' => [
						'required'          => false,
						'sanitize_callback' => 'sanitize_title',
					],
				],
				'permission_callback' => function () {
					return $this->user_can_manage();
				},
			]
		);
	}


	/**
	 * Perform a specific action based on the provided request.
	 *
	 * @param \WP_REST_Request $request //The REST API request object.
	 * @param array            $ajax_data //Optional AJAX data to process.
	 * @return \WP_REST_Response //The response object or error.
	 */
	public function do_action( \WP_REST_Request $request, array $ajax_data = [] ): \WP_REST_Response {
		if ( ! $this->user_can_view() ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'You do not have permission to perform this action.',
				]
			);
		}
		$action = sanitize_title( $request->get_param( 'action' ) );
		$data   = empty( $ajax_data ) ? $request->get_params() : $ajax_data;
		$nonce  = $data['nonce'];
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'The provided nonce is not valid.',
				]
			);
		}

		$data = $data['action_data'];
		if ( empty( $ajax_data ) ) {
			$this->remove_fallback_notice();
		}
		switch ( $action ) {
			case 'plugin_actions':
				$data = $this->plugin_actions( $request, $data );
				break;
			case 'tasks':
				$data = \Burst\burst_loader()->admin->tasks->get();
				break;
			case 'dismiss_task':
				if ( isset( $data['id'] ) ) {
					$id = sanitize_title( $data['id'] );
					\Burst\burst_loader()->admin->tasks->dismiss_task( $id );
				}
				break;
			case 'otherpluginsdata':
				$data = $this->other_plugins_data();
				break;
			case 'tracking':
				$data = Endpoint::get_tracking_status_and_time();
				break;
			case 'get_filter_options':
				$data_type = isset( $data['data_type'] ) ? sanitize_title( $data['data_type'] ) : '';
				$data      = $this->get_filter_options( $data_type );
				break;
			default:
				$data = apply_filters( 'burst_do_action', [], $action, $data );
		}

		if ( ob_get_length() ) {
			ob_clean();
		}

		return new \WP_REST_Response(
			[
				'data'            => $data,
				'request_success' => true,
			],
			200
		);
	}

	/**
	 * Get advanced filter options.
	 *
	 * @param string $data_type The specific data type to return (devices, browsers, platforms, countries, pages, referrers, campaigns).
	 * @return array
	 */
	private function get_filter_options( string $data_type ): array {
		if ( ! $this->user_can_view() ) {
			return [];
		}

		global $wpdb;
		$valid_types = [ 'devices', 'browsers', 'platforms', 'countries', 'states', 'cities', 'pages', 'referrers', 'campaigns', 'sources', 'mediums', 'contents', 'terms' ];

		// Return invalid data type error.
		if ( empty( $data_type ) || ! in_array( $data_type, $valid_types, true ) ) {
			return [
				'success' => false,
				'message' => 'Invalid data type. Valid types are: ' . implode( ', ', $valid_types ),
			];
		}

		// Define data type queries.
		$queries = [
			'devices'   => "SELECT MIN(ID) as ID, name FROM {$wpdb->prefix}burst_devices GROUP BY name",
			'browsers'  => "SELECT MIN(ID) as ID, name FROM {$wpdb->prefix}burst_browsers GROUP BY name",
			'platforms' => "SELECT MIN(ID) as ID, name FROM {$wpdb->prefix}burst_platforms GROUP BY name",
			'states'    => "SELECT DISTINCT state AS name FROM {$wpdb->prefix}burst_locations",
			'cities'    => "SELECT DISTINCT city AS name FROM {$wpdb->prefix}burst_locations",
			'pages'     => "SELECT DISTINCT page_url AS name FROM {$wpdb->prefix}burst_statistics",
			'campaigns' => "SELECT DISTINCT campaign AS name FROM {$wpdb->prefix}burst_campaigns",
			'sources'   => "SELECT DISTINCT source AS name FROM {$wpdb->prefix}burst_campaigns",
			'mediums'   => "SELECT DISTINCT medium AS name FROM {$wpdb->prefix}burst_campaigns",
			'contents'  => "SELECT DISTINCT content AS name FROM {$wpdb->prefix}burst_campaigns",
			'terms'     => "SELECT DISTINCT term AS name FROM {$wpdb->prefix}burst_campaigns",
		];

		// Get raw data based on data type.
		if ( $data_type === 'countries' ) {
			$raw_data = apply_filters( 'burst_countries', [] );
			// filter out localhost.
			unset( $raw_data['LO'] );
			$raw_data = array_map(
				fn( $key, $value ) => [
					'ID'   => $key,
					'name' => $value,
				],
				array_keys( $raw_data ),
				$raw_data
			);
		} elseif ( $data_type === 'referrers' ) {
			$raw_data = $this->get_referrer_options();
			$raw_data = array_map(
				fn( $value ) => [
					'ID'   => $value['name'],
					'name' => $value['name'],
				],
				array_values( $raw_data )
			);
		} else {
			$raw_data = $wpdb->get_results( $queries[ $data_type ], ARRAY_A );
			$raw_data = array_filter(
				$raw_data,
				function ( $item ) {
					foreach ( [ 'name', 'id', 'key' ] as $field ) {
						if ( isset( $item[ $field ] ) ) {
							$value = trim( (string) $item[ $field ] );
							if ( $value === '' || $value === '-1' || $value === 'null' ) {
								return false;
							}
						}
					}

					return true;
				}
			);

			if ( $data_type === 'devices' ) {
				$raw_data = array_map(
					function ( $item ) {
						$item['key'] = $item['name'];
						// get nicename for device.
						switch ( $item['name'] ) {
							case 'desktop':
								$item['name'] = __( 'Desktop', 'burst-statistics' );
								break;
							case 'mobile':
								$item['name'] = __( 'Mobile', 'burst-statistics' );
								break;
							case 'tablet':
								$item['name'] = __( 'Tablet', 'burst-statistics' );
								break;
							default:
								$item['name'] = __( 'Other', 'burst-statistics' );
								break;
						}

						return $item;
					},
					$raw_data
				);
			}
		}

		return [
			'success' => true,
			'data'    => [
				$data_type => $raw_data,
			],
		];
	}

	/**
	 * On a weekly basis, clear the referrers table.
	 *
	 * @hooked burst_weekly
	 */
	public function weekly_clear_referrers_table(): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}
		global $wpdb;
		$wpdb->query( "TRUNCATE TABLE {$wpdb->prefix}burst_referrers" );
	}

	/**
	 * Get referrer options for the advanced filter. The table is cleared weekly, to ensure up to date data.
	 *
	 * @return array
	 */
	private function get_referrer_options(): array {
		global $wpdb;
		$referrers = $wpdb->get_results( "SELECT name FROM {$wpdb->prefix}burst_referrers ORDER BY ID ASC", ARRAY_A );
		if ( empty( $referrers ) ) {
			$sql = "INSERT IGNORE INTO {$wpdb->prefix}burst_referrers (name)
                    SELECT domain
                    FROM (
                      SELECT 
                        LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(referrer, '/', 3), '/', -1)) AS domain
                      FROM {$wpdb->prefix}burst_statistics
                      WHERE referrer IS NOT NULL 
                        AND referrer != ''
                        AND referrer LIKE 'http%'
                        AND referrer NOT LIKE '/%'
                    ) AS derived
                    WHERE domain != ''
                      AND SUBSTRING_INDEX(domain, ':', 1) NOT REGEXP '^[0-9]{1,3}(\\.[0-9]{1,3}){3}$'
                    GROUP BY domain
                    ORDER BY COUNT(*) DESC
                    LIMIT 2000;";
			$wpdb->query( $sql );
			$referrers = $wpdb->get_results( "select name from {$wpdb->prefix}burst_referrers ORDER BY ID ASC", ARRAY_A );
		}
		return $referrers;
	}

	/**
	 * Process plugin installation or activation actions based on the provided request.
	 *
	 * @param \WP_REST_Request      $request The REST API request object.
	 * @param array<string, string> $data    Associative array with 'slug' and 'pluginAction'.
	 * @return array<string, mixed>     Plugin data for the affected plugin.
	 */
	public function plugin_actions( \WP_REST_Request $request, array $data ): array {
		if ( ! $this->user_can_manage() ) {
			return [];
		}
		$slug      = sanitize_title( $data['slug'] );
		$action    = sanitize_title( $data['action'] );
		$installer = new Installer( 'burst-statistics', $slug );
		if ( $action === 'download' ) {
			$installer->download_plugin();
		} elseif ( $action === 'activate' ) {
			$installer->activate_plugin();
		}
		return $this->other_plugins_data( $slug );
	}

	/**
	 * Get plugin data for the "Other Plugins" section.
	 *
	 * @param string $slug Optional plugin slug to retrieve a single plugin entry.
	 * @return array<string, mixed>|array<int, array<string, mixed>> A single plugin data array if $slug is provided and matches, or a list of plugin data arrays otherwise.
	 */
	public function other_plugins_data( string $slug = '' ): array {
		if ( ! $this->user_can_view() ) {
			return [];
		}

		$installer = new Installer( 'burst-statistics' );
		if ( empty( $slug ) ) {
			return $installer->get_plugins( true );
		} else {
			return $installer->get_plugin( $slug );
		}
	}

	/**
	 * Process common REST API request patterns
	 *
	 * @param \WP_REST_Request $request The REST request object.
	 * @param string           $permission_level 'view' or 'manage'.
	 * @return array<string, mixed> Processed request data or error.
	 */
	private function process_rest_request( \WP_REST_Request $request, string $permission_level = 'view' ): array {
		$can_access = $permission_level === 'manage' ? $this->user_can_manage() : $this->user_can_view();
		if ( ! $can_access ) {
			return [
				'success' => false,
				'type'    => 'error',
				'message' => 'Invalid permissions',
			];
		}

		$nonce = $request->get_param( 'nonce' );
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return [
				'success' => false,
				'type'    => 'error',
				'message' => 'Invalid nonce',
			];
		}

		return [
			'success' => true,
			'type'    => sanitize_title( $request->get_param( 'type' ) ),
		];
	}

	/**
	 * Get data from the REST API.
	 */
	public function get_data( \WP_REST_Request $request ): \WP_REST_Response {
		// Process common request patterns.
		$processed = $this->process_rest_request( $request, 'view' );
		if ( $processed['success'] === false ) {
			return $this->create_rest_response( $processed, 403 );
		}

		$type = $processed['type'];
		$args = $this->sanitize_request_args( $request, $type );

		switch ( $type ) {
			case 'live-visitors':
				$is_onboarding = $request->get_param( 'isOnboarding' );
				if ( $is_onboarding ) {
					wp_schedule_single_event( time() + MINUTE_IN_SECONDS, 'burst_clear_test_visit' );
				}
				$data = \Burst\burst_loader()->admin->statistics->get_live_visitors_data();
				break;
			case 'today':
				$data = \Burst\burst_loader()->admin->statistics->get_today_data( $args );
				break;
			case 'goals':
				$goal_statistics = new Goal_Statistics();
				$data            = $goal_statistics->get_goals_data( $args );
				break;
			case 'live-goals':
				$goal_statistics = new Goal_Statistics();
				$data            = $goal_statistics->get_live_goals_count( $args );
				break;
			case 'insights':
				$data = \Burst\burst_loader()->admin->statistics->get_insights_data( $args );
				break;
			case 'compare':
				if ( isset( $args['filters']['goal_id'] ) ) {
					$data = \Burst\burst_loader()->admin->statistics->get_compare_goals_data( $args );
				} else {
					$data = \Burst\burst_loader()->admin->statistics->get_compare_data( $args );
				}
				break;
			case 'devicestitleandvalue':
				$data = \Burst\burst_loader()->admin->statistics->get_devices_title_and_value_data( $args );
				break;
			case 'devicessubtitle':
				$data = \Burst\burst_loader()->admin->statistics->get_devices_subtitle_data( $args );
				break;
			case 'datatable':
				$data = \Burst\burst_loader()->admin->statistics->get_datatables_data( $args );
				break;
			default:
				$data = apply_filters( 'burst_get_data', $type, $args, $request );
		}

		return $this->create_rest_response( $data );
	}

	/**
	 * Create standardized REST response
	 *
	 * @param mixed $data Response data.
	 * @param int   $status HTTP status code.
	 * @return \WP_REST_Response The REST response object.
	 */
	private function create_rest_response( $data, int $status = 200 ): \WP_REST_Response {
		if ( ob_get_length() ) {
			ob_clean();
		}

		if ( ( isset( $data['success'] ) && ! $data['success'] ) || $status !== 200 ) {
			return new \WP_REST_Response(
				[
					'data'    => $data,
					'success' => false,
				],
				$status
			);
		}

		return new \WP_REST_Response(
			[
				'data'            => $data,
				'request_success' => true,
				'success'         => true,
			],
			$status
		);
	}

	/**
	 * Save options through the rest api
	 */
	public function rest_api_options_set( \WP_REST_Request $request, array $ajax_data = [] ): \WP_REST_Response {
		if ( ! $this->user_can_manage() ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'You do not have permission to perform this action.',
				]
			);
		}
		$data = empty( $ajax_data ) ? $request->get_json_params() : $ajax_data;

		// get the nonce.
		$nonce   = $data['nonce'];
		$options = $data['option'];
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'Invalid nonce.',
				]
			);
		}

		// sanitize the options.
		$option = sanitize_title( $options['option'] );
		$value  = sanitize_text_field( $options['value'] );

		// option should be prefixed with burst_, if not add it.
		if ( strpos( $option, 'burst_' ) !== 0 ) {
			$option = 'burst_' . $option;
		}
		update_option( $option, $value );
		if ( ob_get_length() ) {
			ob_clean();
		}

		return new \WP_REST_Response(
			[
				'status'          => 'success',
				'request_success' => true,
			],
			200
		);
	}

	/**
	 * Save multiple Burst settings fields via REST API
	 */
	public function rest_api_fields_set( \WP_REST_Request $request, array $ajax_data = [] ): \WP_REST_Response {
		if ( ! $this->user_can_manage() ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'You do not have permission to perform this action.',
				]
			);
		}

		// Get and validate data.
		try {
			$data = empty( $ajax_data ) ? $request->get_json_params() : $ajax_data;
			if ( ! isset( $data['nonce'], $data['fields'] ) || ! is_array( $data['fields'] ) ) {
				return new \WP_REST_Response(
					[
						'success' => false,
						'message' => 'Invalid request format.',
					]
				);
			}

			if ( ! $this->verify_nonce( $data['nonce'], 'burst_nonce' ) ) {
				return new \WP_REST_Response(
					[
						'success' => false,
						'message' => 'Invalid noce.',
					]
				);
			}

			if ( empty( $ajax_data ) ) {
				$this->remove_fallback_notice();
			}

			// Get config fields and index them by ID for faster lookup.
			$config_fields = array_column( $this->fields->get( false ), null, 'id' );

			// Get current options.
			$options = get_option( 'burst_options_settings', [] );

			// Handle case where options are stored as JSON string.
			if ( is_string( $options ) ) {
				$decoded = json_decode( $options, true );
				if ( json_last_error() === JSON_ERROR_NONE ) {
					$options = $decoded;
				} else {
					$options = [];
				}
			}

			// Ensure options is an array.
			if ( ! is_array( $options ) ) {
				$options = [];
			}

			// Track which fields were actually updated.
			$updated_fields = [];
			foreach ( $data['fields'] as $field_id => $value ) {

				// Validate field exists in config.
				if ( ! isset( $config_fields[ $field_id ] ) ) {
					continue;
				}

				$config_field = $config_fields[ $field_id ];
				$type         = $this->sanitize_field_type( $config_field['type'] );
				$prev_value   = $options[ $field_id ] ?? false;

				// Allow modification before save.
				// deprecated.
				do_action( 'burst_before_save_option', $field_id, $value, $prev_value, $type );
				// Sanitize the value.
				$sanitized_value = $this->sanitize_field( $value, $type );
				do_action( 'burst_before_save_field', $field_id, $sanitized_value, $prev_value, $type );

				// Allow filtering of sanitized value.
				$sanitized_value = apply_filters(
					'burst_fieldvalue',
					$sanitized_value,
					$field_id,
					$type
				);

				// error log the sanitized value.
				$options[ $field_id ]        = $sanitized_value;
				$updated_fields[ $field_id ] = $sanitized_value;
			}

			// Only save if we have updates.
			if ( ! empty( $updated_fields ) ) {
				$updated = update_option( 'burst_options_settings', $options );

				// Process after-save actions only for updated fields.
				foreach ( $updated_fields as $field_id => $value ) {

					$type       = $config_fields[ $field_id ]['type'];
					$prev_value = $options[ $field_id ] ?? false;
					do_action( 'burst_after_save_field', $field_id, $value, $prev_value, $type );
				}
				do_action( 'burst_after_saved_fields', $updated_fields );
			}

			// Return success response.
			return new \WP_REST_Response(
				[
					'success'         => true,
					'request_success' => true,
					'message'         => ! empty( $updated_fields )
						? __( 'Settings saved successfully', 'burst-statistics' )
						: __( 'No changes were made', 'burst-statistics' ),
				],
				200
			);

		} catch ( \Exception $e ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => $e->getMessage(),
				]
			);
		}
	}

	/**
	 * Get the rest api fields
	 */
	public function rest_api_fields_get( \WP_REST_Request $request ): \WP_REST_Response {

		if ( ! $this->user_can_view() ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'You do not have permission to perform this action.',
				]
			);
		}

		$nonce = $request->get_param( 'nonce' );
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'The provided nonce is not valid.',
				]
			);
		}

		$output = [];
		$fields = $this->fields->get();
		$menu   = $this->menu->get();
		foreach ( $fields as $index => $field ) {
			$fields[ $index ] = $field;
		}

		// remove empty menu items.
		foreach ( $menu as $key => $menu_group ) {
			$menu_group['menu_items'] = $this->drop_empty_menu_items( $menu_group['menu_items'], $fields );
			$menu[ $key ]             = $menu_group;
		}

		$output['fields']          = $fields;
		$output['request_success'] = true;
		$output['progress']        = \Burst\burst_loader()->admin->tasks->get();

		$output = apply_filters( 'burst_rest_api_fields_get', $output );
		if ( ob_get_length() ) {
			ob_clean();
		}

		return new \WP_REST_Response( $output, 200 );
	}

	/**
	 * Get goals for the react dashboard
	 */
	public function rest_api_goals_get( \WP_REST_Request $request ): \WP_REST_Response {
		if ( ! $this->user_can_view() ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'You do not have permission to perform this action.',
				]
			);
		}

		$nonce = $request->get_param( 'nonce' );
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'The provided nonce is not valid.',
				]
			);
		}

		$goal_object = new Goals();
		$goals       = $goal_object->get_goals();

		$goals = apply_filters( 'burst_rest_api_goals_get', $goals );

		$predefined_goals = $goal_object->get_predefined_goals();
		if ( ob_get_length() ) {
			ob_clean();
		}

		return new \WP_REST_Response(
			[
				'request_success' => true,
				'goals'           => $goals,
				'predefinedGoals' => $predefined_goals,
				'goalFields'      => $this->fields->get_goal_fields(),
			],
			200
		);
	}

	/**
	 * Get the rest api fields
	 */
	public function rest_api_goal_fields_get( \WP_REST_Request $request ): \WP_REST_Response {
		if ( ! $this->user_can_manage() ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'You do not have permission to perform this action.',
				]
			);
		}

		$nonce = $request->get_param( 'nonce' );
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'The provided nonce is not valid.',
				]
			);
		}

		$goals = apply_filters( 'burst_rest_api_goals_get', ( new Goals() )->get_goals() );
		if ( ob_get_length() ) {
			ob_clean();
		}

		$response = new \WP_REST_Response(
			[
				'request_success' => true,
				'goals'           => $goals,
			]
		);
		$response->set_status( 200 );

		return $response;
	}


	/**
	 * Save goals via REST API
	 */
	public function rest_api_goals_set( \WP_REST_Request $request, array $ajax_data = [] ): \WP_REST_Response {
		if ( ! $this->user_can_manage() ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'You do not have permission to perform this action.',
				]
			);
		}
		$data  = empty( $ajax_data ) ? $request->get_json_params() : $ajax_data;
		$nonce = $data['nonce'];
		$goals = $data['goals'];
		// get the nonce.
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'The provided nonce is not valid.',
				]
			);
		}

		foreach ( $goals as $index => $goal_data ) {
			$id = (int) $goal_data['id'];
			unset( $goal_data['id'] );

			$goal = new Goal( $id );
			foreach ( $goal_data as $name => $value ) {
				if ( property_exists( $goal, $name ) ) {
					$goal->{$name} = $value;
				}
			}
			$goal->save();

		}
		// ensure bundled script update.
		do_action( 'burst_after_updated_goals' );

		if ( ob_get_length() ) {
			ob_clean();
		}
		$response = new \WP_REST_Response(
			[
				'request_success' => true,
			]
		);
		$response->set_status( 200 );

		return $response;
	}

	/**
	 * Delete a goal via REST API
	 */
	public function rest_api_goals_delete( \WP_REST_Request $request, array $ajax_data = [] ): \WP_REST_Response {
		if ( ! $this->user_can_manage() ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'You do not have permission to perform this action.',
				]
			);
		}
		$data  = empty( $ajax_data ) ? $request->get_json_params() : $ajax_data;
		$nonce = $data['nonce'];
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'The provided nonce is not valid.',
				]
			);
		}
		$id = $data['id'];

		$goal    = new Goal( $id );
		$deleted = $goal->delete();

		// get resulting goals, in case the last one was deleted, and a new one was created.
		// ensure at least one goal.
		$goals = ( new Goals() )->get_goals();

		// ensure bundled js file updates.
		do_action( 'burst_after_updated_goals' );

		// if not null return true.
		$response_data = [
			'deleted'         => $deleted,
			'request_success' => true,
		];
		if ( ob_get_length() ) {
			ob_clean();
		}
		$response = new \WP_REST_Response( $response_data );
		$response->set_status( 200 );

		return $response;
	}

	/**
	 * Add predefined goals through REST API
	 *
	 * @param \WP_REST_Request $request The REST API request object.
	 * @param array            $ajax_data Optional AJAX data to process.
	 * @return \WP_REST_Response The response object or error.
	 */
	public function rest_api_goals_add_predefined( \WP_REST_Request $request, array $ajax_data = [] ): \WP_REST_Response {
		if ( ! $this->user_can_manage() ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'You do not have permission to perform this action.',
				]
			);
		}
		$data  = empty( $ajax_data ) ? $request->get_json_params() : $ajax_data;
		$nonce = $data['nonce'];
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'The provided nonce is not valid.',
				]
			);
		}
		$id = $data['id'];

		$goal    = new Goal();
		$goal_id = $goal->add_predefined( $id );

		if ( ob_get_length() ) {
			ob_clean();
		}

		$goal = [];
		if ( $goal_id > 0 ) {
			$goal = new Goal( $goal_id );
		}

		$response = new \WP_REST_Response(
			[
				'request_success' => true,
				'goal'            => $goal,
			]
		);
		$response->set_status( 200 );
		return $response;
	}

	/**
	 * Add a new goal via REST API
	 *
	 * @param \WP_REST_Request $request The REST API request object.
	 * @param array            $ajax_data Optional AJAX data to process.
	 * @return \WP_REST_Response $response
	 */
	public function rest_api_goals_add( \WP_REST_Request $request, array $ajax_data = [] ): \WP_REST_Response {
		if ( ! $this->user_can_manage() ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'You do not have permission to perform this action.',
				]
			);
		}
		$goal = empty( $ajax_data ) ? $request->get_json_params() : $ajax_data;

		if ( ! $this->verify_nonce( $goal['nonce'], 'burst_nonce' ) ) {
			return new \WP_REST_Response(
				[
					'success' => false,
					'message' => 'The provided nonce is not valid.',
				]
			);
		}

		$goal = new Goal();
		$goal->save();

		// ensure bundled js file updates.
		do_action( 'burst_after_updated_goals' );

		if ( ob_get_length() ) {
			ob_clean();
		}
		$response = new \WP_REST_Response(
			[
				'request_success' => true,
				'goal'            => $goal,
			]
		);
		$response->set_status( 200 );

		return $response;
	}

	/**
	 * Get the menu for the settings page in Burst
	 *
	 * @param \WP_REST_Request $request The REST API request object.
	 * @return array<int, array<string, mixed>> List of field definitions.
	 */
	public function rest_api_menu( \WP_REST_Request $request ): array {
		// Unused parameter, but required by the method signature.
		unset( $request );
		if ( ! $this->user_can_manage() ) {
			return [];
		}
		if ( ob_get_length() ) {
			ob_clean();
		}

		return $this->fields->get();
	}
	/**
	 * Removes menu items that have no associated fields from a nested menu structure.
	 *
	 * @param array<int, array<string, mixed>> $menu_items Array of menu items to filter.
	 * @param array<int, array{menu_id: int}>  $fields Array of fields referencing menu items.
	 * @return array<int, array<string, mixed>> Filtered array of menu items with only those linked to fields.
	 */
	public function drop_empty_menu_items( array $menu_items, array $fields ): array {
		if ( ! $this->user_can_manage() ) {
			return $menu_items;
		}
		$new_menu_items = $menu_items;
		foreach ( $menu_items as $key => $menu_item ) {
			$search_result = in_array( $menu_item['id'], array_column( $fields, 'menu_id' ), true );
			if ( $search_result === false ) {
				unset( $new_menu_items[ $key ] );
				// reset array keys to prevent issues with react.
				$new_menu_items = array_values( $new_menu_items );
			} elseif ( isset( $menu_item['menu_items'] ) ) {
				$new_menu_items[ $key ]['menu_items'] = $this->drop_empty_menu_items( $menu_item['menu_items'], $fields );
			}
		}

		return $new_menu_items;
	}

	/**
	 * Sanitize an ip number
	 */
	public function sanitize_ip_field( string $value ): string {
		if ( ! $this->user_can_manage() ) {
			return '';
		}

		$ips = explode( PHP_EOL, $value );
		// remove whitespace.
		$ips = array_map( 'trim', $ips );
		$ips = array_filter( $ips, static fn( $ip ) => $ip !== '' );
		// remove duplicates.
		$ips = array_unique( $ips );
		// sanitize each ip.
		$ips = array_map( 'sanitize_text_field', $ips );
		return implode( PHP_EOL, $ips );
	}

	/**
	 * Get an array of posts
	 *
	 * @param \WP_REST_Request $request The REST API request object.
	 * @param array             $ajax_data Optional AJAX data to process.
	 * @return \WP_REST_Response|\WP_Error The response object or error.
	 */
    //phpcs:ignore
	public function get_posts( \WP_REST_Request $request, array $ajax_data = [] ) {
		if ( ! $this->user_can_view() ) {
			return new \WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', [ 'status' => 403 ] );
		}

		$max_post_count = 100;
		$data           = empty( $ajax_data ) ? $request->get_params() : $ajax_data;
		$nonce          = $data['nonce'];
		$search         = isset( $data['search'] ) ? $data['search'] : '';

		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', [ 'status' => 400 ] );
		}

		// do full search for string length above 3, but set a cap at 1000.
		if ( strlen( $search ) > 3 ) {
			$max_post_count = 1000;
		}

		$result_array = [];
		$args         = [
			'post_type'   => [ 'post', 'page' ],
			'numberposts' => $max_post_count,
			'order'       => 'DESC',
			'orderby'     => 'meta_value_num',
			'meta_query'  => [
				'key'  => 'burst_total_pageviews_count',
				'type' => 'NUMERIC',
			],
		];
		$posts        = get_posts( $args );
		foreach ( $posts as $post ) {
			$page_url       = get_permalink( $post );
			$result_array[] = [
				'page_url'   => str_replace( site_url(), '', $page_url ),
				'page_id'    => $post->ID,
				'post_title' => $post->post_title,
				'pageviews'  => (int) get_post_meta( $post->ID, 'burst_total_pageviews_count', true ),
			];
		}

		if ( ob_get_length() ) {
			ob_clean();
		}

		return new \WP_REST_Response(
			[
				'request_success' => true,
				'posts'           => $result_array,
				'max_post_count'  => $max_post_count,
			],
			200
		);
	}

	/**
	 * If the track_network_wide option is saved, we update the site_option which is used to handle this behaviour.
	 *
	 * @param string $name The name of the option.
	 * @param mixed  $value The new value of the option.
	 * @param mixed  $prev_value The previous value of the option.
	 * @param string $type The type of the option.
	 */
	// $value and $prev_value are mixed types, only supported as of php 8.
    // phpcs:ignore
	public function update_for_multisite( string $name, $value, $prev_value, string $type ): void {
		if ( $name === 'track_network_wide' ) {
			update_site_option( 'burst_track_network_wide', (bool) $value );
		}
	}
}