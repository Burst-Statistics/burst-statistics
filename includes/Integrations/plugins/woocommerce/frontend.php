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

/**
 * Add WooCommerce products page ID to the burst products page ID filter.
 *
 * @param int $page_id The current products page ID.
 * @return int The Easy Digital Downloads products page ID if EDD is active, otherwise the original page ID.
 */
function burst_add_woocommerce_products_page_id( int $page_id ): int {
	if ( function_exists( 'wc_get_page_id' ) ) {
		return wc_get_page_id( 'shop' );
	}

	return $page_id;
}
add_filter( 'burst_products_page_id', 'burst_add_woocommerce_products_page_id' );

/**
 * Handle a newly created WooCommerce order.
 *
 * The order exists before it is paid. The visitor attribution is captured
 * now, while the visitor's own request (and Burst cookie) is available, and
 * stored on the order; the order itself is recorded once it reaches a paid
 * status, see burst_woocommerce_order_status_changed(). Pending and failed
 * orders therefore never enter the sales statistics.
 *
 * @param \WC_Order|\WC_Order_Refund $order The WooCommerce order object.
 */
function burst_woocommerce_order_created( WC_Order|WC_Order_Refund $order ): void {
	if ( ! ( $order instanceof WC_Order ) ) {
		return;
	}

	burst_woocommerce_store_visitor_attribution( $order );

	/**
	 * Filter whether orders are recorded as soon as they are created, before
	 * payment. Defaults to false: an order is recorded when it reaches a paid
	 * status (see wc_get_is_paid_statuses()).
	 *
	 * @param bool $record_unpaid Record unpaid orders. Default false.
	 * @since 3.7.1
	 */
	if ( (bool) apply_filters( 'burst_woocommerce_record_unpaid_orders', false ) || $order->is_paid() ) {
		burst_woocommerce_record_order( $order );
	}
}
add_action( 'woocommerce_checkout_order_created', 'burst_woocommerce_order_created' );
add_action( 'woocommerce_store_api_checkout_order_processed', 'burst_woocommerce_order_created' );

/**
 * Store the Burst visitor attribution on the order.
 *
 * Payment confirmation (gateway return, webhook, manual status change) runs
 * outside the visitor's request, so the uid and the statistic row of the
 * current hit are captured at creation time and kept in order meta.
 *
 * @param \WC_Order $order The WooCommerce order.
 */
function burst_woocommerce_store_visitor_attribution( WC_Order $order ): void {
	$tracking = \Burst\burst_loader()->frontend->tracking;
	$uid      = $tracking->get_burst_uid();

	if ( '' === $uid ) {
		return;
	}

	$statistic    = $tracking->get_last_user_statistic( $uid );
	$statistic_id = (int) ( $statistic['ID'] ?? 0 );

	if ( 0 === $statistic_id ) {
		return;
	}

	$order->update_meta_data( '_burst_uid', $uid );
	$order->update_meta_data( '_burst_statistic_id', (string) $statistic_id );
	$order->save_meta_data();
}

/**
 * Record the order once it reaches a paid status.
 *
 * Orders without a stored Burst attribution (created in the admin, imported,
 * or placed by a visitor Burst did not track) are skipped: they cannot be
 * attributed to a visit.
 *
 * @param int       $order_id The order ID.
 * @param string    $from     Previous status, without the wc- prefix.
 * @param string    $to       New status, without the wc- prefix.
 * @param \WC_Order $order    The WooCommerce order.
 */
function burst_woocommerce_order_status_changed( int $order_id, string $from, string $to, WC_Order $order ): void {
	if ( ! in_array( $to, wc_get_is_paid_statuses(), true ) ) {
		return;
	}

	if ( 0 === (int) $order->get_meta( '_burst_statistic_id' ) ) {
		return;
	}

	burst_woocommerce_record_order( $order );
}
add_action( 'woocommerce_order_status_changed', 'burst_woocommerce_order_status_changed', 10, 4 );

/**
 * Record the order in the Burst sales statistics, once.
 *
 * @param \WC_Order $order The WooCommerce order.
 */
