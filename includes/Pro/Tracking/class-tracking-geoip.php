<?php
namespace Burst\Pro\Tracking;

if ( ! defined( 'ABSPATH' ) ) {
	return;
}

require_once BURST_PATH . 'includes/Pro/assets/vendor/autoload.php';

use Burst\Frontend\Ip\Ip;
use Burst\Traits\Helper;
use GeoIp2\Database\Reader;

class Tracking_GeoIp {

	use Helper;

	/**
	 * Get the GeoIP reader instance
	 *
	 * @return \GeoIp2\Database\Reader|null Reader instance or null on failure
	 */
	private static function get_reader(): ?\GeoIp2\Database\Reader {
		// check if file exists in burst folder.
		$file_name = get_option( 'burst_geo_ip_file' );
		if ( ! $file_name || ( ! file_exists( $file_name ) && self::remote_file_exists( $file_name ) === false ) ) {
			self::reset_geo_ip();
			return null;
		}

		$country_code = '';
		if ( ! class_exists( '\GeoIp2\Database\Reader' ) ) {
			return null;
		}

		try {
			return new Reader( $file_name );
		} catch ( \Exception $e ) {
			self::error_log( 'MaxMind Reader error: ' . $e->getMessage() );
			return null;
		}
	}

	/**
	 * Detect the actual database type (city or country) regardless of the option setting
	 *
	 * @return string 'city' or 'country'
	 */
	private static function detect_database_type(): string {
		$file_name = get_option( 'burst_geo_ip_file' );

		// First check the filename itself.
		if ( is_string( $file_name ) && strpos( $file_name, 'City' ) !== false ) {
			return 'city';
		}
		return 'country';
	}

	/**
	 * Reset the geo ip database on a detected error, unless it's currently downloading
	 */
	public static function reset_geo_ip(): void {
		if ( ! get_transient( 'burst_importing' ) ) {
			update_option( 'burst_import_geo_ip_on_activation', true );
			delete_option( 'burst_geo_ip_file' );
			delete_option( 'burst_last_update_geo_ip' );
		}
	}

	/**
	 * Get all location data from the GeoIP database in a single call
	 *
	 * @return array<string, mixed> Location data or false on failure
	 */
	public static function get_location_data(): array {
		// ensure response structure.
		$defaults = [
			'city'            => '',
			'city_code'       => 0,
			'state'           => '',
			'state_code'      => '',
			'country_code'    => '',
			'continent_code'  => '',
			'accuracy_radius' => 0,
		];
		// Get reader.
		$reader = self::get_reader();
		if ( $reader === null ) {
			return $defaults;
		}

		$ip = Ip::get_ip_address();
		if ( empty( $ip ) ) {
			return $defaults;
		}

		// Detect actual database type instead of relying on option.
		$database_type = self::detect_database_type();

		try {
			// Initialize location data array.
			$location_data = [
				'country_code' => '',
			];
			if ( $database_type === 'city' ) {
				$location_data = [
					'city'            => '',
					'city_code'       => 0,
					'state'           => '',
					'state_code'      => '',
					'country_code'    => '',
					'continent_code'  => '',
					'accuracy_radius' => 0,
				];
				// City database has all details.
				$record = $reader->city( $ip );

				$location_data['country_code'] = $record->country->isoCode;
				$location_data['city']         = $record->city->name;
				$location_data['city_code']    = $record->city->geonameId;
				// phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
				$location_data['state'] = $record->mostSpecificSubdivision->name;
				// phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
				$location_data['state_code']      = $record->mostSpecificSubdivision->isoCode;
				$location_data['continent_code']  = $record->continent->code;
				$location_data['accuracy_radius'] = $record->location->accuracyRadius;

				// Additional data available but not currently used:
				// - User type information.
				// - User count information.
				// - Timezone information.

			} else {
				// Country database only has country information.
				$record                        = $reader->country( $ip );
				$location_data['country_code'] = $record->country->isoCode;
			}
			$reader->close();

			return wp_parse_args( $location_data, $defaults );
		} catch ( \Exception $e ) {
			$error_msg = $e->getMessage();
			if ( strpos( $error_msg, ' is not in the databas' ) !== false ) {
				self::error_log( 'Localhost detected. No real ip possible, so responding with filler data.' );
				if ( strpos( $error_msg, '::1' ) ) {
					$defaults = apply_filters(
						'burst_localhost_location_data',
						[
							'city'            => 'Groningen',
							'city_code'       => 2755251,
							'state'           => 'Groningen',
							'state_code'      => 'GR',
							'country_code'    => 'NL',
							'continent_code'  => 'EU',
							'accuracy_radius' => 50,
						]
					);
				} else {
					self::error_log( 'MaxMind error: ' . $error_msg );
				}
				return $defaults;
			} else {
				self::reset_geo_ip();
				self::error_log( 'MaxMind error: ' . $error_msg );
				return $defaults;
			}
		}
	}
}
