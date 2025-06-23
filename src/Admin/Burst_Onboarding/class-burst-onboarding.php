<?php
namespace Burst\Admin\Burst_Onboarding;

use Burst\Frontend\Ip\Ip;
use Burst\Pro\Licensing\Licensing;
use Burst\TeamUpdraft\Onboarding\Onboarding;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Save;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Burst_Onboarding {
	use Save;
	use Admin_Helper;


	/**
	 * Setup hooks.
	 */
	public function init(): void {
		add_action( 'plugins_loaded', [ $this, 'setup_onboarding' ] );
		add_filter( 'burst_onboarding_field', [ $this, 'parse_field' ], 10, 2 );
		add_filter( 'burst_license_is_valid', [ $this, 'license_is_valid' ], 10, 1 );
		add_filter( 'burst_license_activation', [ $this, 'activate_license' ], 10, 2 );
		add_action( 'burst_onboarding_update_options', [ $this, 'update_step_settings' ], 10, 2 );
		add_action( 'burst_onboarding_update_single_option', [ $this, 'update_plugin_option' ], 10, 2 );
		add_filter( 'burst_onboarding_steps', [ $this, 'load_steps' ] );
	}

	/**
	 * Load the steps for the onboarding process.
	 *
	 * @return array<int, array{
	 * id: string,
	 * type: string,
	 * title: string,
	 * subtitle?: string,
	 * button?: array{id: string, label: string},
	 * fields?: array<int, array<string, mixed>>,
	 * solutions?: array<int, string>,
	 * bullets?: array<int, string>,
	 * documentation?: string,
	 * }> The onboarding steps array
	 */
	public function load_steps( array $steps ): array {
		unset( $steps );
		return include __DIR__ . '/steps.php';
	}

	/**
	 * Initialize the onboarding
	 */
	public function setup_onboarding(): void {
		$onboarding = new Onboarding();
		if ( $onboarding::is_onboarding_active( 'burst', 'burst-statistics' ) ) {

			$onboarding->is_pro                = defined( 'BURST_PRO' );
			$onboarding->prefix                = 'burst';
			$onboarding->mailing_list_endpoint = 'https://mailinglist.burst-statistics.com';
			$onboarding->privacy_statement_url = 'https://burst-statistics.com/legal/privacy-statement/';
			$onboarding->caller_slug           = 'burst-statistics';
			$onboarding->capability            = 'manage_burst_statistics';
			$onboarding->support_url           = $onboarding->is_pro ? 'https://burst-statistics.com/support' : 'https://wordpress.org/support/plugin/burst-statistics/';
			$onboarding->documentation_url     = 'https://burst-statistics.com/docs';
			$onboarding->upgrade_url           = 'https://burst-statistics.com/pricing';
			$onboarding->page_hook_suffix      = 'toplevel_page_burst';
			$onboarding->version               = BURST_VERSION;
			$onboarding->languages_dir         = BURST_PATH . 'languages';
			$onboarding->text_domain           = 'burst-statistics';
			$onboarding->init();
		}
	}

    //phpcs:disable
    /**
     * Wrapper for plugin specific option retrieval.
     */
    public function get_plugin_option( string $id ) {
        //return the option value for the given id.
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
	public function update_step_settings( array $settings, array $step_fields ): void {
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
		if ( ! defined( 'BURST_PRO' ) ) {
			return false;
		}

		$licensing = new Licensing();
		return $licensing->license_is_valid();
	}

	/**
	 * Activate the license key
	 *
	 * @param array                                                    $response The response array.
	 * @param array{ license: string, email: string, password: string} $data The license data to activate.
	 * @return array{
	 *      success: bool,
	 *      message: string,
	 * } Result of activation, including success status and message.
	 */
	public function activate_license( array $response, array $data ): array {
		// here in case email/password activation is required.
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
	 * @param array  $field The field to parse.
	 * @param string $step_id The id of the current step.
	 * @return array{
	 *     id: string,
	 *     type: string,
	 *     default: mixed,
	 *     label?: string,
	 * }
	 */
	public function parse_field( array $field, string $step_id ): array {
		// fix the phpcs warning.
		unset( $step_id );
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