function burst_woocommerce_record_order( WC_Order $order ): void {
	if ( 1 === (int) $order->get_meta( '_burst_order_recorded' ) ) {
		return;
	}

	$data = burst_woocommerce_get_order_data( $order );

	/**
	 * Action hook fired when an order should be recorded.
	 * burst_order_created
	 *
	 * @param array $data     An array of order data including:
	 *                        - 'currency' (string): The currency code of the order.
	 *                        - 'total' (float): The total amount of the order before tax.
	 *                        - 'tax' (float): The total tax applied to the order.
	 *                        - 'platform' (string): The platform identifier, e.g., 'WC' for WooCommerce.
	 *                        - 'uid' (string): The Burst visitor uid the order is attributed to, '' if unknown.
	 *                        - 'statistic_id' (int): The statistic row of the hit that placed the order, 0 if unknown.
	 *                        - 'products' (array): An array of products in the order, each containing:
	 *                          - 'product_id' (int): The ID of the product.
	 *                          - 'amount' (int): The quantity of the product.
	 *                          - 'price' (float): The price of the product.
	 * @since 3.0.0
	 */
	do_action( 'burst_order_created', $data );

	/**
	 * Action hook fired when a WooCommerce order should be recorded.
	 * burst_woocommerce_order_created
	 *
	 * @param array $data     The same order data as burst_order_created.
	 * @since 3.0.0
	 */
	do_action( 'burst_woocommerce_order_created', $data );

	$order->update_meta_data( '_burst_order_recorded', '1' );
	$order->save_meta_data();
}

/**
 * Build the Burst order payload for a WooCommerce order.
 *
 * @param \WC_Order $order The WooCommerce order.
 * @return array The order data, filtered through burst_woocommerce_order_data.
 */
function burst_woocommerce_get_order_data( WC_Order $order ): array {
	$products = [];
	foreach ( $order->get_items() as $item ) {
		if ( $item instanceof WC_Order_Item_Product ) {
			$product = $item->get_product();

			if ( ! $product ) {
				continue;
			}

			$products[] = [
				'product_id' => $product->get_id(),
				'amount'     => $item->get_quantity(),
				'price'      => $product->get_price(),
			];
		}
	}

	return apply_filters(
		'burst_woocommerce_order_data',
		[
			'currency'     => $order->get_currency(),
			'total'        => $order->get_subtotal(),
			'tax'          => $order->get_total_tax(),
			'platform'     => 'WC',
			'uid'          => (string) $order->get_meta( '_burst_uid' ),
			'statistic_id' => (int) $order->get_meta( '_burst_statistic_id' ),
			'products'     => $products,
		],
		$order
	);
}

/**
 * Capture WooCommerce cart updates and pass to custom burst hook.
 */
function burst_woocommerce_cart_updated(): void {
	$cart = WC()->cart;

	$items_data = [];

	if ( ! empty( $cart ) ) {
		foreach ( $cart->get_cart() as $cart_item ) {
			$product = $cart_item['data'];

			if ( ! $product instanceof WC_Product ) {
				continue;
			}

			$items_data[] = [
				'product_id' => $product->get_id(),
				'quantity'   => $cart_item['quantity'],
				'price'      => wc_get_price_excluding_tax( $product ),
			];
		}
	}

	$data = [ 'items' => $items_data ];

	/**
	 * Action hook fired when the cart is updated.
	 * burst_cart_updated
	 *
	 * @param array $data An array of cart data including:
	 *                    - 'items' (array): An array of items in the cart, each containing:
	 *                       - 'product_id' (int): The ID of the product/download.
	 *                       - 'quantity' (int): The quantity of the product in the cart.
	 *                       - 'price' (float): The price of the product (excluding tax).
	 *                       - 'added_at' (string): Timestamp of when the item was added to the cart.
	 * @since 3.0.0
	 */
	do_action( 'burst_cart_updated', $data );
}

add_action( 'woocommerce_cart_item_removed', 'burst_woocommerce_cart_updated' );
add_action( 'woocommerce_add_to_cart', 'burst_woocommerce_cart_updated' );
add_action( 'woocommerce_cart_item_restored', 'burst_woocommerce_cart_updated' );
add_action( 'woocommerce_after_cart_item_quantity_update', 'burst_woocommerce_cart_updated' );

/**
 * Get WooCommerce base currency for Burst.
 *
 * @return string The WooCommerce base currency code.
 */
function burst_woocommerce_base_currency(): string {
	return get_woocommerce_currency();
}
add_filter( 'burst_base_currency', 'burst_woocommerce_base_currency' );

/**
 * Invalidate WooCommerce base currency cache when the currency option is updated.
 *
 * @param string $option  The name of the updated option.
 * @param mixed  $old_value The old value of the option.
 * @param mixed  $value    The new value of the option.
 */
function burst_woocommerce_invalidate_base_currency_cache( string $option, mixed $old_value, mixed $value ): void {
	if ( 'woocommerce_currency' !== $option ) {
		return;
	}

	if ( $old_value !== $value ) {
		delete_transient( 'burst_base_currency' );
	}
}
add_action( 'update_option', 'burst_woocommerce_invalidate_base_currency_cache', 10, 3 );
