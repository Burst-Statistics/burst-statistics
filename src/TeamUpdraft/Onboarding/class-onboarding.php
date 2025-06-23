<?php
namespace Burst\TeamUpdraft\Onboarding;

defined( 'ABSPATH' ) || die();

use Burst\TeamUpdraft\Burst\Burst_Plugin;
use Burst\TeamUpdraft\Installer\Installer;
use Burst\TeamUpdraft\RestResponse\RestResponse;

/**
 * The onboarding class enqueues the react app and handles the REST API requests.
 * A trait is used to add plugin specific functionality.
 * The class itself is as much as possible independent of the plugin, so it can be used in other plugins with only little changes.
 *
 * There are three scenarios where the onboarding is active:
 * - Free plugin: no license activation, and on the finish page, an upsell to premium is shown.
 * - Pro plugin, first time onboarding: license activation is required, and on the finish page, some confirmation of the activation of additional features is shown.
 * - Pro plugin, onboarding already completed in free: only license activation, possibly pro feature configuration, and no plugins installation, no email signup.
 */
class Onboarding {
	use Burst_Plugin;

	private string $version;
	private string $prefix;
	private string $onboarding_path;
	private string $onboarding_url;
	private string $privacy_statement_url;
	private string $caller_slug;
	private string $capability;
	private string $support_url;
	private string $documentation_url;
	private string $upgrade_url;
	private string $mailing_list_endpoint;
	private array $steps;
	private string $page_hook_suffix;
	private string $languages_dir;
	private string $text_domain;

	private bool $is_pro = false;

	/**
	 * Add values and defaults to fields in steps
	 *
	 * @param array $steps array of onboarding steps.
	 * @return array<int, array{
	 *     id: string,
	 *     title: string,
	 *     subtitle?: string,
	 *     button?: array{id: string, label: string},
	 *     fields?: array<int, array<string, mixed>>
	 * }>
	 */
	private function add_fields_data_to_steps( array $steps ): array {
		foreach ( $steps as $step_index => $step ) {
			if ( isset( $step['fields'] ) && is_array( $step['fields'] ) ) {
				foreach ( $step['fields'] as $field_index => $field ) {
					$field = $this->parse_field( $field );
					if ( $field['id'] === 'plugins' ) {
						$field['options'] = $this->get_recommended_plugins();
						$field['value']   = $this->get_recommended_plugins( true );
					}
					// update values and defaults based on plugin specific functions.
					if ( $field['type'] === 'email' ) {
						$field['default'] = wp_get_current_user()->user_email;
						$field['value']   = wp_get_current_user()->user_email;
					}
					$steps[ $step_index ]['fields'][ $field_index ] = $field;
				}
			}
		}

		return $steps;
	}

	/**
	 * Conditionally drop steps
	 *
	 * @param array $steps array of onboarding steps.
	 * @return array<int, array{
	 *      id: string,
	 *      type: string,
	 *      title: string,
	 *      subtitle?: string,
	 *      button?: array{id: string, label: string},
	 *      fields?: array<int, array<string, mixed>>,
	 *      solutions?: array<int, string>,
	 *      bullets?: array<int, string>,
	 *      documentation?: string,
	 *  }>
	 */
	private function conditionally_drop_steps( array $steps ): array {
		$is_pro_with_onboarding_free_completed = $this->is_pro_with_onboarding_free_completed();
		foreach ( $steps as $step_index => $step ) {
			// if this is the pro plugin onboarding,  and user has completed the onboarding in the free plugin, we can skip first_run_only steps.
			$first_run_only = isset( $step['first_run_only'] ) && (bool) $step['first_run_only'];
			if ( $is_pro_with_onboarding_free_completed && $first_run_only ) {
				unset( $steps[ $step_index ] );
				continue;
			}

			if ( $step['id'] === 'license' ) {
				if ( $this->license_is_valid() || ! $this->is_pro ) {
					unset( $steps[ $step_index ] );
					continue;
				}
			}

			if ( $is_pro_with_onboarding_free_completed ) {
				if ( isset( $step['title_upgrade'] ) ) {
					$steps[ $step_index ]['title'] = $step['title_upgrade'];
				}
				if ( isset( $step['subtitle_upgrade'] ) ) {
					$steps[ $step_index ]['subtitle'] = $step['subtitle_upgrade'];
				}
			}
		}
		// reset keys.
		return array_values( $steps );
	}

