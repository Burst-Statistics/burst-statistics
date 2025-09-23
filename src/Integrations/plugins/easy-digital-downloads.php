<?php
/**
 * Easy Digital Downloads integration functions.
 */

defined( 'ABSPATH' ) || die();

/**
 * Add Easy Digital Downloads checkout page ID to the burst checkout page ID filter.
 *
 * @param int $page_id The current checkout page ID.
 * @return int The Easy Digital Downloads checkout page ID if EDD is active, otherwise the original page ID.
 */
function burst_add_easy_digital_download_checkout_page_id( int $page_id ): int {
	if ( function_exists( 'edd_get_option' ) ) {
		return edd_get_option( 'purchase_page', $page_id );
	}

	return $page_id;
}
add_filter( 'burst_checkout_page_id', 'burst_add_easy_digital_download_checkout_page_id' );
