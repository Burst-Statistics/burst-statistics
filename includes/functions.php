<?php
defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );
/**
 * Second function_exists is for <2.0 version of Burst Free
 */
if ( ! function_exists( '\Burst\burst_is_logged_in_rest' ) && ! function_exists( 'burst_is_logged_in_rest' ) ) {
	/**
	 * Check if the request is an authenticated Burst Rest Request
	 */
	function burst_is_logged_in_rest(): bool {
		static $memo = null;
		if ( $memo !== null ) {
			return $memo;
		}
		$uri = sanitize_url( wp_unslash( $_SERVER['REQUEST_URI'] ?? '' ) );
		// Cheap path: return early if not our REST route.
		if ( strpos( $uri, '/burst/v1/' ) === false && strpos( $uri, '%2Fburst%2Fv1%2F' ) === false ) {
			$memo = false;
			return $memo;
		}

		// Only now ask WP about the user (may hit usermeta once).
		$memo = is_user_logged_in();
		return $memo;
	}
}


if ( ! function_exists( '\Burst\burst_get_option' ) && ! function_exists( 'burst_get_option' ) ) {
    //phpcs:disable
	/**
	 * Get a Burst option by name
	 */
	function burst_get_option( string $name, $default = null ) {

		$name         = sanitize_title( $name );
		$options      = get_option( 'burst_options_settings', [] );
        $value_exists = array_key_exists( $name, $options );
		$value        = $options[ $name ] ?? false;

		if ( ! $value_exists && $default !== null ) {
			$value = $default;
		}

		return apply_filters( "burst_option_$name", $value, $name );
	}
    //phpcs:enable
}

if ( ! function_exists( '\Burst\burst_update_option' ) && ! function_exists( 'burst_update_option' ) ) {
	//phpcs:disable
	/**
	 * Update a Burst option by name
	 */
	function burst_update_option( string $name, $value ): void {
		$name    = sanitize_title( $name );
		$options = get_option( 'burst_options_settings', [] );

		if ( ! is_array( $options ) ) {
			$options = [];
		}

		$options[ $name ] = $value;
		update_option( 'burst_options_settings', $options );
	}
	//phpcs:enable
}

if ( ! function_exists( '\Burst\burst_delete_option' ) && ! function_exists( 'burst_delete_option' ) ) {
	//phpcs:disable
	/**
	 * Delete a Burst option by name
	 */
	function burst_delete_option( string $name ): void {
		$name    = sanitize_title( $name );
		$options = get_option( 'burst_options_settings', [] );

		if ( ! is_array( $options ) ) {
			$options = [];
		}

		if ( array_key_exists( $name, $options ) ) {
			unset( $options[ $name ] );
			update_option( 'burst_options_settings', $options );
		}
	}
	//phpcs:enable
}

if ( ! function_exists( '\Burst\burst_get_value' ) && ! function_exists( 'burst_get_value' ) ) {
    //phpcs:disable
    /**
	 * Deprecated: Get a Burst option by name, use burst_get_option instead
	 *
	 * @deprecated 1.3.0
	 */
	function burst_get_value( string $name, $default = false ) {
		return burst_get_option( $name, $default );
	}
    //phpcs:enable
}
