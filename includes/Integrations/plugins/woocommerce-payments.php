<?php
/**
 * WooCommerce Payments integration functions.
 */

defined( 'ABSPATH' ) || die();

/**
 * Modify burst woocommerce order data.
 *
 * @param array    $data  The order data.
 * @param WC_Order $order The WooCommerce order.
 * @return array The modified order data.
 */
function burst_modify_woocommerce_order_data( array $data, WC_Order $order ): array {
	if ( ! WC_Payments_Features::is_customer_multi_currency_enabled() ) {
		return $data;
	}

	$stripe_exchange_rate = ! empty( $order->get_meta( '_wcpay_multi_currency_stripe_exchange_rate', true ) )
		? (float) $order->get_meta( '_wcpay_multi_currency_stripe_exchange_rate', true )
		: null;
	$order_exchange_rate  = (float) $order->get_meta( '_wcpay_multi_currency_order_exchange_rate', true );

	$exchange_rate = $stripe_exchange_rate ?? $order_exchange_rate;

	if ( empty( $exchange_rate ) ) {
		return $data;
	}

	$data['conversion_rate'] = $exchange_rate;

	return $data;
}
add_filter( 'burst_woocommerce_order_data', 'burst_modify_woocommerce_order_data', 10, 2 );
