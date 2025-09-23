<?php
/**
 * WooCommerce integration functions.
 */

defined( 'ABSPATH' ) || die();

/**
 * Add WooCommerce checkout page ID to the burst checkout page ID filter.
 *
 * @param int $page_id The current checkout page ID.
 * @return int The WooCommerce checkout page ID if WooCommerce is active, otherwise the original page ID.
 */
function burst_add_woocommerce_checkout_page_id( int $page_id ): int {
	if ( function_exists( 'wc_get_page_id' ) ) {
		return wc_get_page_id( 'checkout' );
	}
	return $page_id;
}
add_filter( 'burst_checkout_page_id', 'burst_add_woocommerce_checkout_page_id' );