	/**
	 * Extract the used fields from the onboarding steps, so react can filter the applicable fields.
	 *
	 * @param array $steps array of onboarding steps.
	 * @return array<int, array{
	 *       id: string,
	 *       title: string,
	 *       subtitle?: string,
	 *       button?: array{id: string, label: string},
	 *       fields?: array<int, array<string, mixed>>
	 *   }>
	 */
	private function extract_fields_from_steps( array $steps ): array {
		$fields = [];
		foreach ( $steps as $step ) {
			if ( isset( $step['fields'] ) && is_array( $step['fields'] ) ) {
				foreach ( $step['fields'] as $index => $field ) {
					if ( isset( $field['id'] ) ) {
						$fields[] = $field;
					}
				}
			}
		}
		return $fields;
	}

	/**
	 * Get the fields from a specific step.
	 *
	 * @param string $step The step ID to extract fields from.
	 * @return array<int, array<string, mixed>> List of fields (each field is an assoc array).
	 */
	private function extract_fields_from_step( string $step ): array {
		$step = $this->get_step_by_id( $this->sanitize_step_id( $step ) );
		if ( empty( $step ) ) {
			return [];
		}
		return ! empty( $step['fields'] ) ? $step['fields'] : [];
	}

	/**
	 * Sanitize the step ID to ensure it exists in the steps array.
	 */
	private function sanitize_step_id( string $step_id ): string {
		$steps = $this->get_steps();
		foreach ( $steps as $step ) {
			if ( isset( $step['id'] ) && $step['id'] === $step_id ) {
				return $step_id;
			}
		}
		return '';
	}

	/**
	 * Initialize hooks and filters
	 */
	public function init(): void {
		$this->is_pro                = defined( 'BURST_PRO' );
		$this->onboarding_path       = __DIR__;
		$this->onboarding_url        = plugin_dir_url( __FILE__ );
		$this->prefix                = 'burst';
		$this->mailing_list_endpoint = 'https://mailinglist.burst-statistics.com';
		$this->privacy_statement_url = 'https://burst-statistics.com/legal/privacy-statement/';
		$this->caller_slug           = 'burst-statistics';
		$this->capability            = 'manage_burst_statistics';
		$this->support_url           = $this->is_pro ? 'https://burst-statistics.com/support' : 'https://wordpress.org/support/plugin/burst-statistics/';
		$this->documentation_url     = 'https://burst-statistics.com/docs';
		$this->upgrade_url           = 'https://burst-statistics.com/pricing';
		$this->page_hook_suffix      = 'toplevel_page_burst';
		$this->version               = BURST_VERSION;
		$this->languages_dir         = BURST_PATH . 'languages';
		$this->text_domain           = 'burst-statistics';

		add_action( 'rest_api_init', [ $this, 'register_rest_routes' ] );
		add_action( 'wp_ajax_' . $this->prefix . '_onboarding_rest_api_fallback', [ $this, 'rest_api_fallback' ] );
		add_action( "admin_print_scripts-{$this->page_hook_suffix}", [ $this, 'enqueue_onboarding_scripts' ], 1 );
		add_action( 'admin_footer', [ $this, 'add_root_html' ] );
	}

	/**
	 * Check if the onboarding is active
	 */
	public static function is_onboarding_active( string $prefix ): bool {
		// object prefix not available yet, so we pass it.
		// nonce is checked by the actual functions.
        // phpcs:ignore
		return (bool) get_option( "{$prefix}_start_onboarding" ) || strpos( $_SERVER['REQUEST_URI'], $prefix . '/v1/onboarding/do_action/' ) !== false || strpos( $_SERVER['REQUEST_URI'], $prefix . '_onboarding_rest_api_fallback' ) !== false;
	}

