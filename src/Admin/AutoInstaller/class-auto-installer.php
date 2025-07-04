<?php
namespace Burst\Admin\AutoInstaller;

use Burst\TeamUpdraft\Installer\Installer;
use Burst\TeamUpdraft\RestResponse\RestResponse;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Auto installer
 *
 * @version 2.0
 */
if ( ! class_exists( 'Auto_Installer' ) ) {
	class Auto_Installer {
		private string $api_url           = '';
		private string $slug              = '';
		private string $caller_slug       = '';
		private int $health_check_timeout = 5;
		private string $plugin_name       = '';
		private string $plugin_constant   = '';
		private array $steps;
		private string $prefix;
		private string $dashboard_url;
		private string $instructions;
		private string $account_url;
		private array $allowed_plugins = [
			'burst_pro',
		];
		/**
		 * Class constructor.
		 */
		public function __construct( string $caller_slug ) {
			if ( ! $this->has_permission() ) {
				return;
			}

			$this->caller_slug = sanitize_text_field( $caller_slug );

			// only doing an exists check. nonce verification is done in the methods.
            // phpcs:ignore
            if ( ! isset( $_GET['license'], $_GET['item_id'], $_GET['plugin'] ) || ( isset( $_GET['install_pro'] ) && $_GET['install_pro'] !== 'true' ) ) {
				return;
			}

            // phpcs:ignore
            if ( ! in_array( sanitize_title( $_GET['plugin'] ), $this->allowed_plugins, true ) ) {
				return;
			}

			// Set up hooks.
			$this->init();
		}

		/**
		 * Sanitize the plugin slug.
		 */
		private function sanitize_plugin_key( string $slug ): string {
			$slug = sanitize_title( $slug );
			if ( in_array( $slug, $this->allowed_plugins, true ) ) {
				return $slug;
			}
			return '';
		}

		/**
		 * Sanitize a license key (32-character hexadecimal string).
		 *
		 * @param string $key The input license key.
		 * @return string Sanitized license key, or empty string if invalid.
		 */
		private function sanitize_license_key( string $key ): string {
			$key = strtolower( trim( $key ) );

			if ( preg_match( '/^[a-f0-9]{32}$/', $key ) ) {
				return $key;
			}

			return '';
		}

		/**
		 * Get suggested plugin information
		 */
		private function get_suggested_plugin( string $attr ): string {
			$installer = new Installer( $this->caller_slug );
			$plugins   = $installer->get_plugins( true, 1 );
			$plugin    = $plugins[0] ?? [];

			$plugin['button_text'] = __( 'Install', 'burst-statistics' );
			$plugin['disabled']    = '';

			if ( $plugin['search_url'] === '#' ) {
				$plugin['button_text'] = __( 'Installed', 'burst-statistics' );
				$plugin['disabled']    = 'disabled';
			}

			return $plugin[ $attr ];
		}

		/**
		 * Initialize our hooks
		 *
		 * @uses add_filter()
		 */
		public function init(): void {
			add_action( 'plugins_loaded', [ $this, 'setup_properties' ] );
			add_action( 'admin_init', [ $this, 'load_steps' ] );
			add_action( 'admin_footer', [ $this, 'print_install_modal' ] );
			add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_assets' ] );
			add_action( 'rest_api_init', [ $this, 'register_rest_routes' ] );
			add_action( 'wp_ajax_burst_autoinstaller_rest_api_fallback', [ $this, 'rest_api_fallback' ] );
		}

		/**
		 * Register REST API routes
		 */
		public function register_rest_routes(): void {
			register_rest_route(
				'burst/v1/auto_installer',
				'destination_clear',
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'check_destination_clear' ],
					'permission_callback' => [ $this, 'has_permission' ],
				]
			);
			register_rest_route(
				'burst/v1/auto_installer',
				'activate_license',
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'activate_license' ],
					'permission_callback' => [ $this, 'has_permission' ],
				]
			);

			register_rest_route(
				'burst/v1/auto_installer',
				'package_information',
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'package_information' ],
					'permission_callback' => [ $this, 'has_permission' ],
				]
			);

			register_rest_route(
				'burst/v1/auto_installer',
				'install_plugin',
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'install_plugin' ],
					'permission_callback' => [ $this, 'has_permission' ],
				]
			);

			register_rest_route(
				'burst/v1/auto_installer',
				'activate_plugin',
				[
					'methods'             => 'GET',
					'callback'            => [ $this, 'activate_plugin' ],
					'permission_callback' => [ $this, 'has_permission' ],
				]
			);
		}

		/**
		 * Fallback for the REST API, used to handle requests that are not registered in the REST API.
		 *
		 * This is used to handle requests when the rest api is blocked.
		 */
		public function rest_api_fallback(): void {
			if ( ! $this->has_permission() ) {
				wp_send_json_error( 'Unauthorized', 403 );
			}

			// will be nonce verified on the next line.
            //phpcs:ignore
            $data   = $_GET;
			$nonce = $data['token'] ?? '';
			if ( ! $this->verify_nonce( $nonce ) ) {
				$response          = new RestResponse();
				$response->message = 'Nonce verification failed';
				wp_send_json( $response );
				exit;
			}

			// nonce already checked.
            // phpcs:ignore
			$request_url = isset( $_GET['rest_action'] ) ? sanitize_text_field( wp_unslash( $_GET['rest_action'] ) ) : '';

			$action = '';
			if ( preg_match( '#/burst/v1/auto_installer/([^?&/]+)#', $request_url, $matches ) ) {
				$action = $matches[1];
			}

			if ( empty( $action ) ) {
				wp_send_json_error( 'Invalid request', 400 );
			}

			$possible_actions = [
				'destination_clear',
				'activate_license',
				'package_information',
				'install_plugin',
				'activate_plugin',
			];
			if ( ! in_array( $action, $possible_actions, true ) ) {
				wp_send_json_error( 'Invalid action', 400 );
			}

			$request = new \WP_REST_Request( 'GET', '/burst/v1/auto_installer/' . $action );
			$request->set_query_params( $data );
			switch ( $action ) {
				case 'destination_clear':
					$response = $this->check_destination_clear( $request );
					break;
				case 'activate_license':
					$response = $this->activate_license( $request );
					break;
				case 'package_information':
					$response = $this->package_information( $request );
					break;
				case 'install_plugin':
					$response = $this->install_plugin( $request );
					break;
				case 'activate_plugin':
					$response = $this->activate_plugin( $request );
					break;
				default:
					wp_send_json_error( 'Invalid action', 400 );
			}
			wp_send_json( $response );
		}

		/**
		 * Check if user has required capability
		 */
		public function has_permission(): bool {
			return current_user_can( 'activate_plugins' );
		}

		/**
		 * Set up properties for the upgrade process
		 */
		public function setup_properties(): void {
			// not stored in the database, only used to verify if it is the correct plugin.
            // phpcs:ignore
            $plugin = $this->sanitize_plugin_key( $_GET['plugin'] );
			switch ( $plugin ) {
				case 'burst_pro':
					$this->slug            = 'burst-pro/burst-pro.php';
					$this->plugin_name     = 'Burst Pro';
					$this->plugin_constant = 'BURST_PRO';
					$this->prefix          = 'burst_';
					$this->api_url         = 'https://licensing.burst-statistics.com';
					$this->dashboard_url   = add_query_arg( [ 'page' => 'burst' ], admin_url( 'admin.php' ) );
					$this->account_url     = 'https://burst-statistics.com/account';
					$this->instructions    = 'https://burst-statistics.com/how-to-install-burst-pro';
					break;
			}
		}

		/**
		 * Load the steps for the upgrade process
		 */
		public function load_steps(): void {
			$this->steps = [
				[
					'action'  => 'destination_clear',
					'doing'   => __( 'Checking if plugin folder exists...', 'burst-statistics' ),
					'success' => __( 'Able to create destination folder', 'burst-statistics' ),
					'error'   => __( 'Destination folder already exists', 'burst-statistics' ),
					'type'    => 'folder',
				],
				[
					'action'  => 'activate_license',
					'doing'   => __( 'Validating license...', 'burst-statistics' ),
					'success' => __( 'License valid', 'burst-statistics' ),
					'error'   => __( 'License invalid', 'burst-statistics' ),
					'type'    => 'license',
				],
				[
					'action'  => 'package_information',
					'doing'   => __( 'Retrieving package information...', 'burst-statistics' ),
					'success' => __( 'Package information retrieved', 'burst-statistics' ),
					'error'   => __( 'Failed to gather package information', 'burst-statistics' ),
					'type'    => 'package',
				],
				[
					'action'  => 'install_plugin',
					'doing'   => __( 'Installing plugin...', 'burst-statistics' ),
					'success' => __( 'Plugin installed', 'burst-statistics' ),
					'error'   => __( 'Failed to install plugin', 'burst-statistics' ),
					'type'    => 'install',
				],
				[
					'action'  => 'activate_plugin',
					'doing'   => __( 'Activating plugin...', 'burst-statistics' ),
					'success' => __( 'Plugin activated', 'burst-statistics' ),
					'error'   => __( 'Failed to activate plugin', 'burst-statistics' ),
					'type'    => 'activate',
				],
			];
		}

		/**
		 * Enqueue javascript
		 */
		public function enqueue_assets( ?string $hook ): void {
			// no data is processed, only a comparison.
            // phpcs:ignore
            if ( $hook === 'plugins.php' && isset( $_GET['install_pro'] ) ) {
				$file_mtime_css = filemtime( plugin_dir_path( __FILE__ ) . 'styles.min.css' );
				wp_enqueue_style( 'burst-autoinstaller-css', plugin_dir_url( __FILE__ ) . 'styles.min.css', [], $file_mtime_css );

				$file_mtime_script = filemtime( plugin_dir_path( __FILE__ ) . 'scripts.min.js' );
				wp_enqueue_script( 'burst-script', plugin_dir_url( __FILE__ ) . 'scripts.min.js', [ 'wp-api-fetch' ], $file_mtime_script, true );
				wp_localize_script(
					'burst-script',
					'burst_autoinstaller',
					[
						'steps'          => $this->steps,
						'rest_url'       => rest_url(),
						'token'          => wp_create_nonce( 'burst_autoinstaller_nonce' ),
						'finished_title' => __( 'Installation finished', 'burst-statistics' ),
						'admin_ajax_url' => add_query_arg( [ 'action' => 'burst_autoinstaller_rest_api_fallback' ], admin_url( 'admin-ajax.php' ) ),
					]
				);
			}
		}

		/**
		 * Calls the API and, if successful, returns the download_link
		 *
		 * @uses get_bloginfo()
		 * @uses wp_remote_post()
		 * @uses is_wp_error()
		 */
		private function get_download_link( string $license, int $item_id ): string {
			if ( ! $this->has_permission() ) {
				return '';
			}
			global $edd_plugin_url_available;

			// Do a quick status check on this domain if we haven't already checked it.
			// cache key token, not for security.
            // phpcs:ignore
			// nosemgrep
			$store_hash = md5( $this->api_url );
			if ( ! is_array( $edd_plugin_url_available ) || ! isset( $edd_plugin_url_available[ $store_hash ] ) ) {
				$test_url_parts = wp_parse_url( $this->api_url );
				$port           = ! empty( $test_url_parts['port'] ) ? ':' . $test_url_parts['port'] : '';
				$host           = ! empty( $test_url_parts['host'] ) ? $test_url_parts['host'] : '';
				$test_url       = 'https://' . $host . $port;
				$response       = wp_remote_get(
					$test_url,
					[
						'timeout'   => $this->health_check_timeout,
						'sslverify' => true,
					]
				);
                //phpcs:ignore
                $edd_plugin_url_available[ $store_hash ] = is_wp_error( $response ) ? false : true;
			}

			if ( false === $edd_plugin_url_available[ $store_hash ] ) {
				return '';
			}

			if ( $this->api_url === trailingslashit( home_url() ) ) {
				return '';
			}

			$api_params = [
				'edd_action' => 'get_version',
				'license'    => $license,
				'item_id'    => $item_id,
				'url'        => home_url(),
			];
			$request    = wp_remote_post(
				$this->api_url,
				[
					'timeout'   => 15,
					'sslverify' => true,
					'body'      => $api_params,
				]
			);

			if ( ! is_wp_error( $request ) ) {
				$request = json_decode( wp_remote_retrieve_body( $request ) );
			} else {
				return '';
			}

			if ( $request && isset( $request->download_link ) ) {
				return $request->download_link;
			}

			return '';
		}

		/**
		 * Prints a modal with bullets for each step of the install process
		 */
		public function print_install_modal(): void {
			if ( ! $this->has_permission() ) {
				return;
			}

			if ( is_admin() ) {
				$dashboard_url = $this->dashboard_url;
				$plugins_url   = admin_url( 'plugins.php' );
				?>
				<div id="burst-step-template">
					<div class="burst-install-step {step}">
						<div class="burst-step-color">
							<div class="burst-grey burst-bullet"></div>
						</div>
						<div class="burst-step-text">
							<span>{doing}</span>
						</div>
					</div>
				</div>
				<div id="burst-start-button">
					<button class="button-primary burst-start"><?php esc_html_e( 'Start', 'burst-statistics' ); ?></button>
				</div>
				<div id="burst-plugin-suggestion-template">
					<div class="burst-recommended"><?php esc_html_e( 'Recommended by Burst Statistics', 'burst-statistics' ); ?></div>
					<div class="burst-plugin-suggestion">
						<div class="burst-icon"><img alt="suggested plugin icon" src="<?php echo esc_url( $this->get_suggested_plugin( 'icon' ) ); ?>"></div>
						<div class="burst-summary">
							<div class="burst-title"><?php echo esc_html( $this->get_suggested_plugin( 'title' ) ); ?></div>
							<div class="burst-description_short"><?php echo esc_html( $this->get_suggested_plugin( 'description' ) ); ?></div>
							<div class="burst-rating">
								<?php
								$installer   = new Installer( $this->caller_slug );
								$slug        = $this->get_suggested_plugin( 'slug' );
								$rating      = (int) $installer->get_plugin_info( $slug, 'rating' );
								$num_ratings = (int) $installer->get_plugin_info( $slug, 'num_ratings' );

								if ( ! empty( $rating ) ) {
									wp_star_rating(
										[
											'rating' => $rating,
											'type'   => 'percent',
											'number' => $num_ratings > 0 ? $num_ratings : 1,
										]
									);
								}
								?>
							</div>
						</div>
						<div class="burst-install-button"><a class="button-secondary" <?php echo esc_attr( $this->get_suggested_plugin( 'disabled' ) ); ?> href="<?php echo esc_url( $this->get_suggested_plugin( 'search_url' ) ); ?>"><?php echo esc_html( $this->get_suggested_plugin( 'button_text' ) ); ?></a></div>
					</div>
				</div>
				<div class="burst-modal-transparent-background">
					<div class="burst-install-plugin-modal">
						<?php // translators: 1: Plugin name to be installed. ?>
						<h3 class="burst-initial"><?php printf( esc_html__( 'Ready to install %s!', 'burst-statistics' ), esc_html( $this->plugin_name ) ); ?></h3>
						<?php // translators: 1: Plugin name to be installed. ?>
						<h3 class="burst-running" style="display: none"><?php printf( esc_html__( 'Installing %s...', 'burst-statistics' ), esc_html( $this->plugin_name ) ); ?></h3>
						<h3 class="burst-done" style="display: none"><?php esc_html_e( 'Ready!', 'burst-statistics' ); ?></h3>
						<div class="burst-progress-bar-container">
							<div class="burst-progress burst-grey">
								<div class="burst-bar burst-green" style="width:0%"></div>
							</div>
						</div>
						<div class="burst-install-steps">

						</div>
						<div class="burst-footer">
							<a href="<?php echo esc_url( $dashboard_url ); ?>" role="button" class="button-primary burst-hidden burst-btn burst-visit-dashboard">
								<?php esc_html_e( 'Visit Dashboard', 'burst-statistics' ); ?>
							</a>
							<a href="<?php echo esc_url( $plugins_url ); ?>" role="button" class="button-primary burst-red burst-hidden burst-btn burst-cancel">
								<?php esc_html_e( 'Cancel', 'burst-statistics' ); ?>
							</a>
							<div class="burst-error-message burst-folder burst-package burst-install burst-activate burst-hidden">
								<span>
								<?php
								esc_html_e( 'An Error Occurred:', 'burst-statistics' );
								?>
								</span>&nbsp;
								<?php
								// translators: 1: opening anchor tag for manual install link, 2: closing anchor tag.
								printf( esc_html( __( 'Install %sManually%s.', 'burst-statistics' ) ) . '&nbsp;', '<a target="_blank" href="' . esc_url( $this->instructions ) . '">', '</a>' );
								?>
							</div>
							<div class="burst-error-message burst-license burst-hidden"><span>
							<?php
							esc_html_e( 'An Error Occurred:', 'burst-statistics' );
							?>
								</span>&nbsp;
								<?php
								// translators: 1: opening anchor tag to the license page, 2: closing anchor tag.
								printf( esc_html( __( 'Check your %slicense%s.', 'burst-statistics' ) ) . '&nbsp;', '<a target="_blank" href="' . esc_url( $this->account_url ) . '">', '</a>' );
								?>
							</div>
						</div>
					</div>
				</div>
				<?php
			}
		}



		/**
		 * Add some additional sanitizing
		 * https://developer.wordpress.org/news/2023/08/understand-and-use-wordpress-nonces-properly/#verifying-the-nonce
		 */
		public function verify_nonce( string $nonce ): bool {
			return wp_verify_nonce( sanitize_text_field( wp_unslash( $nonce ) ), 'burst_autoinstaller_nonce' );
		}

		/**
		 * Check if the destination folder is clear
		 */
		public function check_destination_clear( \WP_REST_Request $request ): \WP_REST_Response {
			// phpcs error fix.
			unset( $request );
			$error    = false;
			$response = [
				'success' => false,
			];
			$message  = 'Could not install plugin.';

			if ( empty( $this->slug ) ) {
				$error = true;
			}

			// nonce is verified through our wrapper function.
            // phpcs:ignore
            if ( ! isset( $_GET['token'] ) || ! $this->verify_nonce( $_GET['token'] ) ) {
				$error   = true;
				$message = 'Nonce verification failed.';
			}

			global $wp_filesystem;
			if ( ! $wp_filesystem || ! is_a( $wp_filesystem, 'WP_Filesystem_Base' ) ) {
				require_once ABSPATH . 'wp-admin/includes/file.php';
				WP_Filesystem();
			}

			if ( ! $error && ! current_user_can( 'activate_plugins' ) ) {
				$error   = true;
				$message = 'You do not have permission to install plugins!';
			}

			if ( ! $error ) {
				if ( defined( $this->plugin_constant ) ) {
					deactivate_plugins( $this->slug );
				}

				$file = trailingslashit( WP_CONTENT_DIR ) . 'plugins/' . $this->slug;
				if ( $wp_filesystem->is_file( $file ) ) {
					$dir     = dirname( $file );
					$new_dir = $dir . '_' . time();
					set_transient( 'burst_upgrade_dir_' . $this->slug, $new_dir, WEEK_IN_SECONDS );
					$wp_filesystem->move( $dir, $new_dir );
					// prevent uninstalling code by previous plugin.
					wp_delete_file( trailingslashit( $new_dir ) . 'uninstall.php' );
				}
			}

			if ( ! $error && file_exists( $file ) ) {
				$error    = true;
				$response = [
					'success' => false,
					'message' => __( 'Could not rename folder!', 'burst-statistics' ),
				];
			}

			if ( ! $error ) {
				if ( ! file_exists( WP_PLUGIN_DIR . '/' . $this->slug ) ) {
					$response = [
						'success' => true,
					];
				}
			}

			if ( $error ) {
				$response = [
					'success' => false,
					'message' => $message,
				];
			}

			return $this->response( ! $error, $response );
		}

		/**
		 * Standardized response format
		 */
		protected function response( bool $success = false, array $data = [], string $message = '', int $code = 200 ): \WP_REST_Response {
			if ( ob_get_length() ) {
				ob_clean();
			}

			return new \WP_REST_Response(
				[
					'success'         => $success,
					'message'         => $message,
					'data'            => $data,
					// can be used to check if the response in react actually contains this array.
					'request_success' => true,
				],
				$code
			);
		}


		/**
		 * Activate the license for the plugin
		 */
		public function activate_license( \WP_REST_Request $request ): \WP_REST_Response {
			$params  = $request->get_params();
			$nonce   = $params['token'] ?? '';
			$license = $params['license'] ?? '';
			$item_id = $params['item_id'] ?? 0;

			$error    = false;
			$response = [
				'success' => false,
				'message' => '',
			];

			if ( ! $this->has_permission()
				|| empty( $nonce )
				|| empty( $license )
				|| $item_id === 0
			) {
				$error = true;
			}

			// nonce is verified through our wrapper function.
            // phpcs:ignore
            if ( ! $error && $this->verify_nonce( $nonce ) ) {
				$license  = $this->sanitize_license_key( $license );
				$response = $this->validate_license( $license, (int) $item_id );
				update_site_option( $this->prefix . 'auto_installed_license', $license );
			}

			return $this->response( ! $error, $response );
		}


		/**
		 * Validate the license on the websites url at EDD.
		 *
		 * Stores values in database:
		 * - {$this->pro_prefix}license_activations_left
		 * - {$this->pro_prefix}license_expires
		 * - {$this->pro_prefix}license_activation_limit
		 *
		 * @return array{success: bool, message: string}
		 */
		private function validate_license( string $license, int $item_id ): array {
			$message = '';
			$success = false;

			if ( ! current_user_can( 'activate_plugins' ) ) {
				return [
					'success' => $success,
					'message' => $message,
				];
			}

			// data to send in our API request.
			$api_params = [
				'edd_action' => 'activate_license',
				'license'    => $license,
				'item_id'    => $item_id,
				'url'        => home_url(),
			];

			// Call the custom API.
			$response = wp_remote_post(
				$this->api_url,
				[
					'timeout'   => 15,
					'sslverify' => false,
					'body'      => $api_params,
				]
			);

			// make sure the response came back okay.
			if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
				if ( is_wp_error( $response ) ) {
					$message = $response->get_error_message();
				} else {
					$message = __( 'An error occurred, please try again.', 'burst-statistics' );
				}
			} else {
				$license_data = json_decode( wp_remote_retrieve_body( $response ) );
				if ( false === $license_data->success ) {
					switch ( $license_data->error ) {
						case 'expired':
							$message = sprintf(
							// translators: %s is the license expiration date, e.g. "April 30, 2025".
								__( 'Your license key expired on %s.', 'burst-statistics' ),
								date_i18n( get_option( 'date_format' ), strtotime( $license_data->expires ) )
							);
							break;
						case 'disabled':
						case 'revoked':
							$message = __( 'Your license key has been disabled.', 'burst-statistics' );
							break;
						case 'missing':
							$message = __( 'Missing license.', 'burst-statistics' );
							break;
						case 'invalid':
							$message = __( 'Invalid license.', 'burst-statistics' );
							break;
						case 'site_inactive':
							$message = __( 'Your license is not active for this URL.', 'burst-statistics' );
							break;
						case 'item_name_mismatch':
							$message = __( 'This appears to be an invalid license key for this plugin.', 'burst-statistics' );
							break;
						case 'no_activations_left':
							$message = __( 'Your license key has reached its activation limit.', 'burst-statistics' );
							break;
						default:
							$message = __( 'An error occurred, please try again.', 'burst-statistics' );
							break;
					}
					global $wp_filesystem;
					if ( ! $wp_filesystem || ! is_a( $wp_filesystem, 'WP_Filesystem_Base' ) ) {
						require_once ABSPATH . 'wp-admin/includes/file.php';
						WP_Filesystem();
					}

					// in case of failure, rename back to default.
					$new_dir = get_transient( 'burst_upgrade_dir_' . $this->slug );
					if ( $new_dir ) {
						if ( $wp_filesystem->is_file( $new_dir ) ) {
							$default_file = trailingslashit( WP_PLUGIN_DIR ) . $this->slug;
							$default_dir  = dirname( $default_file );
							$wp_filesystem->move( $new_dir, $default_dir );
						}
					}
				} else {
					$success = $license_data->license === 'valid';
				}
			}

			return [
				'success' => $success,
				'message' => $message,
			];
		}


		/**
		 * Do an API request to get the download link where to download the pro package
		 */
		public function package_information( \WP_REST_Request $request ): \WP_REST_Response {
			$error   = false;
			$params  = $request->get_params();
			$nonce   = $params['token'] ?? '';
			$license = $params['license'] ? $this->sanitize_license_key( $params['license'] ) : '';
			$item_id = $params['item_id'] ? (int) $params['item_id'] : 0;

			if ( ! $this->has_permission()
				|| empty( $nonce )
				|| empty( $license )
				|| $item_id === 0
			) {
				$error = true;
			}

			$download_link = '';

            // phpcs:ignore
            if ( ! $error && $this->verify_nonce( $nonce ) ) {
				$download_link = $this->get_download_link( $license, $item_id );
				if ( empty( $download_link ) ) {
					$error = true;
				}
			}

			$response = [
				'success'       => ! $error,
				'download_link' => $download_link,
			];
			return $this->response( ! $error, $response, '', 200 );
		}


		/**
		 * Download and install the plugin
		 */
		public function install_plugin( \WP_REST_Request $request ): \WP_REST_Response {
			$error         = false;
			$response      = [
				'success' => false,
				'message' => '',
			];
			$params        = $request->get_params();
			$nonce         = $params['token'] ?? '';
			$download_link = $params['download_link'] ?? '';
			$license       = $params['license'] ?? '';
			$item_id       = $params['item_id'] ?? 0;

			if ( ! $this->has_permission()
				|| empty( $nonce )
				|| empty( $download_link )
				|| empty( $license )
				|| $item_id === 0
			) {
				$error = true;
			}

			if ( ! $error && $this->verify_nonce( $nonce ) ) {

				$download_link = esc_url_raw( $download_link );
				require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
				include_once ABSPATH . 'wp-admin/includes/plugin-install.php';
				if ( ! function_exists( 'request_filesystem_credentials' ) ) {
					require_once ABSPATH . 'wp-admin/includes/file.php';
				}

				WP_Filesystem();
				$skin     = new \WP_Ajax_Upgrader_Skin();
				$upgrader = new \Plugin_Upgrader( $skin );
				$result   = $upgrader->install( $download_link );

				if ( $result ) {
					$response = [
						'success' => true,
					];
				} else {
					$message = __( 'An error occurred while installing the plugin.', 'burst-statistics' );
					// Can be wp_error, although PHPStan does not recognize this.
					// @phpstan-ignore-next-line.
					if ( is_wp_error( $result ) ) {
						$message = $result->get_error_message();
					}
					$response = [
						'success' => false,
						'message' => $message,
					];
				}
			}
			return $this->response( ! $error, $response, '', 200 );
		}


		/**
		 * Do an API request to get activate the plugin
		 */
		public function activate_plugin( \WP_REST_Request $request ): \WP_REST_Response {
			$error   = false;
			$params  = $request->get_params();
			$nonce   = $params['token'] ?? '';
			$plugin  = $params['plugin'] ?? '';
			$license = $params['license'] ?? '';
			$item_id = $params['item_id'] ?? 0;

			if ( ! $this->has_permission()
				|| empty( $plugin )
				|| empty( $nonce )
				|| empty( $license )
				|| $item_id === 0
			) {
				$error = true;
			}

			// this  is only needed for testing purposes, as the automated test tests this current branch. So the plugin will already be active.
			if ( ! $error && defined( $this->plugin_constant ) ) {
				$response = [
					'success' => true,
				];
				return $this->response( true, $response, '', 200 );
			}

			if ( ! $error && $this->verify_nonce( $nonce ) && ! empty( $plugin ) ) {
				$networkwide = is_multisite();
				$result      = activate_plugin( $this->slug, '', $networkwide );
				if ( is_wp_error( $result ) ) {
					$error = true;
				}
			}
			$response = [
				'success' => ! $error,
			];
			return $this->response( ! $error, $response, '', 200 );
		}
	}
}