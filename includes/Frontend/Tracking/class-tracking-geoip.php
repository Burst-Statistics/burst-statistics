<?php
namespace Burst\Frontend\Tracking;

if ( ! defined( 'ABSPATH' ) ) {
	return;
}

require_once BURST_PATH . 'lib/vendor/autoload.php';

use Burst\Frontend\Ip\Ip;
use Burst\Traits\Helper;
use GeoIp2\Database\Reader;

/**
 * Core GeoIP reader + tracking enrichment.
 *
 * Reads country-level location data from the MaxMind GeoLite2 Country database
 * and enriches the tracked hit. Shared with the free plugin so country tracking
 * works without Pro. Pro extends this class (Tracking_GeoIp_Pro) and overrides
 * get_location_data() to read the richer City record; the enrichment in
 * add_location_data() handles both shapes.
 */
class Tracking_GeoIp {

	use Helper;

	/**
	 * Get the GeoIP reader instance.
	 *
	 * @return \GeoIp2\Database\Reader|null Reader instance or null on failure.
	 */
	protected static function get_reader(): ?\GeoIp2\Database\Reader {
		// Check if the file exists in the burst folder.
		$file_name = get_option( 'burst_geo_ip_file' );
		// The MaxMind Reader uses fopen() internally, so only locally accessible
		// files work. Stream-wrapper paths (e.g. s3://) work transparently too.
		if ( ! $file_name || ! file_exists( $file_name ) ) {
			static::reset_geo_ip();
			return null;
		}

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
	 * Reset the geo ip database on a detected error, unless it's currently downloading.
	 */
	public static function reset_geo_ip(): void {
		if ( ! get_transient( 'burst_importing' ) ) {
			update_option( 'burst_import_geo_ip_on_activation', true );
			delete_option( 'burst_geo_ip_file' );
			delete_option( 'burst_last_update_geo_ip' );
		}
	}

	/**
	 * The default, fully-shaped location response.
	 *
	 * @return array<string, mixed>
	 */
	protected static function location_defaults(): array {
		return [
			'city'            => '',
			'city_code'       => 0,
			'state'           => '',
			'state_code'      => '',
			'country_code'    => '',
			'continent_code'  => '',
			'accuracy_radius' => 0,
		];
	}

	/**
	 * Get country-level location data for the current visitor.
	 *
	 * @return array<string, mixed> Location data with the default structure.
	 */
	public static function get_location_data(): array {
		$defaults = static::location_defaults();
		$ip       = Ip::get_ip_address();

		// Prefer a real-time country from the edge/CDN (Cloudflare, Vercel, …) over
		// the local MaxMind database: it is fresher, needs no license key and no
		// on-disk database. Falls through to the reader when no edge country is set.
		$edge = static::get_edge_location_data( $ip, $defaults );
		if ( $edge !== null ) {
			return $edge;
		}

		$reader = static::get_reader();
		if ( $reader === null ) {
			return $defaults;
		}

		if ( empty( $ip ) ) {
			return $defaults;
		}

		try {
			// The country database only has country information.
			$record        = $reader->country( $ip );
			$location_data = [
				'country_code'   => $record->country->isoCode,
				'continent_code' => $record->continent->code,
			];
			$reader->close();

			return wp_parse_args( $location_data, $defaults );
		} catch ( \Exception $e ) {
			return static::handle_lookup_exception( $e, $defaults );
		}
	}

	/**
	 * Build a country-level location response from an edge/CDN country, if available.
	 *
	 * Country-only shape (no city/state), enriched with the continent so the
	 * continent stats view keeps working when the local database is bypassed.
	 *
	 * @param string               $ip       The visitor IP being resolved.
	 * @param array<string, mixed> $defaults The default location response.
	 * @return array<string, mixed>|null Shaped location data, or null when no edge country is present.
	 */
	protected static function get_edge_location_data( string $ip, array $defaults ): ?array {
		$country_code = static::get_edge_country_code( $ip );
		if ( $country_code === '' ) {
			return null;
		}

		return wp_parse_args(
			[
				'country_code'   => $country_code,
				'continent_code' => static::continent_for_country( $country_code ),
			],
			$defaults
		);
	}

	/**
	 * Resolve the visitor's country from an edge/CDN source, if one is present.
	 *
	 * Sites behind a CDN (Cloudflare, Vercel, Fastly, CloudFront, Netlify, …) receive
	 * the visitor country as an ISO-3166-1 alpha-2 code on a request header that the
	 * edge computes from live geodata. That is fresher than the monthly MaxMind
	 * snapshot, so we let it take precedence over the local reader.
	 *
	 * @param string $ip The visitor IP being resolved.
	 * @return string Uppercase ISO-3166-1 alpha-2 code, or '' when no trusted edge country is available.
	 */
	protected static function get_edge_country_code( string $ip ): string {
		/**
		 * Filter the visitor country before the local MaxMind lookup.
		 *
		 * Return a 2-letter ISO-3166-1 alpha-2 code to short-circuit the local
		 * database lookup, or '' (default) to fall through to the built-in CDN
		 * header detection and then the MaxMind database.
		 *
		 * @param string $country_code Empty by default.
		 * @param string $ip           The IP being looked up.
		 */
		$country = (string) apply_filters( 'burst_country_code_for_ip', '', $ip );

		if ( $country === '' ) {
			$country = static::country_from_cdn_headers();
		}

		$country = strtoupper( $country );
		// Reject 'XX'/unknown markers and anything that is not an ISO-3166 alpha-2 code.
		if ( $country === 'XX' || ! preg_match( '/^[A-Z]{2}$/', $country ) ) {
			return '';
		}

		return $country;
	}

	/**
	 * Read the visitor country from the well-known CDN/edge request headers.
	 *
	 * @return string Raw 2-letter country code as sent by the edge, or '' when none is set.
	 */
	protected static function country_from_cdn_headers(): string {
		/**
		 * Filter the list of trusted CDN country headers (as $_SERVER keys).
		 *
		 * Return an empty array to disable built-in CDN header detection entirely,
		 * e.g. on a site that is not behind a trusted edge and could receive a
		 * spoofed header.
		 *
		 * @param string[] $headers Ordered list of $_SERVER keys to check.
		 */
		$headers = (array) apply_filters(
			'burst_cdn_country_headers',
			[
				'HTTP_CF_IPCOUNTRY',              // Cloudflare.
				'HTTP_X_VERCEL_IP_COUNTRY',       // Vercel.
				'HTTP_CLOUDFRONT_VIEWER_COUNTRY', // AWS CloudFront.
				'HTTP_X_COUNTRY_CODE',            // Fastly / custom.
				'HTTP_X_COUNTRY',                 // Netlify.
				'HTTP_X_REAL_IP_COUNTRY',         // nginx geoip module.
			]
		);

		foreach ( $headers as $key ) {
			if ( ! empty( $_SERVER[ $key ] ) ) {
				return sanitize_text_field( wp_unslash( $_SERVER[ $key ] ) );
			}
		}

		return '';
	}

	/**
	 * Map an ISO-3166-1 alpha-2 country code to its continent code.
	 *
	 * Used to enrich the edge/CDN country (which carries no continent) so the
	 * continent stats view stays populated. Uses the same 7 continent codes as the
	 * MaxMind reader (AF, AN, AS, EU, NA, OC, SA).
	 *
	 * @param string $country_code Uppercase ISO-3166-1 alpha-2 country code.
	 * @return string Continent code, or '' when the country is unknown.
	 */
	protected static function continent_for_country( string $country_code ): string {
		static $map = null;
		if ( $map === null ) {
			$continents = [
				'AF' => [ 'AO', 'BF', 'BI', 'BJ', 'BW', 'CD', 'CF', 'CG', 'CI', 'CM', 'CV', 'DJ', 'DZ', 'EG', 'EH', 'ER', 'ET', 'GA', 'GH', 'GM', 'GN', 'GQ', 'GW', 'KE', 'KM', 'LR', 'LS', 'LY', 'MA', 'MG', 'ML', 'MR', 'MU', 'MW', 'MZ', 'NA', 'NE', 'NG', 'RE', 'RW', 'SC', 'SD', 'SH', 'SL', 'SN', 'SO', 'SS', 'ST', 'SZ', 'TD', 'TG', 'TN', 'TZ', 'UG', 'YT', 'ZA', 'ZM', 'ZW' ],
				'AN' => [ 'AQ', 'BV', 'GS', 'HM', 'TF' ],
				'AS' => [ 'AE', 'AF', 'AM', 'AZ', 'BD', 'BH', 'BN', 'BT', 'CC', 'CN', 'CX', 'CY', 'GE', 'HK', 'ID', 'IL', 'IN', 'IO', 'IQ', 'IR', 'JO', 'JP', 'KG', 'KH', 'KP', 'KR', 'KW', 'KZ', 'LA', 'LB', 'LK', 'MM', 'MN', 'MO', 'MV', 'MY', 'NP', 'OM', 'PH', 'PK', 'PS', 'QA', 'SA', 'SG', 'SY', 'TH', 'TJ', 'TL', 'TM', 'TR', 'TW', 'UZ', 'VN', 'YE' ],
				'EU' => [ 'AD', 'AL', 'AT', 'AX', 'BA', 'BE', 'BG', 'BY', 'CH', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FO', 'FR', 'GB', 'GG', 'GI', 'GR', 'HR', 'HU', 'IE', 'IM', 'IS', 'IT', 'JE', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SJ', 'SK', 'SM', 'UA', 'VA', 'XK' ],
				'NA' => [ 'AG', 'AI', 'AW', 'BB', 'BL', 'BM', 'BQ', 'BS', 'BZ', 'CA', 'CR', 'CU', 'CW', 'DM', 'DO', 'GD', 'GL', 'GP', 'GT', 'HN', 'HT', 'JM', 'KN', 'KY', 'LC', 'MF', 'MQ', 'MS', 'MX', 'NI', 'PA', 'PM', 'PR', 'SV', 'SX', 'TC', 'TT', 'US', 'VC', 'VG', 'VI' ],
				'OC' => [ 'AS', 'AU', 'CK', 'FJ', 'FM', 'GU', 'KI', 'MH', 'MP', 'NC', 'NF', 'NR', 'NU', 'NZ', 'PF', 'PG', 'PN', 'PW', 'SB', 'TK', 'TO', 'TV', 'UM', 'VU', 'WF', 'WS' ],
				'SA' => [ 'AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'FK', 'GF', 'GY', 'PE', 'PY', 'SR', 'UY', 'VE' ],
			];

			$map = [];
			foreach ( $continents as $continent => $countries ) {
				foreach ( $countries as $country ) {
					$map[ $country ] = $continent;
				}
			}
		}

		return $map[ $country_code ] ?? '';
	}

	/**
	 * Shared handling for reader lookup exceptions (localhost / not-in-database).
	 *
	 * @param \Exception           $e        The thrown exception.
	 * @param array<string, mixed> $defaults The default location response.
	 * @return array<string, mixed>
	 */
	protected static function handle_lookup_exception( \Exception $e, array $defaults ): array {
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
		}

		static::reset_geo_ip();
		self::error_log( 'MaxMind error: ' . $error_msg );
		return $defaults;
	}

	/**
	 * Enrich the tracked hit with location data.
	 *
	 * Hooked to burst_before_track_hit. Resolves the visitor's location, stores a
	 * row in burst_locations (city when available, otherwise the country lookup)
	 * and sets the hit's city_code.
	 *
	 * @param array<string, mixed>      $arr          The tracking data.
	 * @param string                    $hit_type     The type of hit.
	 * @param array<string, mixed>|null $previous_hit Previous hit data, if any.
	 * @return array<string, mixed>
	 */
	public static function add_location_data( array $arr, string $hit_type, ?array $previous_hit ): array {
		unset( $hit_type );
		if ( ! apply_filters( 'burst_geo_ip_enabled', true ) ) {
			return $arr;
		}

		// Only resolve location on the first hit of a session.
		if ( ! empty( $previous_hit ) ) {
			return $arr;
		}

		global $wpdb;
		// The filter lets tests and integrations mock the resolved location in any
		// environment (no MaxMind file / localhost IP). Covers both the core country
		// reader and the Pro city reader, and every return path of get_location_data().
		$geo_data = apply_filters( 'burst_location_data', static::get_location_data() );

		if ( ! empty( $geo_data['city'] ) ) {
			// Prefer the city_code if available, otherwise generate a stable hash.
			$city_code = ! empty( $geo_data['city_code'] )
				? $geo_data['city_code']
				: abs( crc32( $geo_data['city'] . $geo_data['state'] . $geo_data['country_code'] ) ) % 2147483647;

			// Skip 0 (reserved for the empty location) and negatives (reserved for
			// country-only rows).
			if ( $city_code > 0 ) {
				$wpdb->query(
					$wpdb->prepare(
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
					)
				);
			}

			$arr['city_code'] = $city_code;
		} elseif ( ! empty( $geo_data['country_code'] ) ) {
			// Country-only: always resolve to a country placeholder row (negative
			// city_code). This avoids reusing an arbitrary city row when a country
			// has multiple city entries.
			$city_code = $wpdb->get_var(
				$wpdb->prepare(
					"SELECT city_code FROM {$wpdb->prefix}burst_locations WHERE country_code = %s AND city_code < 0 ORDER BY city_code ASC LIMIT 1",
					$geo_data['country_code']
				)
			);
			if ( ! $city_code ) {
				// Dynamically create a unique, stable negative city_code for the country.
				$city_code = -abs( crc32( $geo_data['country_code'] ) ) % 2147483647;
				$wpdb->query(
					$wpdb->prepare(
						"INSERT IGNORE INTO {$wpdb->prefix}burst_locations
                            (`city_code`, `city`, `state_code`, `state`, `country_code`, `continent_code`)
                        VALUES
                            (%d, %s, %s, %s, %s, %s)",
						$city_code,
						'',
						'',
						'',
						$geo_data['country_code'],
						$geo_data['continent_code'] ?? ''
					)
				);
			}
			$arr['city_code'] = $city_code;
		}

		return $arr;
	}
}
