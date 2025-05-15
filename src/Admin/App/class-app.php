<?php
namespace Burst\Admin\App;

use Burst\Admin\App\Fields\Fields;
use Burst\Admin\App\Menu\Menu;
use Burst\Admin\Installer\Installer;
use Burst\Admin\Statistics\Goal_Statistics;
use Burst\Admin\Statistics\Statistics;
use Burst\Admin\Tasks;
use Burst\Frontend\Endpoint;
use Burst\Frontend\Goals\Goal;
use Burst\Frontend\Goals\Goals;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Save;
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

	public Menu $menu;
	public Fields $fields;
	public Tasks $tasks;
	/**
	 * Constructor
	 */
	public function __construct() {
		add_action( 'admin_menu', [ $this, 'add_menu' ] );
		add_action( 'wp_ajax_burst_rest_api_fallback', [ $this, 'rest_api_fallback' ] );
		add_action( 'admin_footer', [ $this, 'fix_duplicate_menu_item' ], 1 );
		add_action( 'burst_after_save_field', [ $this, 'update_for_multisite' ], 10, 4 );
		add_action( 'rest_api_init', [ $this, 'settings_rest_route' ], 8 );
		add_filter( 'burst_localize_script', [ $this, 'extend_localized_settings_for_dashboard' ], 10, 1 );
		$this->menu   = new Menu();
		$this->fields = new Fields();
	}

	/**
	 * Remove the fallback notice if REST API is working again
	 */
	public function remove_fallback_notice(): void {
		if ( get_option( 'burst_ajax_fallback_active' ) !== false ) {
			delete_option( 'burst_ajax_fallback_active' );
			\Burst\burst_loader()->admin->tasks->schedule_task_validation();
		}
	}

	/**
	 * Fix the duplicate menu item
	 */
	public function fix_duplicate_menu_item(): void {
		?>
		<script>
			window.addEventListener("load", () => {
				let burstMain = document.querySelector('li.wp-has-submenu.toplevel_page_burst a.wp-first-item');
				if (burstMain) {
					burstMain.href = '#/';
				}
			});
		</script>

		<?php
		/**
		 * Ensure the items are selected in sync with the burst react menu.
		 */
		if ( isset( $_GET['page'] ) && $_GET['page'] === 'burst' ) {
			?>
			<script>
				/**
				 * Handles URL changes to update the active menu item
				 * Ensures the WordPress admin menu stays in sync with the React app navigation
				 */
				const handleUrlChange = () => {
					try {
						const currentUrl = window.location.href;
						const submenuContainer = document.querySelector('li.wp-has-current-submenu.toplevel_page_burst .wp-submenu');
						
						if (!submenuContainer) {
							console.warn('Burst: Submenu container not found');
							return;
						}
						
						const menuItems = submenuContainer.querySelectorAll('li');
						
						// Reset all menu items.
						menuItems.forEach(item => {
							item.classList.remove('current');
						});
						
						// Find and activate the matching menu item.
						for (const item of menuItems) {
							const link = item.querySelector('a');
							if (!link) continue;
							
							// Get the base URL without additional parameters after the hash.
							const linkUrl = link.href;
							const currentUrlBase = currentUrl.split('#')[0] + (currentUrl.includes('#') ? '#' + currentUrl.split('#')[1].split('?')[0] : '');
							const linkUrlBase = linkUrl.split('#')[0] + (linkUrl.includes('#') ? '#' + linkUrl.split('#')[1].split('?')[0] : '');
							
							// Check for exact URL match (ignoring parameters after the hash).
							if (linkUrlBase === currentUrlBase) {
								item.classList.add('current');
								break; // Exit loop once we've found the match.
							}
						}
					} catch (error) {
						console.error('Burst: Error in handleUrlChange', error);
					}
				};
				
				// Initial call to set the correct active state.
				handleUrlChange();
				
				// Override history methods to detect URL changes.
				const originalPushState = history.pushState;
				history.pushState = function() {
					originalPushState.apply(this, arguments);
					handleUrlChange();
				};
				
				const originalReplaceState = history.replaceState;
				history.replaceState = function() {
					originalReplaceState.apply(this, arguments);
					handleUrlChange();
				};
				
				// Listen for browser back/forward navigation.
				window.addEventListener('popstate', handleUrlChange);
				
				// Optional: Listen for hash changes if using hash-based routing.
				window.addEventListener('hashchange', handleUrlChange);
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

		add_submenu_page(
			'burst',
			__( 'Dashboard', 'burst-statistics' ),
			__( 'Dashboard', 'burst-statistics' ),
			'view_burst_statistics',
			'burst',
			[ $this, 'dashboard' ],
		);

		add_submenu_page(
			'burst',
			__( 'Statistics', 'burst-statistics' ),
			__( 'Statistics', 'burst-statistics' ),
			'view_burst_statistics',
			'burst#/statistics',
			[ $this, 'dashboard' ],
		);

		add_submenu_page(
			'burst',
			__( 'Settings', 'burst-statistics' ),
			__( 'Settings', 'burst-statistics' ),
			'view_burst_statistics',
			'burst#/settings/general',
			[ $this, 'dashboard' ],
		);

		if ( ! defined( 'BURST_PRO' ) ) {
			global $submenu;
			if ( isset( $submenu['burst'] ) ) {
				$class              = 'burst-link-upgrade';
				$highest_index      = count( $submenu['burst'] );
				$submenu['burst'][] = [
					__( 'Upgrade to Pro', 'burst-statistics' ),
					'manage_burst_statistics',
					$this->get_website_url( 'pricing/', [ 'burst_source' => 'plugin-submenu-upgrade' ] ),
				];
				if ( isset( $submenu['burst'][ $highest_index ] ) ) {
					if ( ! isset( $submenu['burst'][ $highest_index ][4] ) ) {
						$submenu['burst'][ $highest_index ][4] = '';
					}
					$submenu['burst'][ $highest_index ][4] .= ' ' . $class;
				}
			}
		}

		add_action( "admin_print_scripts-{$page_hook_suffix}", [ $this, 'plugin_admin_scripts' ], 1 );
	}

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
	 * Add menu and fields to the localized data for the dashboard widget.
	 *
	 * @param array<string, mixed> $data Existing localized data.
	 * @return array<string, mixed> Localized data with added 'menu' and 'fields' keys.
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
		$response = [];
		$error    = $action = $do_action = $data = $data_type = false;
		if ( ! $this->user_can_view() ) {
			$error = true;
		}
		// if the site is using this fallback, we want to show a notice.
		update_option( 'burst_ajax_fallback_active', time(), false );
		if ( isset( $_GET['rest_action'] ) ) {
			$action = sanitize_text_field( $_GET['rest_action'] );
			if ( strpos( $action, 'burst/v1/data/' ) !== false ) {
				$data_type = strtolower( str_replace( 'burst/v1/data/', '', $action ) );
			}
		}

		// get all of the rest of the $_GET parameters so we can forward them in the REST request.
		$get_params = $_GET;
		// remove the rest_action parameter.
		unset( $get_params['rest_action'] );

		// convert get metrics to array if it is a string.
		if ( isset( $get_params['metrics'] ) && is_string( $get_params['metrics'] ) ) {
			$get_params['metrics'] = explode( ',', $get_params['metrics'] );
		}

		// Handle filters - check if it's a string and needs slashes removed.
		if ( isset( $get_params['filters'] ) ) {
			if ( is_string( $get_params['filters'] ) ) {
				// Remove slashes but keep as JSON string for later decoding.
				$get_params['filters'] = stripslashes( $get_params['filters'] );
			}
		}

		$requestData = json_decode( file_get_contents( 'php://input' ), true );
		if ( $requestData ) {
			$action = $requestData['path'] ?? false;

			$action = sanitize_text_field( $action );
			$data   = $requestData['data'] ?? false;
			if ( strpos( $action, 'burst/v1/do_action/' ) !== false ) {
				$do_action = strtolower( str_replace( 'burst/v1/do_action/', '', $action ) );
			}
		}

		$request = new \WP_REST_Request();
		$args    = [ 'type', 'nonce', 'date_start', 'date_end', 'args', 'search', 'filters', 'metrics', 'group_by' ];
		foreach ( $args as $arg ) {
			if ( isset( $get_params[ $arg ] ) ) {
				$request->set_param( $arg, $get_params[ $arg ] );
			}
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
			} elseif ( strpos( $action, '/data/' ) ) {
				$request->set_param( 'type', $data_type );
				$response = $this->get_data( $request );
			} elseif ( $do_action ) {
				$request = new \WP_REST_Request();
				$request->set_param( 'action', $do_action );
				$response = $this->do_action( $request, $data );
			}
		}

		ob_get_clean();
		header( 'Content-Type: application/json' );
		echo json_encode( $response );
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
						<img width="100" src="<?php echo BURST_URL . 'assets/img/burst-logo.svg'; ?>" alt="Logo Burst" class="h-11 w-auto px-5 py-2">
					</div>
					<div class="flex items-center blur-sm animate-pulse">
						<div class="py-6 px-5 border-b-4 border-transparent"><?php _e( 'Dashboard', 'burst-statistics' ); ?></div>
						<div class="py-6 px-5 border-b-4 border-transparent ml-2"><?php _e( 'Statistics', 'burst-statistics' ); ?></div>
						<div class="py-6 px-5 border-b-4 border-transparent ml-2"><?php _e( 'Settings', 'burst-statistics' ); ?></div>
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
	 * @param array|bool       $ajax_data //Optional AJAX data to process.
	 * @return \WP_REST_Response|\WP_Error //The response object or error.
	 */
	public function do_action( \WP_REST_Request $request, $ajax_data = false ) {
		if ( ! $this->user_can_view() ) {
			return new \WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', [ 'status' => 403 ] );
		}
		$action = sanitize_title( $request->get_param( 'action' ) );
		$data   = $ajax_data ?: $request->get_params();
		$nonce  = $data['nonce'];
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', [ 'status' => 400 ] );
		}

		$data = $data['action_data'];
		if ( ! $ajax_data ) {
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
		$action    = sanitize_title( $data['pluginAction'] );
		$installer = new Installer( $slug );
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
		$plugins = [
			[
				'slug'          => 'all-in-one-wp-security-and-firewall',
				'constant_free' => 'AIO_WP_SECURITY_VERSION',
				'constant_pro'  => false,
				'wordpress_url' => 'https://wordpress.org/plugins/all-in-one-wp-security-and-firewall/',
				'upgrade_url'   => 'https://aiosplugin.com/product/all-in-one-wp-security-and-firewall-premium/?src=plugin-burst-other-plugins',
				'title'         => 'All-In-One Security – Simply secure your site',
			],
			[
				'slug'          => 'updraftplus',
				'constant_free' => 'UPDRAFTPLUS_DIR',
				'constant_pro'  => false,
				'wordpress_url' => 'https://wordpress.org/plugins/updraftplus/',
				'upgrade_url'   => 'https://updraftplus.com/shop/updraftplus-premium/?src=plugin-burst-other-plugins',
				'title'         => 'UpdraftPlus - Back-up & migrate your site with ease',
			],
			[
				'slug'          => 'wp-optimize',
				'constant_free' => 'WPO_VERSION',
				'constant_pro'  => false,
				'wordpress_url' => 'https://wordpress.org/plugins/wp-optimize/',
				'upgrade_url'   => 'https://getwpo.com/buy/?src=plugin-burst-other-plugins',
				'title'         => 'WP-Optimize – Easily boost your page speed',
			],
		];

		foreach ( $plugins as $index => $plugin ) {
			$installer = new Installer( $plugin['slug'] );
			// @phpstan-ignore-next-line, constant_pro contain value in the future
			if ( $plugin['constant_pro'] && defined( $plugin['constant_pro'] ) ) {
				$plugins[ $index ]['pluginAction'] = 'installed';
			} elseif ( ! $installer->plugin_is_downloaded() && ! $installer->plugin_is_activated() ) {
				$plugins[ $index ]['pluginAction'] = 'download';
			} elseif ( $installer->plugin_is_downloaded() && ! $installer->plugin_is_activated() ) {
				$plugins[ $index ]['pluginAction'] = 'activate';
				// @phpstan-ignore-next-line, might be true in the future
			} elseif ( $plugin['constant_pro'] ) {
				$plugins[ $index ]['pluginAction'] = 'upgrade-to-pro';
			} else {
				$plugins[ $index ]['pluginAction'] = 'installed';
			}
		}

		if ( ! empty( $slug ) ) {
			foreach ( $plugins as $plugin ) {
				if ( $plugin['slug'] === $slug ) {
					return $plugin;
				}
			}
		}

		return $plugins;
	}

	/**
	 * Get data from the REST API
	 */
	public function get_data( \WP_REST_Request $request ) {
		if ( ! $this->user_can_view() ) {
			return new \WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', [ 'status' => 403 ] );
		}
		$nonce = $request->get_param( 'nonce' );
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', [ 'status' => 400 ] );
		}

		$type = sanitize_title( $request->get_param( 'type' ) );
		// in the database, the UTC time is stored, so we query by the corrected unix time.
		$args = [
			'date_start' => Statistics::convert_date_to_unix( $request->get_param( 'date_start' ) . ' 00:00:00' ),
			// add 00:00:00 to date,.
			'date_end'   => Statistics::convert_date_to_unix( $request->get_param( 'date_end' ) . ' 23:59:59' ),
			// add 23:59:59 to date.
		];

		$available_args = [ 'filters', 'metrics', 'group_by', 'goal_id' ];

		// check for args from $request->get_param( 'filters') etc. and add to $args.
		foreach ( $available_args as $arg ) {
			if ( $request->get_param( $arg ) ) {
				$args[ $arg ] = $request->get_param( $arg );
			}
		}

		$goal_statistics = new Goal_Statistics();
		$args['filters'] = isset( $args['filters'] ) ? \Burst\burst_loader()->admin->statistics->sanitize_filters( (array) json_decode( $args['filters'] ) ) : [];

		switch ( $type ) {
			case 'live-visitors':
				$data = \Burst\burst_loader()->admin->statistics->get_live_visitors_data();
				break;
			case 'today':
				$data = \Burst\burst_loader()->admin->statistics->get_today_data( $args );
				break;
			case 'goals':
				$args['goal_id'] = $args['goal_id'] ?? 0;
				$data            = $goal_statistics->get_goals_data( $args );
				break;
			case 'live-goals':
				$args['goal_id'] = $args['goal_id'] ?? 0;
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
				$data = apply_filters( 'burst_get_data', [], $type, $args, $request );
		}
		if ( ob_get_length() ) {
			ob_clean();
		}

		if ( isset( $data['error'] ) ) {
			return new \WP_Error( 'rest_invalid_data', $data['error'], [ 'status' => 400 ] );
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
	 * Save options through the rest api
	 */
	public function rest_api_options_set( \WP_REST_Request $request, $ajax_data = false ) {
		if ( ! $this->user_can_manage() ) {
			return new \WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', [ 'status' => 403 ] );
		}
		$data = $ajax_data ?: $request->get_json_params();

		// get the nonce.
		$nonce   = $data['nonce'];
		$options = $data['option'];
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', [ 'status' => 400 ] );
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
	 *
	 * @throws \Exception //exception.
	 */
	public function rest_api_fields_set( \WP_REST_Request $request, $ajax_data = false ) {
		// Permission check.
		if ( ! $this->user_can_manage() ) {
			return new \WP_Error(
				'burst_rest_forbidden',
				__( 'You do not have permission to perform this action.', 'burst-statistics' ),
				[ 'status' => 403 ]
			);
		}

		// Get and validate data.
		try {
			$data = $ajax_data ?: $request->get_json_params();

			if ( ! isset( $data['nonce'], $data['fields'] ) || ! is_array( $data['fields'] ) ) {
				throw new \Exception( __( 'Invalid request format', 'burst-statistics' ) );
			}

			if ( ! $this->verify_nonce( $data['nonce'], 'burst_nonce' ) ) {
				throw new \Exception( __( 'Invalid nonce', 'burst-statistics' ) );
			}

			// Clean output buffer for AJAX fallback.
			if ( ! $ajax_data ) {
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
				$sanitized_value = $this->sanitize_field( $value, $type, $field_id );
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
			return new \WP_Error(
				'burst_rest_error',
				$e->getMessage(),
				[ 'status' => 400 ]
			);
		}
	}

	/**
	 * Get the rest api fields
	 */
	public function rest_api_fields_get( \WP_REST_Request $request ) {

		if ( ! $this->user_can_view() ) {
			return new \WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', [ 'status' => 403 ] );
		}

		$nonce = $request->get_param( 'nonce' );
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', [ 'status' => 400 ] );
		}

		$output = [];
		$fields = $this->fields->get();
		$menu   = $this->menu->get();
		foreach ( $fields as $index => $field ) {
			/**
			 * Load data from source
			 */
			if ( isset( $field['data_source'] ) ) {
				$data_source = $field['data_source'];
				if ( is_array( $data_source ) ) {
					$main           = $data_source[0];
					$class          = $data_source[1];
					$function       = $data_source[2];
					$field['value'] = [];
					if ( function_exists( $main ) ) {
						// @phpstan-ignore-next-line
						$field['value'] = $main()->$class->$function();
					}
				} elseif ( function_exists( $field['data_source'] ) ) {
					$func           = $field['data_source'];
					$field['value'] = $func();
				}
			}

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
	public function rest_api_goals_get( \WP_REST_Request $request ) {
		if ( ! $this->user_can_view() ) {
			return new \WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', [ 'status' => 403 ] );
		}

		$nonce = $request->get_param( 'nonce' );
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', [ 'status' => 400 ] );
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
	public function rest_api_goal_fields_get( \WP_REST_Request $request ) {
		if ( ! $this->user_can_manage() ) {
			return new \WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', [ 'status' => 403 ] );
		}

		$nonce = $request->get_param( 'nonce' );
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', [ 'status' => 400 ] );
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
	public function rest_api_goals_set( \WP_REST_Request $request, $ajax_data = false ) {
		if ( ! $this->user_can_manage() ) {
			return new \WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', [ 'status' => 403 ] );
		}
		$data  = $ajax_data ?: $request->get_json_params();
		$nonce = $data['nonce'];
		$goals = $data['goals'];
		// get the nonce.
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', [ 'status' => 400 ] );
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
	public function rest_api_goals_delete( \WP_REST_Request $request, $ajax_data = false ) {
		if ( ! $this->user_can_manage() ) {
			return new \WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', [ 'status' => 403 ] );
		}
		$data  = $ajax_data ?: $request->get_json_params();
		$nonce = $data['nonce'];
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', [ 'status' => 400 ] );
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
	 * @param array|bool       $ajax_data Optional AJAX data to process.
	 * @return \WP_REST_Response|\WP_Error The response object or error.
	 */
	public function rest_api_goals_add_predefined( \WP_REST_Request $request, $ajax_data = false ) {
		if ( ! $this->user_can_manage() ) {
			return new \WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', [ 'status' => 403 ] );
		}
		$data  = $ajax_data ?: $request->get_json_params();
		$nonce = $data['nonce'];
		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', [ 'status' => 400 ] );
		}
		$id = $data['id'];

		$goal    = new Goal();
		$goal_id = $goal->add_predefined( $id );

		if ( ob_get_length() ) {
			ob_clean();
		}

		if ( $goal_id > 0 ) {
			$goal = new Goal( $goal_id );
		} else {
			return new \WP_Error( 'rest_goal_not_added', 'The predefined goal was not added.', [ 'status' => 400 ] );
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
	 * @param array|bool       $ajax_data Optional AJAX data to process.
	 * @return \WP_REST_Response|\WP_Error $response
	 */
	public function rest_api_goals_add( \WP_REST_Request $request, $ajax_data = false ) {
		if ( ! $this->user_can_manage() ) {
			return new \WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', [ 'status' => 403 ] );
		}
		$goal = $ajax_data ?: $request->get_json_params();

		if ( ! $this->verify_nonce( $goal['nonce'], 'burst_nonce' ) ) {
			return new \WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', [ 'status' => 400 ] );
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
	 * @return array<int, array<string, mixed>> | \WP_Error List of field definitions.
	 */
	public function rest_api_menu( \WP_REST_Request $request ) {
		if ( ! $this->user_can_manage() ) {
			return new \WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', [ 'status' => 403 ] );
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
			$searchResult = array_search( $menu_item['id'], array_column( $fields, 'menu_id' ), true );
			if ( $searchResult === false ) {
				unset( $new_menu_items[ $key ] );
				// reset array keys to prevent issues with react.
				$new_menu_items = array_values( $new_menu_items );
			} elseif ( isset( $menu_item['menu_items'] ) ) {
				$updatedValue                         = $this->drop_empty_menu_items( $menu_item['menu_items'], $fields );
				$new_menu_items[ $key ]['menu_items'] = $updatedValue;
			}
		}

		return $new_menu_items;
	}

	/**
	 * Sanitize a field
	 *
	 * @param mixed  $value The value to sanitize.
	 * @param string $type The type of the field.
	 * @param string $id The ID of the field.
	 * @return mixed The sanitized value.
	 */
	public function sanitize_field( $value, string $type, string $id ) {
		if ( ! $this->user_can_manage() ) {
			return false;
		}

		switch ( $type ) {
			case 'checkbox':
			case 'hidden':
			case 'database':
				return (int) $value;
			case 'checkbox_group':
			case 'user_role_blocklist':
				if ( ! is_array( $value ) ) {
					$value = [ $value ];
				}

				return array_map( 'sanitize_text_field', $value );
			case 'email':
				return sanitize_email( $value );
			case 'url':
				return esc_url_raw( $value );
			case 'number':
				return (int) $value;
			case 'ip_blocklist':
				return $this->sanitize_ip_field( $value );
			case 'email_reports':
				return $this->sanitize_email_reports( $value );
			case 'select':
			case 'text':
			case 'textarea':
			default:
				return sanitize_text_field( $value );
		}
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
	 * @param bool             $ajax_data Optional AJAX data to process.
	 * @return \WP_REST_Response|\WP_Error The response object or error.
	 */
    //phpcs:ignore
	public function get_posts( \WP_REST_Request $request, bool $ajax_data = false ) {
		if ( ! $this->user_can_view() ) {
			return new \WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', [ 'status' => 403 ] );
		}

		$max_post_count = 100;
		$data           = $ajax_data ?: $request->get_params();
		$nonce          = $data['nonce'];
		$search         = isset( $data['search'] ) ? $data['search'] : '';

		if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
			return new \WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', [ 'status' => 400 ] );
		}

		// do full search for string length above 3, but set a cap at 1000.
		if ( strlen( $search ) > 3 ) {
			$max_post_count = 1000;
		}

		$resultArray = [];
		$args        = [
			'post_type'   => [ 'post', 'page' ],
			'numberposts' => $max_post_count,
			'order'       => 'DESC',
			'orderby'     => 'meta_value_num',
			'meta_query'  => [
				'key'  => 'burst_total_pageviews_count',
				'type' => 'NUMERIC',
			],
		];
		$posts       = get_posts( $args );
		foreach ( $posts as $post ) {
			$page_url      = get_permalink( $post );
			$resultArray[] = [
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
				'posts'           => $resultArray,
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
	public function update_for_multisite( string $name, $value, $prev_value, string $type ): void {
		if ( $name === 'track_network_wide' ) {
			update_site_option( 'burst_track_network_wide', (bool) $value );
		}
	}
}