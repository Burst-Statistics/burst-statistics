<?php
namespace Burst\Admin\App\Fields;

use Burst\Admin\Admin_Options;
use Burst\Admin\DomainTypes\Admin_Option_Category;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Save;

defined( 'ABSPATH' ) || die();

class Reporting_Fields {
	use Helper;
	use Admin_Helper;
	use Save;

	/**
	 * Reporting fields.
	 *
	 * @var array<int, array<string, mixed>>
	 */
	public array $fields;

	/**
	 * Initialize the reporting fields.
	 */
	public function init(): void {
		add_filter( 'burst_fields', [ $this, 'add_reporting_fields' ] );
		add_filter( 'burst_field_value_slack_webhook_url', [ $this, 'get_masked_slack_webhook_url' ], 10, 1 );
		add_filter( 'burst_fieldvalue', [ $this, 'filter_saved_field_value' ], 10, 2 );
		add_filter( 'burst_allowed_field_types', [ $this, 'add_allowed_field_types' ] );
	}

	/**
	 * Add 'slack_webhook' to the list of allowed field types.
	 *
	 * @param array<int, string> $field_types Existing field types.
	 * @return array<int, string> Modified field types.
	 */
	public function add_allowed_field_types( array $field_types ): array {
		$field_types[] = 'slack_webhook';
		return $field_types;
	}

	/**
	 * Add reporting fields to existing fields.
	 *
	 * @param array $fields Existing fields.
	 * @return array Modified localized settings including reporting fields.
	 */
	public function add_reporting_fields( array $fields ): array {
		if ( ! empty( array_filter( $fields, fn( $field ) => ( $field['menu_id'] ?? '' ) === 'reports' ) ) ) {
			return $fields;
		}

		return array_merge( $fields, $this->get() );
	}

	/**
	 * Get the list of reporting fields.
	 *
	 * @param bool $load_values Whether to load values from the options.
	 * @return array<int, array<string, mixed>> List of field definitions.
	 */
	public function get( bool $load_values = true ): array {
		if ( ! $this->user_can_manage() ) {
			return [];
		}

		if ( empty( $this->fields ) ) {
			$this->fields = require BURST_PATH . 'includes/Admin/App/config/reporting-fields.php';
		}

		$fields = $this->fields;

		$fields = apply_filters( 'burst_reporting_fields', $fields );

		foreach ( $fields as $key => $field ) {
			$field = wp_parse_args(
				$field,
				[
					'id'                 => false,
					'visible'            => true,
					'disabled'           => false,
					'new_features_block' => false,
				]
			);

			if ( $load_values ) {
				$value          = burst_get_option( $field['id'], $field['default'] );
				$field['value'] = apply_filters( 'burst_field_value_' . $field['id'], $value, $field );
				$fields[ $key ] = apply_filters( 'burst_field', $field, $field['id'] );
			}

			// parse options.
			if ( isset( $field['options'] ) && is_string( $field['options'] ) && strpos( $field['options'], '()' ) !== false ) {
				$func = str_replace( '()', '', $field['options'] );
				// @phpstan-ignore-next-line
				$fields[ $key ]['options'] = $this->$func();
			}
		}

		$fields = apply_filters( 'burst_reporting_fields_values', $fields );

		return array_values( $fields );
	}

	/**
	 * Return the Slack webhook URL masked for display.
	 *
	 * @param mixed $value Field value.
	 * @return string Masked webhook URL or empty string.
	 */
	public function get_masked_slack_webhook_url( mixed $value = '' ): string {
		$raw_url = (string) Admin_Options::get( Admin_Option_Category::NOTIFICATIONS, 'slack_webhook_url', '' );
		if ( empty( $raw_url ) ) {
			return is_string( $value ) ? $value : '';
		}

		$prefix = 'https://hooks.slack.com/services/';
		if ( str_starts_with( $raw_url, $prefix ) ) {
			return $prefix . '••••••••/••••••••/••••••••••••••••••••••••';
		}

		return '••••••••••••••••••••••••';
	}

	/**
	 * Prevent the Slack webhook URL from being stored in burst_options_settings.
	 *
	 * @param mixed  $value    Sanitized field value.
	 * @param string $field_id Field ID.
	 * @return mixed Filtered value.
	 */
	public function filter_saved_field_value( mixed $value, string $field_id ): mixed {
		if ( 'slack_webhook_url' === $field_id ) {
			return '';
		}
		return $value;
	}
}
