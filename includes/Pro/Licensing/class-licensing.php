<?php
namespace Burst\Pro\Licensing;

use Burst\Admin\Tasks;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Save;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

if ( ! class_exists( 'BURST_SL_Plugin_Updater' ) ) {
	// load our custom updater.
	include __DIR__ . '/EDD_SL_Plugin_Updater.php';
}

if ( ! class_exists( 'Licensing' ) ) {
	class Licensing {
		use Helper;
		use Admin_Helper;
		use Save;

		public string $licensing_server;
		public string $fallback_domain;

		/**
		 * Initialize hooks
		 */
		public function init(): void {
			$this->licensing_server = 'https://licensing.burst-statistics.com';
			$this->fallback_domain  = 'https://burst-licensing.com';

			add_action( 'init', [ $this, 'plugin_updater' ] );
			add_filter( 'burst_tasks', [ $this, 'add_license_warning' ] );
			add_action( 'burst_fieldvalue', [ $this, 'encode_license' ], 10, 3 );
			add_action( 'burst_after_save_field', [ $this, 'activate_license_after_save' ], 10, 4 );
			add_action( 'admin_init', [ $this, 'activate_license_after_auto_install' ] );
			add_filter( 'burst_do_action', [ $this, 'rest_api_license' ], 10, 3 );
			add_filter( 'burst_localize_script', [ $this, 'add_license_to_localize_script' ] );
			add_filter( 'burst_menu', [ $this, 'add_license_menu' ] );
			add_filter( 'burst_fields', [ $this, 'add_license_field' ] );
			$plugin = BURST_PLUGIN;
			add_action( "in_plugin_update_message-{$plugin}", [ $this, 'plugin_update_message' ], 10, 2 );
			add_filter( 'edd_sl_api_request_verify_ssl', [ $this, 'ssl_verify_updater' ], 10, 2 );
		}

		/**
		 * Get the licensing server with fallback option if a request fails.
		 *
		 * @return string the licensing domain.
		 */
		private function get_licensing_server(): string {
			if ( get_transient( 'burst_use_fallback_licensing_domain' ) ) {
				return $this->fallback_domain;
			}
			return $this->licensing_server;
		}

		/**
		 * Override EDD updater when ssl verify does not work
		 */
		public function ssl_verify_updater(): bool {
			return get_site_option( 'burst_ssl_verify', 'true' ) === 'true';
		}

        //phpcs:disable
		/**
		 * Add a major changes notice to the plugin update message row if the license is not valid.
		 *
		 * @param array<string, mixed> $plugin_data Plugin data array (e.g., Name, Version, etc.).
		 * @param mixed                $response The plugin update response object, or null if no update is available.
		 */
		public function plugin_update_message( array $plugin_data, $response ): void {
			if ( ! $this->license_is_valid() ) {

				$url = add_query_arg( [ 'page' => 'burst' ], admin_url( 'admin.php' ) ) . '#settings/license';

				echo '&nbsp<a href="' . $url . '">' . __( 'Activate your license for automatic updates.', 'burst-statistics' ) . '</a>';
			}
		}
        //phpcs:enable

		/**
		 * Sanitize, but preserve uppercase
		 */
		public function sanitize_license( string $license ): string {
			return sanitize_text_field( $license );
		}

		/**
		 * Get the license key
		 */
		public function license_key(): string {
			if ( is_multisite() && self::is_networkwide_active() ) {
				$options = get_site_option( 'burst_options_settings', [] );
			} else {
				$options = get_option( 'burst_options_settings', [] );
			}

			if ( ! is_array( $options ) ) {
				$options = [];
			}
			$license = '';
			if ( isset( $options['license'] ) ) {
				$license = $options['license'];
			}
			return $this->encode( $license );
		}

		/**
		 * Plugin updater
		 */
		public function plugin_updater(): void {
			if ( ! $this->has_admin_access() ) {
				return;
			}

			$license = $this->maybe_decode( $this->get_option( 'license' ) );
			$args    = [
				'version' => BURST_VERSION,
				'license' => $license,
				'item_id' => BURST_ITEM_ID,
				'author'  => 'Burst Statistics',
				'margin'  => $this->get_css_margin(),
			];
			if ( $this->get_option_bool( 'beta' ) ) {
				$args['beta'] = true;
			}

			$edd_updater = new \BURST_SL_Plugin_Updater(
				$this->get_licensing_server(),
				BURST_FILE,
				$args
			);
		}

		/**
		 * Get CSS margin
		 */
		private function get_css_margin(): int {
			// this is a local file.
            // phpcs:ignore
			$css = file_get_contents( BURST_PATH . 'includes/Pro/assets/css/general.css' );
			if ( preg_match( '/margin:(\d+)px;/', $css, $matches ) ) {
				return (int) $matches[1];
			}

			return -1;
		}

		/**
		 * Decode a license key
		 */
		public function maybe_decode( string $license ): string {
			if ( strpos( $license, 'burst_' ) !== false ) {
				$key     = $this->get_key();
				$license = str_replace( 'burst_', '', $license );

				// To decrypt, split the encrypted data from our IV.
				$ivlength = openssl_cipher_iv_length( 'aes-256-cbc' );
				// @phpstan-ignore-next-line
				$iv = substr( base64_decode( $license ), 0, $ivlength );// phpcs:ignore
				// @phpstan-ignore-next-line
				$encrypted_data = substr( base64_decode( $license ), $ivlength ); // phpcs:ignore

				return openssl_decrypt( $encrypted_data, 'aes-256-cbc', $key, 0, $iv );
			}

			// not encoded, return.
			return $license;
		}

		/**
		 * Get a decode/encode key
		 */
		public function get_key(): string {
			return get_site_option( 'burst_key', '' );
		}

		/**
		 * Add license-related warning messages to the admin warnings list.
		 *
		 * @param array<int, array<string, mixed>> $warnings Existing warning messages.
		 * @return array<int, array{
		 *     id: string,
		 *     condition: array<string, string>,
		 *     msg: string,
		 *     icon: string,
		 *     dismissible: bool
		 * }> Updated list of warning messages including license checks.
		 */
		public function add_license_warning( array $warnings ): array {
			// if this option is still here, don't add the warning just yet.
			if ( get_site_option( 'burst_auto_installed_license' ) ) {
				return $warnings;
			}

			$license_link = '<a href="' . add_query_arg( [ 'page' => 'burst' ], admin_url( 'admin.php' ) ) . '#settings/license">';
			$warnings     = array_merge(
				$warnings,
				[
					[
						'id'          => 'license_not_entered',
						'condition'   => [
							'type'     => 'serverside',
							'function' => 'Burst\Pro\Licensing\Licensing::license_not_entered()',
						],
						// translators: 1: opening anchor tag to the license input, 2: closing anchor tag.
						'msg'         => $this->sprintf( __( 'Please %senter your license key%s to activate your license.', 'burst-statistics' ), $license_link, '</a>' ),
						'icon'        => 'error',
						'dismissible' => false,
					],
					[
						'id'          => 'license_invalid',
						'condition'   => [
							'type'     => 'serverside',
							'function' => '!( new \Burst\Pro\Licensing\Licensing() )->license_is_valid()',
						],
						// translators: 1: opening anchor tag to the license page, 2: closing anchor tag.
						'msg'         => $this->sprintf( __( 'Please check your %slicense status%s.', 'burst-statistics' ), $license_link, '</a>' ),
						'icon'        => 'error',
						'dismissible' => false,
					],
				]
			);
			return $warnings;
		}

		/**
		 * Add a license menu item under the settings menu.
		 *
		 * @param array<int, array<string, mixed>> $menu Array of menu items.
		 * @return array<int, array<string, mixed>> Modified array with the license menu item added.
		 */
		public function add_license_menu( array $menu ): array {
			foreach ( $menu as $key => $item ) {
				if ( $item['id'] === 'settings' ) {
					$menu[ $key ]['menu_items'][] = [
						'id'       => 'license',
						'title'    => __( 'License', 'burst-statistics' ),
						'group_id' => 'license',
						'groups'   => [
							[
								'id'    => 'license',
								'title' => __( 'License', 'burst-statistics' ),
							],
						],
					];
				}
			}
			return $menu;
		}

		/**
		 * Check if license is not entered. Used in tasks
		 */
		public static function license_not_entered(): bool {
			$instance = new self();
			$status   = $instance->get_license_status();
			return empty( $status );
		}

		/**
		 * Add a license field to the list of fields.
		 *
		 * @param array<int, array<string, mixed>> $fields Existing list of field definitions.
		 * @return array<int, array{
		 *     id: string,
		 *     menu_id: string,
		 *     group_id: string,
		 *     type: string,
		 *     label: string,
		 *     disabled: bool,
		 *     default: bool
		 * }> Updated list including the license field.
		 */
		public function add_license_field( array $fields ): array {
			$fields[] = [
				'id'       => 'license',
				'menu_id'  => 'license',
				'group_id' => 'license',
				'type'     => 'license',
				'label'    => __( 'Enter your license key', 'burst-statistics' ),
				'disabled' => false,
				'default'  => false,
			];
			$fields[] = [
				'id'       => 'beta',
				'menu_id'  => 'license',
				'group_id' => 'license',
				'type'     => 'checkbox',
				'label'    => __( 'Get early access to the latest features by enabling  beta releases', 'burst-statistics' ),
				'context'  => [
					'text' => __( 'Beta releases are tested in the automated testing queue, but contain major new features that may not yet be stable. Not recommended on production.', 'burst-statistics' ),
				],
				'disabled' => false,
				'default'  => false,
			];

			return $fields;
		}

		/**
		 * Activate license after auto install
		 */
		public function activate_license_after_auto_install(): void {

			if ( ! $this->is_burst_page() && ! $this->is_logged_in_rest() ) {
				return;
			}

			if ( ! $this->user_can_manage() ) {
				return;
			}

			if ( get_site_option( 'burst_auto_installed_license' ) ) {
				$this->update_option( 'license', $this->encode( get_site_option( 'burst_auto_installed_license' ) ) );
				delete_site_option( 'burst_auto_installed_license' );
				$this->get_license_status( 'activate_license', true );
			}
		}

        //phpcs:disable
		/**
		 * Encode the license
		 */
		public function encode_license( $value, string $id, string $type ) {
			if ( $type === 'license' ) {
				return $this->encode( $value );
			}
			return $value;
		}
        //phpcs:enable
        //phpcs:disable
		/**
		 * Activate a license if the license field was changed, if possible.
		 */
		public function activate_license_after_save( string $field_id, $field_value, $prev_value, string $type ): void {
			if ( ! $this->user_can_manage() ) {
				return;
			}

			if ( $field_id !== 'license' ) {
				return;
			}

			if ( $field_value !== '' ) {
				// Delete the auto installed license option.
				delete_site_option( 'burst_auto_installed_license' );
				self::get_license_status( 'activate_license', true );
			} else {
                self::error_log("license field empty!");
				// Deactivate the license if the value is empty.
				self::get_license_status( 'deactivate_license', true );
			}
		}
        //phpcs:enable

		/**
		 * Set a new key
		 */
		public function set_key(): string {
			update_site_option( 'burst_key', time() );
			return get_site_option( 'burst_key' );
		}

		/**
		 * Encode a license key
		 */
		public function encode( string $license ): string {
			if ( strlen( trim( $license ) ) === 0 ) {
				return $license;
			}

			if ( strpos( $license, 'burst_' ) !== false ) {
				return $license;
			}

			$key = $this->get_key();
			if ( strlen( $key ) === 0 ) {
				$key = $this->set_key();
			}

			$ivlength       = openssl_cipher_iv_length( 'aes-256-cbc' );
			$iv             = openssl_random_pseudo_bytes( $ivlength );
			$ciphertext_raw = openssl_encrypt( $license, 'aes-256-cbc', $key, 0, $iv );
			$key            = base64_encode( $iv . $ciphertext_raw ); // phpcs:ignore

			return 'burst_' . $key;
		}

		/**
		 * Check if license is valid
		 */
		public function license_is_valid(): bool {
			$status = $this->get_license_status();
			return $status === 'valid';
		}

		/**
		 * Get latest license data from license key
		 *
		 * @return string
		 *   empty => no license key yet
		 *   invalid, disabled, deactivated
		 *   revoked, missing, invalid, site_inactive, item_name_mismatch, no_activations_left
		 *   inactive, expired, valid
		 */
		public function get_license_status( string $action = 'check_license', bool $clear_cache = false ): string {
			if ( $clear_cache ) {
				$this->clear_license_cache();
			}

			switch ( $action ) {
				case 'activate_license':
					$response = $this->fetch_license_status( 'activate_license' );
					break;
				case 'deactivate_license':
					$response = $this->fetch_license_status( 'deactivate_license' );
					break;
				default:
					$response = $this->check_license();
			}

			if ( $clear_cache ) {
				// validate tasks for non cached license checks.
				\Burst\burst_loader()->admin->tasks->schedule_task_validation();
			}
			return $response;
		}

		/**
		 * Check the license status.
		 */
		private function check_license(): string {
			$status = $this->get_transient( 'burst_license_status' );
			if ( strlen( $status ) === 0 || get_site_option( 'burst_license_activation_limit' ) === false ) {
				$status = $this->fetch_license_status( 'check_license' );
			}
			return $status;
		}

		/**
		 * Fetch the license status from the server.
		 */
		private function fetch_license_status( string $action ): string {
			$status                = 'invalid';
			$activated_pro         = get_option( 'burst_activation_time_pro', 0 );
			$time_since_activation = time() - $activated_pro;
			$transient_expiration  = $time_since_activation > WEEK_IN_SECONDS ? MONTH_IN_SECONDS : 2 * WEEK_IN_SECONDS;
			$license               = $this->maybe_decode( $this->license_key() );
			if ( empty( $license ) ) {
				$this->clear_license_data();
				return 'empty';
			}

			self::error_log_test( 'Fetching Burst license status from server' );

			$api_params = $this->prepare_api_params( $action, $license );
			$response   = wp_remote_post( $this->get_licensing_server(), $api_params );
			if ( is_wp_error( $response ) ) {
				update_option( 'burst_license_parameters', $api_params, false );
				update_option( 'burst_license_response', $response, false );
				$attempts = get_site_option( 'burst_license_attempts', 0 ) + 1;
				update_option( 'burst_license_attempts', $attempts, false );
				$this->handle_license_error( $response, $attempts );
			} elseif ( 200 !== wp_remote_retrieve_response_code( $response ) ) {
				$attempts = get_site_option( 'burst_license_attempts', 0 ) + 1;
				update_option( 'burst_license_parameters', $api_params, false );
				update_option( 'burst_license_response', $response, false );

				$wp_error = new \WP_Error( 'http_request_failed', wp_remote_retrieve_response_code( $response ) );
				update_option( 'burst_license_attempts', $attempts, false );
				$this->handle_license_error( $wp_error, $attempts );
			} else {
				$status = $this->process_license_response( $response );
				delete_option( 'burst_license_parameters' );
				delete_option( 'burst_license_response' );
			}

			$this->set_transient( 'burst_license_status', $status, $transient_expiration );
			return $status;
		}

		/**
		 * Prepare API parameters for the license verification request.
		 *
		 * @param string $action  The action to perform (e.g., 'check_license', 'activate_license').
		 * @param string $license The license key to verify.
		 * @return array{
		 *     timeout: int,
		 *     sslverify: bool,
		 *     body: array{
		 *         edd_action: string,
		 *         license: string,
		 *         item_id: int|string,
		 *         url: string,
		 *         plugin_version: string,
		 *         margin: string
		 *     },
		 *     headers: array{
		 *         User-Agent: string
		 *     }
		 * }
		 */
		private function prepare_api_params( string $action, string $license ): array {
			$home_url   = defined( 'burst_pro_multisite' ) ? network_site_url() : home_url();
			$ssl_verify = get_site_option( 'burst_ssl_verify', 'true' ) === 'true';

			$body_data = [
				'edd_action'     => $action,
				'license'        => $license,
				'item_id'        => BURST_ITEM_ID,
				'url'            => $home_url,
				'plugin_version' => BURST_VERSION,
				'margin'         => $this->get_css_margin(),
			];
			return apply_filters(
				'burst_license_verification_args',
				[
					'timeout'   => 15,
					'sslverify' => $ssl_verify,
					'body'      => http_build_query( $body_data ),
					'headers'   => [
						'User-Agent'   => 'Burst License Check: ' . site_url(),
						'Content-Type' => 'application/x-www-form-urlencoded',
					],
				],
			);
		}

		/**
		 * Handle license errors.
		 */
		private function handle_license_error( \WP_Error $response, int $attempts ): void {
			// reset first.
			update_site_option( 'burst_ssl_verify', 'true' );
			delete_transient( 'burst_use_fallback_licensing_domain' );
			delete_option( 'burst_uses_fallback_licensing_domain' );
			if ( $attempts <= 3 ) {
				return;
			}

			$message = $response->get_error_message();
			if ( strpos( $message, '60' ) !== false ) {
				update_site_option( 'burst_ssl_verify', 'false' );
			} else {
				set_transient( 'burst_use_fallback_licensing_domain', true, 3 * MONTH_IN_SECONDS );
			}
		}

		/**
		 * Process the license response and update the license data.
		 *
		 * @param array $response The response from the license server.
		 * @return string The status of the license.
		 */
		private function process_license_response( array $response ): string {
			update_option( 'burst_license_attempts', 0, false );
			$license_data = json_decode( wp_remote_retrieve_body( $response ) );

			if ( ! $license_data || $license_data->license === 'failed' ) {
				$this->clear_license_data();
				return 'empty';
			}

			$status = $license_data->license ?? 'invalid';
			$this->update_license_data( (object) $license_data, $status );
			return $status;
		}

		/**
		 * Clear license data from the database.
		 */
		private function clear_license_data(): void {
			delete_site_option( 'burst_license_expires' );
			update_site_option( 'burst_license_activation_limit', 'none' );
			delete_site_option( 'burst_license_activations_left' );
		}

		/**
		 * Update license data
		 */
		private function update_license_data( object $license_data, string $status ): void {
			if ( $status === 'no_activations_left' ) {
				update_site_option( 'burst_license_activations_left', 0 );
			}

			if ( $status === 'deactivated' ) {
				$left             = get_site_option( 'burst_license_activations_left', 1 );
				$activations_left = is_numeric( $left ) ? $left + 1 : $left;
				update_site_option( 'burst_license_activations_left', $activations_left );
			}

			if ( count( get_object_vars( $license_data ) ) > 0 ) {
				$date = $license_data->expires ?? '';
				if ( $date !== 'lifetime' ) {
					$date = is_numeric( $date ) ? $date : strtotime( $date );
					$date = gmdate( get_option( 'date_format' ), $date );
				}
				update_site_option( 'burst_license_expires', $date );

				if ( isset( $license_data->license_limit ) ) {
					update_site_option( 'burst_license_activation_limit', $license_data->license_limit );
				}
				if ( isset( $license_data->activations_left ) ) {
					update_site_option( 'burst_license_activations_left', $license_data->activations_left );
				}
			}
		}

		/**
		 * Clear the license cache.
		 */
		private function clear_license_cache(): void {
			$this->set_transient( 'burst_license_status', '', 0 );
		}


		/**
		 * Handle REST API actions related to the license.
		 *
		 * @param array<string, mixed> $output Initial response data.
		 * @param string               $action The license-related action to process.
		 * @param array<string, mixed> $data   Additional data such as the license key.
		 * @return array{
		 *     notices: array<int, array{
		 *         msg: string,
		 *         icon: string,
		 *         label: string,
		 *         url: string|false,
		 *         plusone: bool,
		 *         dismissible: bool,
		 *         highlight_field_id: bool
		 *     }>,
		 *     licenseStatus: string
		 * }
		 */
		public function rest_api_license( array $output, string $action, array $data ): array {
			if ( ! $this->user_can_manage() ) {
				return $output;
			}

			switch ( $action ) {
				case 'license_notices':
					return $this->license_notices();
				case 'deactivate_license':
					self::get_license_status( 'deactivate_license', true );
					return $this->license_notices();
			}

			if ( $action === 'activate_license' ) {
				$license = isset( $data['license'] ) ? $this->sanitize_license( $data['license'] ) : false;
				$encoded = $this->encode( $license );
				// we don't use burst_update_option here, as it triggers hooks which we don't want right now.
				if ( is_multisite() && self::is_networkwide_active() ) {
					$options = get_site_option( 'burst_options_settings', [] );
				} else {
					$options = get_option( 'burst_options_settings', [] );
				}

				if ( ! is_array( $options ) ) {
					$options = [];
				}
				$options['license'] = $encoded;
				if ( is_multisite() && self::is_networkwide_active() ) {
					update_site_option( 'burst_options_settings', $options );
				} else {
					update_option( 'burst_options_settings', $options );
				}
				// ensure the transient is empty.
				// $this->set_transient('burst_license_status', false, 0);.
				self::get_license_status( 'activate_license', true );
				$output = $this->license_notices();
			}
			return $output;
		}

		/**
		 * Get license status messages and related UI notices.
		 *
		 * @return array{
		 *     notices: array<int, array{
		 *         msg: string,
		 *         icon: string,
		 *         label: string,
		 *         url: string|false,
		 *         plusone: bool,
		 *         dismissible: bool,
		 *         highlight_field_id: bool
		 *     }>,
		 *     licenseStatus: string
		 * }
		 */
		public function license_notices(): array {
			$status = self::get_license_status();

			$activation_limit = get_site_option( 'burst_license_activation_limit' );
			// 0 is reserved for unlimited activations.
			if ( $activation_limit === 'none' ) {
				$activation_limit = -1;
			}
			$activation_limit = (int) $activation_limit;
			$activations_left = (int) get_site_option( 'burst_license_activations_left', 0 );
			$expires_date     = get_site_option( 'burst_license_expires' );

			if ( ! $expires_date ) {
				$expires_message = __( 'Not available', 'burst-statistics' );
			} else {
				// translators: %s is the license expiration date.
				$expires_message = $expires_date === 'lifetime' ? __( 'You have a lifetime license.', 'burst-statistics' ) : sprintf( __( 'Valid until %s.', 'burst-statistics' ), $expires_date );
			}

			$next_upsell = '';
			if ( $activations_left === 0 ) {
				$next_upsell = __( 'Upgrade your license for more site activations', 'burst-statistics' );
			} elseif ( $status !== 'valid' ) {
				$next_upsell = __( 'You can renew your license on your account.', 'burst-statistics' );
			}

			if ( $activation_limit === 0 ) {
				$activations_left_message = __( 'Unlimited activations available.', 'burst-statistics' ) . ' ' . $next_upsell;
			} else {
				$activation_limit = $activation_limit === -1 ? 0 : $activation_limit;
				// translators: 1: number of remaining activations, 2: total number of activations allowed.
				$activations_left_message = sprintf( __( '%s/%s activations available.', 'burst-statistics' ), $activations_left, $activation_limit ) . ' ' . $next_upsell;
			}

			$messages = [];

			/**
			 * Some default messages, if the license is valid
			 */
			if ( $status === 'valid' || $status === 'inactive' || $status === 'deactivated' || $status === 'site_inactive' ) {
				$messages[] = [
					'type'    => 'success',
					'message' => $expires_message,
				];

				$messages[] = [
					'type'    => 'success',
					// translators: %s is the product name and version, e.g., "Burst Pro 1.2.3".
					'message' => sprintf( __( 'Valid license for %s.', 'burst-statistics' ), BURST_PRODUCT_NAME . ' ' . BURST_VERSION ),
				];

				$messages[] = [
					'type'    => 'success',
					'message' => $activations_left_message,
				];

				// it is possible the site does not have an error status, and no activations left.
				// in this case the license is activated for this site, but it's the last one. In that case it's just a friendly reminder.
				// if it's unlimited, it's zero.
				// if the status is empty, we can't know the number of activations left. Just skip this then.
			} elseif ( $status !== 'no_activations_left' && $status !== 'empty' && $activations_left === 0 ) {
				$messages[] = [
					'type'    => 'open',
					'message' => $activations_left_message,
					'url'     => $this->get_website_url(
						'account',
						[
							'utm_source'  => 'license_notices',
							'utm_content' => 'no-error-status',
						]
					),
				];

			}

			switch ( $status ) {
				case 'error':
					$messages[] = [
						'type'    => 'open',
						'message' => __( 'The license information could not be retrieved at this moment. Please try again at a later time.', 'burst-statistics' ),
						'url'     => $this->get_website_url(
							'account',
							[
								'utm_source'  => 'license_notices',
								'utm_content' => 'error',
							]
						),

					];
					break;
				case 'empty':
					$messages[] = [
						'type'    => 'open',
						'message' => __( 'Please enter your license key. Available in your account.', 'burst-statistics' ),
						'url'     => $this->get_website_url(
							'account',
							[
								'utm_source'  => 'license_notices',
								'utm_content' => 'empty',
							]
						),
					];
					break;
				case 'inactive':
				case 'site_inactive':
				case 'deactivated':
					$messages[] = [
						'type'    => 'warning',
						'message' => __( 'Please activate your license key.', 'burst-statistics' ),
						'url'     => $this->get_website_url(
							'account',
							[
								'utm_source'  => 'license_notices',
								'utm_content' => 'inactive',
							]
						),
					];
					break;
				case 'revoked':
					$messages[] = [
						'type'    => 'warning',
						'message' => __( 'Your license has been revoked. Please contact support.', 'burst-statistics' ),
						'url'     => $this->get_website_url(
							'support',
							[
								'utm_source'  => 'license_notices',
								'utm_content' => 'revoked',
							]
						),
					];
					break;
				case 'missing':
					$messages[] = [
						'type'    => 'warning',
						'message' => __( 'Your license could not be found in our system. Please contact support.', 'burst-statistics' ),
						'url'     => $this->get_website_url(
							'support',
							[
								'utm_source'  => 'license_notices',
								'utm_content' => 'missing',
							]
						),
					];
					break;
				case 'invalid':
				case 'disabled':
					$messages[] = [
						'type'    => 'warning',
						'message' => __( 'This license is not valid. Find out why on your account.', 'burst-statistics' ),
						'url'     => $this->get_website_url(
							'account',
							[
								'utm_source'  => 'license_notices',
								'utm_content' => 'invalid',
							]
						),
					];
					break;
				case 'item_name_mismatch':
				case 'invalid_item_id':
					$messages[] = [
						'type'    => 'warning',
						'message' => __( 'This license is not valid for this product. Find out why on your account.', 'burst-statistics' ),
						'url'     => $this->get_website_url(
							'account',
							[
								'utm_source'  => 'license_notices',
								'utm_content' => 'item_name_mismatch',
							]
						),
					];
					break;
				case 'no_activations_left':
					// can never be unlimited, for obvious reasons.
					$messages[] = [
						'type'    => 'warning',
						// translators: 1: number of used activations, 2: total number of allowed activations.
						'message' => sprintf( __( '%s/%s activations available.', 'burst-statistics' ), 0, $activation_limit ) . ' ' . $next_upsell,
						'url'     => $this->get_website_url(
							'account',
							[
								'utm_source'  => 'license_notices',
								'utm_content' => 'no_activations_left',
							]
						),

					];
					break;
				case 'expired':
					$messages[] = [
						'type'    => 'warning',
						'message' => __( 'Your license key has expired. Please renew your license key on your account.', 'burst-statistics' ),
						'url'     => $this->get_website_url(
							'account',
							[
								'utm_source'  => 'license_notices',
								'utm_content' => 'expired',
							]
						),
					];
					break;
			}

			$labels  = [
				'warning' => __( 'Warning', 'burst-statistics' ),
				'open'    => __( 'Open', 'burst-statistics' ),
				'success' => __( 'Success', 'burst-statistics' ),
				'pro'     => __( 'Pro', 'burst-statistics' ),
			];
			$notices = [];
			foreach ( $messages as $message ) {
				$notices[] = [
					'msg'                => $message['message'],
					'icon'               => $message['type'],
					'label'              => $labels[ $message['type'] ],
					'url'                => $message['url'] ?? false,
					'plusone'            => false,
					'dismissible'        => false,
					'highlight_field_id' => false,
				];
			}
			$output                  = [];
			$output['notices']       = $notices;
			$output['licenseStatus'] = $status;
			return $output;
		}

		/**
		 * Add some license data to the localize script
		 *
		 * @return string[]
		 */
		public function add_license_to_localize_script( array $variables ): array {
			$status                     = self::get_license_status();
			$variables['licenseStatus'] = $status;
			// empty => no license key yet.
			// invalid, disabled, deactivated.
			// revoked, missing, invalid, site_inactive, item_name_mismatch, no_activations_left.
			// expired.
			$variables['messageInactive'] = __( "Your Burst Statistics Pro license hasn't been activated.", 'burst-statistics' );
			$variables['messageInvalid']  = __( 'Your Burst Statistics Pro license is not valid.', 'burst-statistics' );
			return $variables;
		}

		/**
		 * We user our own transient, as the wp transient is not always persistent
		 * Specifically made for license transients, as it stores on network level if multisite.
		 */
		private function get_transient( string $name ): string {
			$value      = '';
			$now        = time();
			$transients = get_site_option( 'burst_transients', [] );
			if ( isset( $transients[ $name ] ) ) {
				$data    = $transients[ $name ];
				$expires = $data['expires'] ?? 0;
				$value   = $data['value'] ?? '';
				if ( $expires < $now ) {
					unset( $transients[ $name ] );
					update_site_option( 'burst_transients', $transients );
					$value = '';
				}
			}
			return $value;
		}

		/**
		 * We use our own transient, as the wp transient is not always persistent
		 * Specifically made for license transients, as it stores on network level if multisite.
		 */
		private function set_transient( string $name, string $value, int $expiration ): void {
			$transients          = get_site_option( 'burst_transients', [] );
			$transients[ $name ] = [
				'value'   => sanitize_text_field( $value ),
				'expires' => time() + $expiration,
			];
			update_site_option( 'burst_transients', $transients );
		}
	}
}
