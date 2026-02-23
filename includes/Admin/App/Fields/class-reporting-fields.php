<?php
namespace Burst\Admin\App\Fields;

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
		add_action( 'init', [ $this, 'initialize_fields' ] );
		add_filter( 'burst_fields', [ $this, 'add_reporting_fields' ] );
	}

	/**
	 * Load reporting fields from configuration file if not already loaded.
	 */
	public function initialize_fields(): void {
		if ( empty( $this->fields ) ) {
			$this->fields = require BURST_PATH . 'includes/Admin/App/config/reporting-fields.php';
		}
	}

	/**
	 * Add reporting fields to existing fields.
	 *
	 * @param array $fields Existing fields.
	 * @return array Modified localized settings including reporting fields.
	 */
	public function add_reporting_fields( array $fields ): array {
		$this->initialize_fields();

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

		$this->initialize_fields();

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

			foreach ( [ 'notice', 'pro', 'context' ] as $type ) {
				if ( isset( $field[ $type ]['url'] ) ) {
					$source = 'setting-notice';
					if ( $type === 'pro' ) {
						$source = 'setting-upgrade';
					} elseif ( $type === 'context' ) {
						$source = 'setting-context';
					}
					$fields[ $key ][ $type ]['url'] = $this->get_website_url(
						$field[ $type ]['url'],
						[
							'utm_source'  => $source,
							'utm_content' => $field['id'],
						]
					);
				}
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
}