	/**
	 * Add root HTML element for the onboarding app
	 */
	public function add_root_html(): void {
		echo '<div id="burst-onboarding"></div>';
	}
	/**
	 * Register REST API routes
	 */
	public function register_rest_routes(): void {
		register_rest_route(
			$this->prefix . '/v1/onboarding',
			'do_action/(?P<action>[a-z\_\-]+)',
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'handle_rest_request' ],
				'permission_callback' => [ $this, 'has_permission' ],
			]
		);
	}

	/**
	 * Check if user has required capability
	 */
	public function has_permission(): bool {
		return current_user_can( $this->capability );
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
		return $this->handle_onboarding_action( $action, $data );
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

		$response = $this->handle_onboarding_action( $action, $data );
		wp_send_json( $response );
		exit;
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
	 * Get step by id
	 *
	 * @return ?array{
	 *        id: string,
	 *        title: string,
	 *        subtitle?: string,
	 *        button?: array{id: string, label: string},
	 *        fields?: array<int, array<string, mixed>>
	 *    }
	 */
	private function get_step_by_id( string $id ): ?array {
		$steps = $this->get_steps();
		foreach ( $steps as $step ) {
			if ( isset( $step['id'] ) && $step['id'] === $id ) {
				return $step;
			}
		}
		return null;
	}

	/**
	 * Handle onboarding actions
	 *
	 * @param string $action The onboarding action to handle.
	 * @param array  $data   The data associated with the action.
	 */
	private function handle_onboarding_action( string $action, array $data ): \WP_REST_Response {
		$response = $this->response( false );
		switch ( $action ) {
			case 'activate_license':
				$license_data = $this->activate_license( $data );
				$response     = $this->response( $license_data['success'], [], $license_data['message'] );
				break;
			case 'update_settings':
				// Get current step fields, so we only update these fields.
				$step_fields = isset( $data['step'] ) ? $this->extract_fields_from_step( $data['step'] ) : [];
				if ( ! empty( $step_fields ) ) {
					// sanitized in save functions.
					$this->update_step_settings( $step_fields, $data['settings'] );
				}
				$response = $this->response( true );
				break;
			case 'download':
				if ( isset( $data['plugin'] ) ) {
					$installer   = new Installer( $this->caller_slug, $data['plugin'] );
					$success     = $installer->download_plugin();
					$next_action = $success ? 'activate' : 'installed';
					$response    = $this->response( true, [ 'next_action' => $next_action ] );
				}
				break;
			case 'activate':
				if ( isset( $data['plugin'] ) ) {
					$installer = new Installer( $this->caller_slug, $data['plugin'] );
					$success   = $installer->activate_plugin();
					$response  = $this->response( true, [ 'next_action' => 'installed' ] );
				}
				break;

			case 'update_email':
				$step_fields = isset( $data['step'] ) ? $this->extract_fields_from_step( $data['step'] ) : [];
				if ( isset( $data['email'] ) && is_email( $data['email'] ) ) {
					$email = sanitize_email( $data['email'] );
					if ( ! empty( $email ) ) {
						$reporting_email_field_name   = '';
						$mailinglist_email_field_name = '';
						foreach ( $step_fields as $field ) {
							if ( isset( $field['type'] ) && $field['type'] === 'email' ) {
								$reporting_email_field_name = $field['id'] ?? '';
							}
							if ( isset( $field['type'] ) && $field['type'] === 'checkbox' ) {
								$mailinglist_email_field_name = $field['id'] ?? '';
							}
						}

						if ( ! empty( $reporting_email_field_name ) ) {
							$this->update_plugin_option( $reporting_email_field_name, $email );
						}
						if ( ! empty( $mailinglist_email_field_name ) ) {
							$include_tips = isset( $data['tips_tricks'] ) && (bool) $data['tips_tricks'];
							$this->update_plugin_option( 'tips_tricks_mailinglist', $include_tips );
							if ( $include_tips ) {
								$this->signup_for_mailinglist( $email );
							}
						}
					}
					$response = $this->response( true );
				}
				break;
			default:
				$response = $this->response( false, [], __( 'Unknown action', 'burst-statistics' ), 400 );
		}

		return $response;
	}

	/**
	 * Signup for Tips & Tricks
	 */
	private function signup_for_mailinglist( string $email ): void {
		$api_params = [
			'has_premium' => $this->is_pro,
			'email'       => sanitize_email( $email ),
			'domain'      => esc_url_raw( site_url() ),
		];
		wp_remote_post(
			$this->mailing_list_endpoint,
			[
				'timeout'   => 15,
				'sslverify' => true,
				'body'      => $api_params,
			]
		);
	}

	/**
	 * Get onboarding steps
	 *
	 * @return array<int, array{
	 *      id: string,
	 *      type: string,
	 *      title: string,
	 *      subtitle?: string,
	 *      button?: array{id: string, label: string},
	 *      fields?: array<int, array<string, mixed>>,
	 *      solutions?: array<int, string>,
	 *      bullets?: array<int, string>,
	 *      documentation?: string,
	 *  }> The onboarding steps array.
	 */
	public function get_steps(): array {
		if ( ! empty( $this->steps ) ) {
			return $this->steps;
		}
		$steps = require_once $this->onboarding_path . '/config/steps.php';
		// Hook name based on prefix.
        // phpcs:ignore
		$steps       = apply_filters( $this->prefix . '_onboarding_steps', $steps );
		$steps       = $this->add_fields_data_to_steps( $steps );
		$steps       = $this->conditionally_drop_steps( $steps );
		$this->steps = $steps;
		return $this->steps;
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
	private function get_recommended_plugins( bool $keys = false ): array {
		$installer = new Installer( $this->caller_slug );
		$plugins   = $installer->get_plugins( false, 3 );
		if ( $keys ) {
			// just return the slugs as a value, value , value array.
			return array_column( $plugins, 'slug' );
		}
		return $plugins;
	}

    /**
     * Check if the user has completed the onboarding in the free version.
     * At least an hour ago, so we don't drop steps for the curren premium installing user.
     */
    private function is_pro_with_onboarding_free_completed(): bool {
        // if the pro plugin is active, and the free plugin has completed onboarding, we can skip some parts of the onboarding.
        $free_completed_time            = get_option( "{$this->prefix}_onboarding_free_completed" );
        $now                            = time();
        $free_completed_over_1_hour_ago = $free_completed_time && ( $now - $free_completed_time > HOUR_IN_SECONDS );
        return $this->is_pro && $free_completed_over_1_hour_ago;
    }

	/**
	 * Enqueue onboarding scripts and styles
	 */
	public function enqueue_onboarding_scripts(): void {
		// script is loading, so we can remove the onboarding option.
		delete_option( "{$this->prefix}_start_onboarding" );

		$steps      = $this->get_steps();
		$asset_file = include $this->onboarding_path . '/build/index.asset.php';

		wp_set_script_translations( 'teamupdraft_onboarding', $this->text_domain, $this->languages_dir );

		wp_enqueue_script(
			'teamupdraft_onboarding',
			$this->onboarding_url . 'build/index.js',
			$asset_file['dependencies'],
			$asset_file['version'],
			true
		);
		$rtl = is_rtl() ? '-rtl' : '';

		wp_enqueue_style(
			$this->prefix . '_onboarding',
			$this->onboarding_url . "build/index$rtl.css",
			[],
			$asset_file['version']
		);

		wp_localize_script(
			'teamupdraft_onboarding',
			'teamupdraft_onboarding',
			[
				'logo'                  => $this->onboarding_url . 'assets/logos/' . $this->prefix . '.png',
				'prefix'                => $this->prefix,
				'version'               => $this->version,
				'steps'                 => $steps,
				'nonce'                 => wp_create_nonce( $this->prefix . '_nonce' ),
				'fields'                => $this->extract_fields_from_steps( $this->get_steps() ),
				'rest_url'              => get_rest_url(),
				'site_url'              => get_site_url(),
				'support'               => esc_url( $this->support_url ),
				'documentation'         => esc_url( $this->documentation_url ),
				'upgrade'               => esc_url( $this->upgrade_url ),
				'privacy_statement_url' => esc_url( $this->privacy_statement_url ),
				'admin_ajax_url'        => add_query_arg( [ 'action' => $this->prefix . '_onboarding_rest_api_fallback' ], admin_url( 'admin-ajax.php' ) ),
				'is_pro'                => $this->is_pro,
				'network_link'          => network_site_url( 'plugins.php' ),
			]
		);

		// remember if user has completed the onboarding in the free plugin.
		if ( $this->is_pro ) {
			update_option( "{$this->prefix}_onboarding_free_completed", time(), false );
		}
	}
}
