<?php
namespace Burst\Frontend\Ip;

use Burst\Traits\Helper;

if ( ! defined( 'ABSPATH' ) ) {
	return;
}

class Ip {

	use Helper;

	/**
	 * Get blocked ip's
	 */
	public static function get_blocked_ips(): string {
		$options = get_option( 'burst_options_settings', [] );
		return $options['ip_blocklist'] ?? '';
	}

	/**
	 * Check if IP is blocked
	 */
	public static function is_ip_blocked(): bool {

		$ip = self::get_ip_address();
		// split by line break.
		$blocked_ips = preg_split( '/\r\n|\r|\n/', self::get_blocked_ips() );
		if ( is_array( $blocked_ips ) ) {
			$blocked_ips_array = array_map( 'trim', $blocked_ips );
			$ip_blocklist      = apply_filters( 'burst_ip_blocklist', $blocked_ips_array );
			foreach ( $ip_blocklist as $ip_range ) {
				if ( self::ip_in_range( $ip, $ip_range ) ) {
					self::error_log( 'IP ' . $ip . ' is blocked for tracking' );

					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Get the ip of visiting user
	 * https://stackoverflow.com/questions/11452938/how-to-use-http-x-forwarded-for-properly
	 */
	public static function get_ip_address(): string {
		// least common types first.
		$variables = [
			'HTTP_CF_CONNECTING_IP',
			'CF-IPCountry',
			'HTTP_TRUE_CLIENT_IP',
			'HTTP_X_CLUSTER_CLIENT_IP',
			'HTTP_CLIENT_IP',
			'HTTP_X_FORWARDED_FOR',
			'HTTP_X_FORWARDED',
			'HTTP_X_REAL_IP',
			'HTTP_FORWARDED_FOR',
			'HTTP_FORWARDED',
			'REMOTE_ADDR',
		];

		$current_ip = '';
		foreach ( $variables as $variable ) {
			$current_ip = self::is_real_ip( $variable );
			if ( ! empty( $current_ip ) ) {
				break;
			}
		}

		// in some cases, multiple ip's get passed. split it to get just one.
		if ( strpos( $current_ip, ',' ) !== false ) {
			$ips        = explode( ',', $current_ip );
			$current_ip = $ips[0];
		}

		return apply_filters( 'burst_visitor_ip', $current_ip );
	}

	/**
	 * Get ip from var, and check if the found ip is a valid one
	 *
	 * @param string $ip_number The environment variable name to check.
	 * @return string The IP address if valid, empty string otherwise
	 */
	public static function is_real_ip( string $ip_number ): string {
		$ip = getenv( $ip_number );
		return ! $ip || trim( $ip ) === '127.0.0.1' ? '' : $ip;
	}

	/**
	 * Checks if a given IP address is within a specified IP range.
	 *
	 * This function supports both IPv4 and IPv6 addresses, and can handle ranges in
	 * both standard notation (e.g. "192.0.2.0") and CIDR notation (e.g. "192.0.2.0/24").
	 *
	 * In CIDR notation, the function uses a bitmask to check if the IP address falls within
	 * the range. For IPv4 addresses, it uses the `ip2long()` function to convert the IP
	 * address and subnet to their integer representations, and then uses the bitmask to
	 * compare them. For IPv6 addresses, it uses the `inet_pton()` function to convert the IP
	 * address and subnet to their binary representations, and uses a similar bitmask approach.
	 *
	 * If the range is not in CIDR notation, it simply checks if the IP equals the range.
	 *
	 * @param  string $ip  The IP address to check.
	 * @param  string $range  The range to check the IP address against.
	 * @return bool True if the IP address is within the range, false otherwise.
	 */
	public static function ip_in_range( string $ip, string $range ): bool {
		// Check if the IP address is properly formatted.
		if ( ! filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_IPV6 ) ) {
			return false;
		}
		// Check if the range is in CIDR notation.
		if ( strpos( $range, '/' ) !== false ) {
			// The range is in CIDR notation, so we split it into the subnet and the bit count.
			[ $subnet, $bits ] = explode( '/', $range );

			if ( ! is_numeric( $bits ) || $bits < 0 || $bits > 128 ) {
				return false;
			}

			// Check if the subnet is a valid IPv4 address.
			if ( filter_var( $subnet, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 ) ) {
				// Convert the IP address and subnet to their integer representations.
				$ip     = ip2long( $ip );
				$subnet = ip2long( $subnet );

				// Create a mask based on the number of bits.
				$mask = - 1 << ( 32 - $bits );

				// Apply the mask to the subnet.
				$subnet &= $mask;

				// Compare the masked IP address and subnet.
				return ( $ip & $mask ) === $subnet;
			}

			// Check if the subnet is a valid IPv6 address.
			if ( filter_var( $subnet, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6 ) ) {
				// Convert the IP address and subnet to their binary representations.
				$ip     = inet_pton( $ip );
				$subnet = inet_pton( $subnet );
				// Divide the number of bits by 8 to find the number of full bytes.
				$full_bytes = floor( $bits / 8 );
				// Find the number of remaining bits after the full bytes.
				$partial_byte = $bits % 8;
				// Initialize the mask.
				$mask = '';
				// Add the full bytes to the mask, each byte being "\xff" (255 in binary).
				$mask .= str_repeat( "\xff", (int) $full_bytes );
				// If there are any remaining bits...
				if ( 0 !== $partial_byte ) {
					// Add a byte to the mask with the correct number of 1 bits.
					// First, create a string with the correct number of 1s.
					// Then, pad the string to 8 bits with 0s.
					// Convert the binary string to a decimal number.
					// Convert the decimal number to a character and add it to the mask.
					$mask .= chr( bindec( str_pad( str_repeat( '1', $partial_byte ), 8, '0' ) ) );
				}

				// Fill in the rest of the mask with "\x00" (0 in binary).
				// The total length of the mask should be 16 bytes, so subtract the number of bytes already added.
				// If we added a partial byte, we need to subtract 1 more from the number of bytes to add.
				$mask .= str_repeat( "\x00", (int) ( 16 - $full_bytes - ( 0 !== $partial_byte ? 1 : 0 ) ) );

				// Compare the masked IP address and subnet.
				if ( $ip === false || $subnet === false ) {
					return false;
				}

				$masked_ip     = $ip & $mask;
				$masked_subnet = $subnet & $mask;

				return $masked_ip === $masked_subnet;
			}

			// The subnet was not a valid IP address.
			return false;
		}

		if ( ! filter_var( $range, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_IPV6 ) ) {
			// The range was not in CIDR notation and was not a valid IP address.
			return false;
		}

		// The range is not in CIDR notation, so we simply check if the IP equals the range.
		return $ip === $range;
	}
}
