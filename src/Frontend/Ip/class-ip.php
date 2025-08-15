<?php
namespace Burst\Frontend\Ip;

use Burst\Traits\Helper;

if ( ! defined( 'ABSPATH' ) ) {
	return;
}

class Ip {

	use Helper;

	/**
	 * Get blocked IP addresses.
	 *
	 * @return string
	 */
	public static function get_blocked_ips(): string {
		$options = get_option( 'burst_options_settings', [] );
		return $options['ip_blocklist'] ?? '';
	}

	/**
	 * Check if IP is blocked.
	 *
	 * @return bool
	 */
	public static function is_ip_blocked(): bool {
		$ip = self::get_ip_address();

		// Split by line break.
		$blocked_ips = preg_split( '/\r\n|\r|\n/', self::get_blocked_ips() );
		if ( is_array( $blocked_ips ) ) {
			$blocked_ips_array = array_map( 'trim', $blocked_ips );
			$ip_blocklist      = apply_filters( 'burst_ip_blocklist', $blocked_ips_array );
			foreach ( $ip_blocklist as $ip_range ) {
				if ( self::ip_in_range( $ip, $ip_range ) ) {
					self::error_log( 'IP ' . $ip . ' is blocked for tracking.' );
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Get the visitor IP, considering common proxy headers.
	 * Note: trusting X-Forwarded-For should be limited to trusted proxies.
	 *
	 * @return string
	 */
	public static function get_ip_address(): string {
		$candidates = [];

		// Cloudflare first (real client IP).
		if ( ! empty( $_SERVER['HTTP_CF_CONNECTING_IP'] ) ) {
			$candidates[] = $_SERVER['HTTP_CF_CONNECTING_IP'];
		}

		// True-Client-IP (Akamai/CF).
		if ( ! empty( $_SERVER['HTTP_TRUE_CLIENT_IP'] ) ) {
			$candidates[] = $_SERVER['HTTP_TRUE_CLIENT_IP'];
		}

		// X-Forwarded-For may contain a CSV list: pick the left-most valid public IP.
		if ( ! empty( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ) {
			foreach ( explode( ',', $_SERVER['HTTP_X_FORWARDED_FOR'] ) as $part ) {
				$candidates[] = trim( $part );
			}
		}

		// Other common headers.
		foreach ( [ 'HTTP_X_REAL_IP', 'HTTP_X_CLUSTER_CLIENT_IP', 'HTTP_CLIENT_IP', 'REMOTE_ADDR' ] as $h ) {
			if ( ! empty( $_SERVER[ $h ] ) ) {
				$candidates[] = $_SERVER[ $h ];
			}
		}

		// Select first valid IP (prefer public, fallback to any valid).
		$valid = [];
		foreach ( $candidates as $ip ) {
			$ip = trim( $ip );
			if ( $ip === '' || $ip === '127.0.0.1' ) {
				continue;
			}
			if ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_IPV6 ) ) {
				$valid[] = $ip;
			}
		}

		if ( empty( $valid ) ) {
			return apply_filters( 'burst_visitor_ip', '' );
		}

		// Prefer public (non-private, non-reserved).
		foreach ( $valid as $ip ) {
			if ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE ) ) {
				return apply_filters( 'burst_visitor_ip', $ip );
			}
		}

		// Fallback: first valid.
		return apply_filters( 'burst_visitor_ip', $valid[0] );
	}

	/**
	 * Convert IP address to packed binary format.
	 *
	 * @param string $ip the IP address to convert.
	 * @return string Packed binary representation of the IP address.
	 */
	private static function inet_pton( string $ip ): string {
		if ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_IPV6 ) === false ) {
			return '';
		}
		return inet_pton( $ip );
	}

	/**
	 * Check if IP is within range (single IP or CIDR, IPv4/IPv6).
	 * Compares in binary (inet_pton) to avoid IPv6 string format issues.
	 * Uses byte masks for both IPv4 and IPv6 (safe on 32-bit PHP).
	 *
	 * @param string $ip    IP address.
	 * @param string $range Single IP or CIDR range.
	 * @return bool
	 */
	public static function ip_in_range( string $ip, string $range ): bool {
		$ip_bin = self::inet_pton( $ip );
		if ( $ip_bin === '' ) {
			return false;
		}

		// Single IP (no slash) → binary equality (also handles IPv6 compressed).
		if ( strpos( $range, '/' ) === false ) {
			$range_bin = self::inet_pton( $range );
			if ( $range_bin === '' ) {
				return false;
			}

			// Treat IPv4 vs IPv4-mapped IPv6 as equal.
			if ( strlen( $ip_bin ) !== strlen( $range_bin ) ) {
				$ip_bin_v4    = self::ipv4_from_mapped( $ip_bin );
				$range_bin_v4 = self::ipv4_from_mapped( $range_bin );
				if ( $ip_bin_v4 !== '' && $range_bin_v4 !== '' ) {
					return hash_equals( $ip_bin_v4, $range_bin_v4 );
				}
				return false;
			}

			return hash_equals( $ip_bin, $range_bin );
		}

		// CIDR.
		[ $subnet, $bits ] = explode( '/', $range, 2 );
		if ( ! is_numeric( $bits ) ) {
			return false;
		}
		$subnet_bin = self::inet_pton( $subnet );
		if ( $subnet_bin === '' ) {
			return false;
		}

		// 4 for v4, 16 for v6.
		$len      = strlen( $subnet_bin );
		$max_bits = $len * 8;
		$bits     = (int) $bits;
		if ( $bits < 0 || $bits > $max_bits ) {
			return false;
		}

		// IP and subnet must be same family, but allow v4-mapped match.
		if ( strlen( $ip_bin ) !== $len ) {
			$ip_bin_v4     = self::ipv4_from_mapped( $ip_bin );
			$subnet_bin_v4 = self::ipv4_from_mapped( $subnet_bin );
			if ( $ip_bin_v4 === '' || $subnet_bin_v4 === '' ) {
				return false;
			}
			$ip_bin     = $ip_bin_v4;
			$subnet_bin = $subnet_bin_v4;
			$len        = 4;
			$max_bits   = 32;
			if ( $bits > $max_bits ) {
				return false;
			}
		}

		// Build mask bytes.
		$full_bytes   = intdiv( $bits, 8 );
		$partial_bits = $bits % 8;

		$mask = str_repeat( "\xFF", $full_bytes );
		if ( $partial_bits > 0 ) {
			$mask .= chr( bindec( str_pad( str_repeat( '1', $partial_bits ), 8, '0' ) ) );
		}
		$mask .= str_repeat( "\x00", $len - strlen( $mask ) );

		// Compare masked values.
		$masked_ip     = $ip_bin & $mask;
		$masked_subnet = $subnet_bin & $mask;

		return hash_equals( $masked_ip, $masked_subnet );
	}

	/**
	 * If binary is IPv4-mapped IPv6, return 4-byte IPv4 binary; else empty string.
	 *
	 * @param string $bin Binary IP.
	 * @return string
	 */
	private static function ipv4_from_mapped( string $bin ): string {
		if ( strlen( $bin ) === 16 && substr( $bin, 0, 12 ) === "\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xff" ) {
			// Last 4 bytes.
			return substr( $bin, 12 );
		}
		if ( strlen( $bin ) === 4 ) {
			// Already IPv4.
			return $bin;
		}
		return '';
	}
}
