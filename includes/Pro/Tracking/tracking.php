<?php
namespace Burst;

use Burst\Pro\Tracking\Tracking_GeoIp;

if ( ! defined( 'ABSPATH' ) ) {
	return;
}

if ( ! function_exists( '\Burst\burst_pro_before_track_hit' ) && ! function_exists( 'burst_pro_before_track_hit' ) ) {
	/**
	 * Add location data to tracking information
	 *
	 * @param array<string, mixed>      $arr         The tracking data.
	 * @param string                    $hit_type    The type of hit.
	 * @param array<string, mixed>|null $previous_hit Previous hit data, if any.
	 * @return array<string, mixed>
	 */
	function burst_pro_before_track_hit( array $arr, string $hit_type, ?array $previous_hit ): array {
		if ( apply_filters( 'burst_geo_ip_enabled', true ) ) {
			global $wpdb;
			// Get location data from GeoIP.
			if ( empty( $previous_hit ) ) {

				$geo_data = Tracking_GeoIp::get_location_data();

				// If we have geo data.
				// Add country code to tracking data if.
				if ( ! empty( $geo_data['city'] ) ) {
					// Get the city_code - prefer city_code if available, otherwise generate a hash.
					$city_code = ! empty( $geo_data['city_code'] ) ? $geo_data['city_code'] : abs( crc32( $geo_data['city'] . $geo_data['state'] . $geo_data['country_code'] ) ) % 2147483647;

					// Skip 0 as it's reserved for the default empty location, also skip minus integers as they are for countries, without a city.
					if ( $city_code > 0 ) {
						$sql = $wpdb->prepare(
							"INSERT IGNORE INTO {$wpdb->prefix}burst_locations 
                                (`city_code`, `city`, `state_code`, `state`, `country_code`, `continent_code`) 
                            VALUES 
                                (%d, %s, %s, %s, %s, %s)",
							$city_code,
							$geo_data['city'],
							$geo_data['state_code'],
							$geo_data['state'],
							$geo_data['country_code'],
							$geo_data['continent_code']
						);

						$wpdb->query( $sql );
					}

					// Add city_code to tracking data.
					$arr['city_code'] = $city_code;
				} elseif ( ! empty( $geo_data['country_code'] ) ) {
					// If using country database, get the city_code from the lookup table.
					$city_code        = $wpdb->get_var( $wpdb->prepare( "SELECT city_code FROM {$wpdb->prefix}burst_locations WHERE country_code = %s", $geo_data['country_code'] ) );
					$arr['city_code'] = $city_code ?: 0;
				}
			}
		}

		return $arr;
	}

	add_filter( 'burst_before_track_hit', '\Burst\burst_pro_before_track_hit', 10, 3 );
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
