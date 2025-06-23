<?php

namespace Burst\Traits;

use Burst\Admin\App\App;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Trait admin helper
 *
 * @since   3.0
 */
trait Save {

	// use Helper;.
	use Admin_Helper;

    // phpcs:disable
	/**
	 * Update a burst option
	 */
	public function update_option( string $name, $value ): void {

		if ( ! $this->user_can_manage() ) {
			return;
		}

		$config_fields      = ( new App() )->fields->get( false );
		$config_ids         = array_column( $config_fields, 'id' );
		$config_field_index = array_search( $name, $config_ids, true );
		if ( $config_field_index === false ) {
			return;
		}

		$config_field = $config_fields[ $config_field_index ];
		$type         = $config_field['type'] ?? false;
		if ( ! $type ) {
			return;
		}
		$options = get_option( 'burst_options_settings', [] );
		if ( ! is_array( $options ) ) {
			$options = [];
		}
		$prev_value       = $options[ $name ] ?? false;
		$name             = sanitize_text_field( $name );
		$type             = $this->sanitize_field_type( $config_field['type'] );
		$value            = $this->sanitize_field( $value, $type, $name );
		$value            = apply_filters( 'burst_fieldvalue', $value, sanitize_text_field( $name ), $type );
		$options[ $name ] = $value;
		// autoload as this is important for front end as well.
		update_option( 'burst_options_settings', $options, true );
		do_action( 'burst_after_save_field', $name, $value, $prev_value, $type );
	}
    // phpcs:enable

	/**
	 * Sanitize type against list of allowed field types
	 */
	public function sanitize_field_type( string $type ): string {
		$types = [
			'hidden',
			'hidden_string',
			'database',
			'checkbox',
			'radio',
			'text',
			'textarea',
			'number',
			'email',
			'select',
			'ip_blocklist',
			'email_reports',
			'user_role_blocklist',
			'checkbox_group',
			'license',
		];
		if ( in_array( $type, $types, true ) ) {
			return $type;
		}

		return 'checkbox';
	}

    // phpcs:disable
	/**
	 * Sanitize a field
	 */
	public function sanitize_field( $value, string $type, string $id ) {
		if ( ! $this->user_can_manage() ) {
			return false;
		}

		switch ( $type ) {
			case 'checkbox':
			case 'hidden':
			case 'database':
			case 'number':
				return (int) $value;
			case 'multicheckbox':
			case 'checkbox_group':
				if ( ! is_array( $value ) ) {
					$value = [ $value ];
				}

				return array_map( 'sanitize_text_field', $value );
			case 'email':
				return sanitize_email( $value );
			case 'url':
				return esc_url_raw( $value );
			case 'ip_blocklist':
				return $this->sanitize_ip_field( $value );
			case 'email_reports':
				return $this->sanitize_email_reports( $value );
			case 'select':
			case 'text':
			case 'textarea':
			case 'hidden_string':
			default:
				return sanitize_text_field( $value );
		}
	}
    // phpcs:enable
	/**
	 * Sanitize an ip field
	 */
	public function sanitize_ip_field( string $value ): string {
		if ( ! $this->user_can_manage() ) {
			return '';
		}

		$ips = explode( PHP_EOL, $value );
		// remove whitespace.
		$ips = array_map( 'trim', $ips );
		$ips = array_filter(
			$ips,
			function ( $line ) {
				return $line !== '';
			}
		);
		// remove duplicates.
		$ips = array_unique( $ips );
		// sanitize each ip.
		$ips = array_map( 'sanitize_text_field', $ips );
		return implode( PHP_EOL, $ips );
	}

	/**
	 * Sanitize and validate filters for email reports.
	 *
	 * @param array<int, array<string, mixed>> $email_reports Array of raw email report data to sanitize and validate.
	 * @return array<int, array{email?: string, frequency: 'monthly'|'weekly'}> Sanitized and validated list of email reports.
	 */
	public function sanitize_email_reports( array $email_reports ): array {
		// Check if the current user has the capability to manage the settings.
		if ( ! $this->user_can_manage() ) {
			return [];
		}

		$sanitized_email_reports = [];

		foreach ( $email_reports as $report ) {
			// Initialize an array to hold sanitized report.
			$sanitized_report = [];

			// Sanitize the email field.
			if ( isset( $report['email'] ) ) {
				$sanitized_report['email'] = sanitize_email( $report['email'] );
			}

			// Validate and sanitize the frequency field.
			if ( isset( $report['frequency'] ) && in_array( $report['frequency'], [ 'monthly', 'weekly' ], true ) ) {
				$sanitized_report['frequency'] = $report['frequency'];
			} else {
				$sanitized_report['frequency'] = 'monthly';
			}

			// Add the sanitized report to the array.
			$sanitized_email_reports[] = $sanitized_report;
		}
		// maximum of 10 email reports.
		return array_slice( $sanitized_email_reports, 0, 10 );
	}
}
