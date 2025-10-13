<?php

namespace Burst\Traits;

use Burst\Admin\App\App;
use Burst\Admin\App\Fields\Fields;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Trait admin helper
 *
 * @since   3.0
 */
trait Save {
	use Admin_Helper;
	use Sanitize;

    // phpcs:disable
	/**
	 * Update a burst option
	 */
	public function update_option( string $name, $value ): void {

		if ( ! $this->user_can_manage() ) {
			return;
		}
        $fields = new Fields();
		$config_fields      = $fields->get( false );
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
		$value            = $this->sanitize_field( $value, $type );
		$value            = apply_filters( 'burst_fieldvalue', $value, sanitize_text_field( $name ), $type );
		$options[ $name ] = $value;
		// autoload as this is important for front end as well.
		update_option( 'burst_options_settings', $options, true );
		do_action( 'burst_after_save_field', $name, $value, $prev_value, $type );
	}
    // phpcs:enable
}
