<?php
namespace Burst\Admin\App\Fields;

defined( 'ABSPATH' ) || die();
use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Save;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Fields {

	use Helper;
	use Admin_Helper;
	use Save;

	public array $fields;
	public array $goal_fields;

	/**
	 * Get the list of fields.
	 *
	 * @param bool $load_values Whether to load values from the options.
	 * @return array<int, array<string, mixed>> List of field definitions.
	 */
	public function get( bool $load_values = true ): array {
		if ( ! $this->user_can_manage() ) {
			return [];
		}
		if ( empty( $this->fields ) ) {
			$this->fields = require BURST_PATH . 'src/Admin/App/config/fields.php';
		}
		$fields = $this->fields;

		// If the plugin is considered high traffic, summary tables kick in. This can be disabled with this option.
		if ( \Burst\burst_loader()->admin->summary::is_high_traffic() || $this->get_option_bool( 'disable_summary' ) ) {
			$fields[] = [
				'id'       => 'disable_summary',
				'menu_id'  => 'advanced',
				'group_id' => 'tracking',
				'type'     => 'checkbox',
				'label'    => __( 'Disable the usage of summary tables', 'burst-statistics' ),
				'context'  => __( 'Using summary tables speeds up the dashboard on higher traffic environments, but can show small differences from the actual data.', 'burst-statistics' ),
				'disabled' => false,
				'default'  => false,
			];
		}

		if ( is_multisite() && self::is_networkwide_active() && is_main_site() ) {
			$fields[] = [
				'id'       => 'track_network_wide',
				'menu_id'  => 'advanced',
				'group_id' => 'tracking',
				'type'     => 'checkbox',
				'label'    => __( 'Track all hits networkwide, and view them on the dashboard of your main site', 'burst-statistics' ),
				'disabled' => true,
				'pro'      => [
					'url'      => 'pricing/',
					'disabled' => false,
				],
				'default'  => false,
			];
		}

		$fields = apply_filters( 'burst_fields', $fields );
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
							'burst_source'  => $source,
							'burst_content' => $field['id'],
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

		$fields = apply_filters( 'burst_fields_values', $fields );

		return array_values( $fields );
	}

	/**
	 * Get the list of Goal Fields.
	 *
	 * @return array<int|string, array<string, mixed>>
	 */
	public function get_goal_fields(): array {
		if ( empty( $this->goal_fields ) ) {
			$this->goal_fields = require BURST_PATH . 'src/Admin/App/config/goal-fields.php';
		}
		$goals = $this->goal_fields;
		return apply_filters( 'burst_goal_fields', $goals );
	}
}
