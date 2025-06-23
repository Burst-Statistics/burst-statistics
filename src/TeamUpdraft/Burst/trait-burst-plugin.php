<?php
namespace Burst\TeamUpdraft\Burst;

defined( 'ABSPATH' ) || die();

use Burst\Frontend\Ip\Ip;
use Burst\Pro\Licensing\Licensing;
use Burst\Traits\Save;

/**
 * Burst Plugin Trait
 * This Trait should contain all plugin specific functionality
 */

trait Burst_Plugin {
	use Save;

    //phpcs:disable
	/**
	 * Wrapper for plugin specific option retrieval.
	 */
	public function get_plugin_option( string $id ) {
		return $this->get_option( $id );
	}

	/**
	 * Wrapper for plugin specific option update.
	 */
	public function update_plugin_option( string $id, $value ): void {
		$this->update_option( $id, $this->maybe_transform( $id, $value ) );
	}
    //phpcs:enable

	/**
	 * Update the plugin settings for a specific step. Some settings may need to be transformed.
	 */
	public function update_step_settings( array $step_fields, array $settings ): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}
		foreach ( $step_fields as $field ) {
			foreach ( $settings as $setting ) {
				if ( $setting['id'] === $field['id'] ) {
					$value = $this->maybe_transform( $setting['id'], $setting['value'] );
					$this->update_option( $field['id'], $value );
				}
			}
		}
	}

    //phpcs:disable
	/**
	 * In some cases we need to transform the value before saving it
	 */
	public function maybe_transform( string $id, $value ) {
		if ( $id === 'user_role_blocklist' ) {
			$current_block_list = $this->get_option( $id );
            if ( ! is_array( $current_block_list ) ) {
                $current_block_list = [];
            }
			if ( (bool) $value === true && ! in_array( 'administrator', $current_block_list, true ) ) {
				$current_block_list[] = 'administrator';
				$value                = $current_block_list;
			}
			if ( (bool) $value === false && in_array( 'administrator', $current_block_list, true ) ) {
				// remove administrator from block list.
				$key = array_search( 'administrator', $current_block_list, true );
				if ( $key !== false ) {
					unset( $current_block_list[ $key ] );
				}

				$value = $current_block_list;
			}

            if ( !is_array($value) ) {
                $value = [];
            }
			// remove empty values from the array.
			$value = array_filter(
				$value,
				function ( $item ) {
					return ! empty( $item );
				}
			);
			// reindex the array.
			$value = array_values( $value );
		}

		if ( $id === 'ip_blocklist' && (bool) $value === true ) {
			$current_block_list = $this->get_plugin_option( 'ip_blocklist' );
			$blocked_ips        = preg_split( '/\r\n|\r|\n/', $current_block_list );
			$current_ip         = IP::get_ip_address();
            // check if the current IP is already in the block list.
			foreach ( $blocked_ips as $blocked_ip ) {
				if ( $current_ip === trim( $blocked_ip ) ) {
					return $value;
				}
			}
			$value = $current_block_list . "\n" . $current_ip;
		}

		if ( $id === 'email_reports_mailinglist' ) {
            $value = sanitize_email( $value );
			$current_report_array = $this->get_plugin_option( 'email_reports_mailinglist' );
			$mail_found           = false;
			foreach ( $current_report_array as $mailing_preferences ) {
				if ( $mailing_preferences['email'] === $value ) {
					$mail_found = true;
				}
			}
			if ( ! $mail_found ) {
				$current_report_array[] = [
					'email'     => $value,
					'frequency' => 'weekly',
				];
			}

			$value = $current_report_array;
		}

		return $value;
	}
    //phpcs:enable

	/**
	 * Check if the license for this user is valid.
	 */
	public function license_is_valid(): bool {
		$licensing = new Licensing();
		return $licensing->license_is_valid();
	}

	/**
	 * Activate the license key
	 *
	 * @param array{ license: string, email: string, password: string} $data The license data to activate.
	 * @return array{
	 *      success: bool,
	 *      message: string,
	 * } Result of activation, including success status and message.
	 */
	public function activate_license( array $data ): array {
		$email   = isset( $data['email'] ) ? sanitize_email( $data['email'] ) : false;
		$pw      = isset( $data['password'] ) ? sanitize_text_field( $data['password'] ) : false;
		$license = isset( $data['license'] ) ? sanitize_text_field( $data['license'] ) : false;

		$this->update_option( 'license', $license );
		$licensing           = new Licensing();
		$output              = $licensing->license_notices();
		$response            = [];
		$response['success'] = $output['licenseStatus'] === 'valid';
		$notices             = $output['notices'] ?? [];
		// get the first message.
		$response['message'] = $output['notices'][0]['msg'] ?? '';
		// check if we have a warning notice. This should override the first one.
		foreach ( $notices as $notice ) {
			$response['message'] = $notice['msg'];
			if ( $notice['icon'] === 'warning' ) {
				$response['message'] = $notice['msg'] ?? '';
				break;
			}
		}

		return $response;
	}

	/**
	 * Set some defaults.
	 *
	 * @param array $field The field to parse.
	 * @return array{
	 *     id: string,
	 *     type: string,
	 *     default: mixed,
	 *     label?: string,
	 * }
	 */
	public function parse_field( array $field ): array {
		$field['value'] = $this->get_option( $field['id'] );
		if ( $field['id'] === 'ip_blocklist' ) {
			$field['default'] = IP::get_ip_address();
			// translators: %s is the user's IP address.
			$field['label'] = sprintf( __( 'Exclude your IP (%s) from being tracked', 'burst-statistics' ), $field['default'] );
		}

		if ( $field['id'] === 'user_role_blocklist' ) {
			if ( is_array( $field['value'] ) && in_array( 'administrator', $field['value'], true ) ) {
				$field['default'] = true;
			}
		}

		return $field;
	}
}
