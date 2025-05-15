<?php
namespace Burst;

use Burst\Pro\Tracking\Tracking_GeoIp;

if ( ! defined( 'ABSPATH' ) ) {
	return;
}

if ( ! function_exists( '\Burst\burst_pro_before_track_hit' ) && ! function_exists( 'burst_pro_before_track_hit' ) ) {
	/**
	 * Maybe add country code to tracking data
	 *
	 * @return array<string, mixed>
	 */
	function burst_pro_before_track_hit( array $arr ): array {
		if ( apply_filters( 'burst_geo_ip_enabled', true ) ) {
			$country_code = Tracking_GeoIp::get_country_code();
			if ( $country_code !== '' ) {
				$arr['country_code'] = $country_code;
			}
		}

		return $arr;
	}

	add_filter( 'burst_before_track_hit', '\Burst\burst_pro_before_track_hit' );
}

if ( ! function_exists( '\Burst\burst_create_parameters' ) && ! function_exists( 'burst_create_parameters' ) ) {
	/**
	 * Create parameters in {prefix}_burst_parameters
	 */
	function burst_create_parameters( int $statistic_id, array $sanitized_data ): void {
		$parameters = $sanitized_data['parameters'] ?? '';

		if ( $parameters !== '' && $statistic_id > 0 ) {
			global $wpdb;
			// if starts with ? remove it.
			$parameters = ltrim( $parameters, '?' );
			$parameters = explode( '&', $parameters );
			$campaigns  = [];
			foreach ( $parameters as $parameter ) {
				$parameter = explode( '=', $parameter );

				// Check if $parameter[1] is set to avoid the warning.
				$param_key   = $parameter[0];
				$param_value = $parameter[1] ?? '';

				// Strip utm_ or burst_ from parameter name and add it to campaigns.
				if ( in_array(
					$param_key,
					[
						'utm_source',
						'utm_medium',
						'utm_campaign',
						'utm_term',
						'utm_content',
						'burst_source',
						'burst_medium',
						'burst_campaign',
						'burst_term',
						'burst_content',
					],
					true
				) ) {
					$campaigns[ str_replace( [ 'utm_', 'burst_' ], '', $param_key ) ] = $param_value;
				}

				$wpdb->insert(
					$wpdb->prefix . 'burst_parameters',
					[
						'statistic_id' => $statistic_id,
						'parameter'    => $param_key,
						'value'        => $param_value,
					]
				);
			}

			if ( ! empty( $campaigns ) ) {
				// add statistic_id to campaigns.
				$campaigns['statistic_id'] = $statistic_id;
				$wpdb->insert(
					$wpdb->prefix . 'burst_campaigns',
					$campaigns
				);
			}
		}
	}

	add_action( 'burst_after_create_statistic', '\Burst\burst_create_parameters', 10, 2 );
}
