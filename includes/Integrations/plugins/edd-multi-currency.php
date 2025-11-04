<?php
/**
 * EDD Multi Currency integration functions.
 */

defined( 'ABSPATH' ) || die();

/**
 * Modify burst EDD order data for multi-currency.
 *
 * @param array $data     The order data.
 * @param int   $order_id The order ID.
 * @return array The modified order data.
 */
function burst_edd_multi_currency_order_data( array $data, int $order_id ): array {
	/* @phpstan-ignore-next-line  */
	$order = edd_get_order( $order_id );

	if ( empty( $order ) ) {
		return $data;
	}

	$exchange_rate = $order->rate;

	if ( empty( $exchange_rate ) ) {
		return $data;
	}

	$data['conversion_rate'] = $exchange_rate;

	return $data;
}

add_filter( 'burst_edd_order_data', 'burst_edd_multi_currency_order_data', 10, 2 );
