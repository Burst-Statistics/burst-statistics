<?php
namespace Burst\Pro\Tracking;

if ( ! defined( 'ABSPATH' ) ) {
	return;
}

require_once BURST_PATH . 'src/Pro/assets/vendor/autoload.php';

use Burst\Frontend\Ip\Ip;
use Burst\Traits\Helper;
use GeoIp2\Database\Reader;

class Tracking_GeoIp {

	use Helper;

	/**
	 * Get country code
	 */
	public static function get_country_code(): string {

		// check if file exists in burst folder.
		$file_name = get_option( 'burst_geo_ip_file' );
		if ( ! file_exists( $file_name ) && ! self::remote_file_exists( $file_name ) ) {
			self::reset_geo_ip();
			return '';
		}

		$country_code = false;
		if ( ! class_exists( '\GeoIp2\Database\Reader' ) ) {
			self::error_log( 'GeoIp2\Database\Reader class not found' );
			return '';
		}

		try {
			$reader = new Reader( $file_name );
			$ip     = Ip::get_ip_address();
			if ( $ip === '' ) {
				return '';
			}

			$record       = $reader->country( $ip );
			$country_code = $record->country->isoCode;
			$reader->close();
		} catch ( \Exception $e ) {
			$error_msg = $e->getMessage();
			if ( strpos( $error_msg, ' is not in the databas' ) !== false ) {
				// not recognized, default to the US.
				$country_code = 'US';
			} else {
				self::reset_geo_ip();
				self::error_log( 'MaxMind error: ' . $error_msg );
			}
		}

		return $country_code;
	}


	/**
	 * Reset the geo ip database on a detected error, unless it's currently downloading
	 */
	public static function reset_geo_ip(): void {
		if ( ! get_transient( 'burst_importing' ) ) {
			update_option( 'burst_import_geo_ip_on_activation', true, false );
			delete_option( 'burst_geo_ip_file' );
			delete_option( 'burst_last_update_geo_ip' );
		}
	}
}
