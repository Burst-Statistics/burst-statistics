<?php
namespace Burst\TeamUpdraft\Other_Plugins;

defined( 'ABSPATH' ) || die();

use Burst\TeamUpdraft\Installer\Installer;
use Burst\TeamUpdraft\RestResponse\RestResponse;

class Other_Plugins {
	private string $prefix;
	private string $path;
	private string $url;
	private string $caller_slug;
	private string $capability;
	private string $page_hook_suffix;

	/**
	 * Initialize the Other_Plugins class
	 */
	public function init(): void {
		$this->path             = __DIR__;
		$this->url              = plugin_dir_url( __FILE__ );
		$this->prefix           = 'burst';
		$this->caller_slug      = 'burst-statistics';
		$this->capability       = 'install_plugins';
		$this->page_hook_suffix = 'toplevel_page_burst';
		add_action( "admin_print_scripts-{$this->page_hook_suffix}", [ $this, 'enqueue_onboarding_scripts' ], 1 );

		add_action( 'rest_api_init', [ $this, 'register_rest_routes' ] );
		add_action( 'wp_ajax_' . $this->prefix . '_otherplugins_rest_api_fallback', [ $this, 'rest_api_fallback' ] );
	}

	/**
	 * Check if user has required capability
	 */
	public function has_permission(): bool {
		return current_user_can( $this->capability );
	}

	/**
	 * Register REST API routes
	 */
	public function register_rest_routes(): void {
		register_rest_route(
			$this->prefix . '/v1/otherplugins',
			'do_action/(?P<action>[a-z\_\-]+)',
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'handle_rest_request' ],
				'permission_callback' => [ $this, 'has_permission' ],
			]
		);
	}

	/**
	 * Get recommended plugins for onboarding
	 *
	 * @return array<int, array{
	 *      slug: string,
	 *      file: string,
	 *      constant_free: string,
	 *      premium: array{
	 *          type: string,
	 *          value: string
	 *      },
	 *      wordpress_url: string,
	 *      upgrade_url: string,
	 *      title: string
	 *  }>
	 */
	private function get_recommended_plugins(): array {
		$installer = new Installer( $this->caller_slug );
		return $installer->get_plugins( true );
	}

	/**
	 * Handle AJAX fallback requests, when the REST API is not available
	 */
	public function rest_api_fallback(): void {
		if ( ! $this->has_permission() ) {
			wp_send_json_error( 'Unauthorized', 403 );
		}

		$data = json_decode( file_get_contents( 'php://input' ), true );
		$data = $data['data'] ?? [];

		if ( ! wp_verify_nonce( $data['nonce'], $this->prefix . '_nonce' ) ) {
			$response          = new RestResponse();
			$response->message = __( 'Nonce verification failed', 'burst-statistics' );
			wp_send_json( $response );
			exit;
		}

		$action = isset( $data['path'] ) ? sanitize_title( $_POST['path'] ) : '';
		preg_match( '/do_action\/([a-z\_\-]+)$/', $action, $matches );
		if ( isset( $matches[1] ) ) {
			$action = $matches[1];
		}

		$response = $this->handle_plugin_action( $action, $data );
		wp_send_json( $response );
		exit;
	}

	/**
	 * Handle REST API requests
	 */
	public function handle_rest_request( \WP_REST_Request $request ): \WP_REST_Response {
		if ( ! $this->has_permission() ) {
			return $this->response( false, [], __( 'You do not have permission to do this.', 'burst-statistics' ), 403 );
		}

		$action = sanitize_text_field( $request->get_param( 'action' ) );
		$data   = $request->get_json_params();
		if ( ! wp_verify_nonce( $data['nonce'], $this->prefix . '_nonce' ) ) {
			return $this->response( false, [], __( 'Nonce verification failed', 'burst-statistics' ), 403 );
		}

		$response = $this->handle_plugin_action( $action, $data );

		return $response;
	}

	/**
	 * Handle plugin actions like download and activate
	 */
	private function handle_plugin_action( string $action, array $data ): \WP_REST_Response {
		if ( ! $this->has_permission() ) {
			return $this->response( false, [], __( 'You do not have permission to do this.', 'burst-statistics' ), 403 );
		}

		if ( ! wp_verify_nonce( $data['nonce'], $this->prefix . '_nonce' ) ) {
			return $this->response( false, [], __( 'Nonce verification failed', 'burst-statistics' ), 403 );
		}

		switch ( $action ) {
			case 'download':
				if ( isset( $data['plugin'] ) ) {
					$installer   = new Installer( $this->caller_slug, $data['plugin'] );
					$success     = $installer->download_plugin();
					$next_action = $success ? 'activate' : 'installed';
					return $this->response( true, [ 'next_action' => $next_action ] );
				}
				break;
			case 'activate':
				if ( isset( $data['plugin'] ) ) {
					$installer = new Installer( $this->caller_slug, $data['plugin'] );
					$success   = $installer->activate_plugin();
					return $this->response( true, [ 'next_action' => 'installed' ] );
				}
				break;
			default:
				return $this->response( false, [], __( 'Unknown action', 'burst-statistics' ), 400 );
		}

		return $this->response( false, [], __( 'Action could not be completed', 'burst-statistics' ), 500 );
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
	 * Enqueue onboarding scripts and styles
	 */
	public function enqueue_onboarding_scripts(): void {
		$asset_file = include $this->path . '/build/index.asset.php';

		wp_enqueue_script(
			'teamupdraft_otherplugins',
			$this->url . '/build/index.js',
			$asset_file['dependencies'],
			$asset_file['version'],
			true
		);

		$rtl = is_rtl() ? '-rtl' : '';
		wp_enqueue_style(
			'teamupdraft_otherplugins',
			$this->url . "/build/index$rtl.css",
			[],
			$asset_file['version']
		);

		wp_localize_script(
			'teamupdraft_otherplugins',
			'teamupdraft_otherplugins',
			[
				'prefix'         => $this->prefix,
				'plugins'        => $this->get_recommended_plugins(),
				'nonce'          => wp_create_nonce( $this->prefix . '_nonce' ),
				'rest_url'       => get_rest_url(),
				'site_url'       => get_site_url(),
				'admin_ajax_url' => add_query_arg( [ 'action' => $this->prefix . '_otherplugins_rest_api_fallback' ], admin_url( 'admin-ajax.php' ) ),
				'is_pro'         => defined( $this->prefix . '_pro' ),
				'network_link'   => network_site_url( 'plugins.php' ),
			]
		);
	}
}
