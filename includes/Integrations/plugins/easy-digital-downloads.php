<?php
/**
 * Easy Digital Downloads integration functions.
 */

use EDD\Orders\Order;
use EDD\Orders\Order_Item;

defined( 'ABSPATH' ) || die();

/**
 * Add Easy Digital Downloads checkout page ID to the burst checkout page ID filter.
 *
 * @param int $page_id The current checkout page ID.
 * @return int The Easy Digital Downloads checkout page ID if EDD is active, otherwise the original page ID.
 */
function burst_add_easy_digital_download_checkout_page_id( int $page_id ): int {
	if ( function_exists( 'edd_get_option' ) ) {
		return intval( edd_get_option( 'purchase_page', $page_id ) );
	}

	return $page_id;
}
add_filter( 'burst_checkout_page_id', 'burst_add_easy_digital_download_checkout_page_id' );

/**
 * Add Easy Digital Downloads products page ID to the burst products page ID filter.
 *
 * @param int $page_id The current products page ID.
 * @return int The Easy Digital Downloads products page ID if EDD is active, otherwise the original page ID.
 */
function burst_add_easy_digital_downloads_products_page_id( int $page_id ): int {
	if ( function_exists( 'edd_get_option' ) ) {
		return intval( edd_get_option( 'products_page' ), $page_id );
	}

	return $page_id;
}
add_filter( 'burst_products_page_id', 'burst_add_easy_digital_downloads_products_page_id' );

/**
 * Handle actions when an Easy Digital Downloads order is created.
 *
 * @param int          $order_id  Payment ID.
 * @param \EDD_Payment $payment   object containing all payment data.
 * @phpstan-ignore-next-line
 */
function burst_easy_digital_downloads_order_created( int $order_id, \EDD_Payment $payment ): void {
	/* @phpstan-ignore-next-line  */
	if ( 'stripe' === $payment->gateway ) {
		// Handled in function burst_easy_digital_downloads_order_completed().
		return;
	}

	/* @phpstan-ignore-next-line  */
	$order_items = edd_get_order_items( [ 'order_id' => $order_id ] );

	burst_easy_digital_downloads_capture_order( $order_id, $order_items, $payment );
}
add_action( 'edd_complete_purchase', 'burst_easy_digital_downloads_order_created', 10, 2 );

/**
 * Handle actions when an Easy Digital Downloads order is completed.
 *
 * @param \EDD\Orders\Order $order The EDD Order object.
 * @phpstan-ignore-next-line
 */
function burst_easy_digital_downloads_order_completed( Order $order ): void {
	/* @phpstan-ignore-next-line  */
	$order_id    = $order->id;
	/* @phpstan-ignore-next-line  */
	$order_items = $order->get_items();
	/* @phpstan-ignore-next-line  */
	$payment_key = $order->payment_key;
	/* @phpstan-ignore-next-line  */
	$payment = edd_get_payment_by( 'key', $payment_key );

	if ( empty( $payment ) ) {
		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Log error if payment not found.
		error_log( sprintf( 'Burst EDD Integration: Payment not found for order ID %d and payment key %s', $order_id, $payment_key ) );
		return;
	}

	burst_easy_digital_downloads_capture_order( $order_id, $order_items, $payment );
}
add_action( 'edds_order_complete', 'burst_easy_digital_downloads_order_completed', 21 );

/**
 * Capture Easy Digital Downloads order data for Burst.
 *
 * @param int          $order_id     Payment ID.
 * @param Order_Item[] $order_items  Array of order items.
 * @param \EDD_Payment $payment      object containing all payment data.
 * @phpstan-ignore-next-line
 */
function burst_easy_digital_downloads_capture_order( int $order_id, array $order_items, EDD_Payment $payment ): void {
	$products = [];

	foreach ( $order_items as $item ) {
		$products[] = [
			/* @phpstan-ignore-next-line */
			'product_id' => $item->product_id,
			/* @phpstan-ignore-next-line */
			'amount'     => $item->quantity,
			/* @phpstan-ignore-next-line */
			'price'      => $item->amount,
		];
	}

	$data = apply_filters(
		'burst_edd_order_data',
		[
			// @phpstan-ignore-next-line
			'currency' => $payment->currency,
			// @phpstan-ignore-next-line
			'tax'      => $payment->tax,
			// Total amount paid (excluding tax).
			// @phpstan-ignore-next-line.
			'total'    => $payment->subtotal,
			'platform' => 'EDD',
			'products' => $products,
		],
		$order_id,
		$payment
	);

	/**
	 * Action hook fired when order is created.
	 * burst_order_created
	 *
	 * @param array $data     An array of order data including:
	 *                        - 'currency' (string): The currency code of the order.
	 *                        - 'total' (float): The total amount of the order before tax.
	 *                        - 'tax' (float): The total tax applied to the order.
	 *                        - 'products' (array): An array of products in the order, each containing:
	 *                           - 'product_id' (int): The ID of the product.
	 *                           - 'platform' (string): The platform identifier, e.g., 'EDD' for Easy Digital Downloads.
	 *                           - 'amount' (int): The quantity of the product.
	 *                           - 'price' (float): The price of the product.
	 */
	do_action( 'burst_order_created', $data );

	/**
	 * Action hook fired when an Easy Digital Downloads order is created.
	 * burst_edd_order_created
	 *
	 * @param array $data An array of order data including:
	 *                    - 'currency' (string): The currency code of the order.
	 *                    - 'total' (float): The total amount of the order before tax.
	 *                    - 'tax' (float): The total tax applied to the order.
	 *                    - 'products' (array): An array of products in the order, each containing:
	 *                      - 'product_id' (int): The ID of the product.
	 *                      - 'platform' (string): The platform identifier, e.g., 'EDD' for Easy Digital Downloads.
	 *                      - 'amount' (int): The quantity of the product.
	 *                      - 'price' (float): The price of the product.
	 */
	do_action( 'burst_edd_order_created', $data );
}

/**
 * Handle actions when the Easy Digital Downloads cart is updated.
 *
 * @param array $cart The current cart contents.
 */
function burst_easy_digital_downloads_cart_updated( array $cart ): void {
	$items_data = [];

	if ( ! empty( $cart ) ) {
		foreach ( $cart as $item ) {
			$items_data[] = [
				'product_id' => $item['id'],
				'quantity'   => $item['quantity'],
				/* @phpstan-ignore-next-line  */
				'price'      => edd_get_cart_item_price( $item['id'], $item['options'] ?? [] ),
				'added_at'   => current_time( 'mysql' ),
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

/**
 * Handle actions when an item is added to the Easy Digital Downloads cart.
 */
function burst_easy_digital_downloads_add_to_cart(): void {
	/* @phpstan-ignore-next-line  */
	$cart = edd_get_cart_contents();
	burst_easy_digital_downloads_cart_updated( $cart );
}
add_action( 'edd_post_add_to_cart', 'burst_easy_digital_downloads_add_to_cart' );

/**
 * Handle actions when an item is removed from the Easy Digital Downloads cart.
 */
function burst_easy_digital_downloads_remove_from_cart(): void {
	/* @phpstan-ignore-next-line  */
	$cart = edd_get_cart_contents();
	burst_easy_digital_downloads_cart_updated( $cart );
}
add_action( 'edd_post_remove_from_cart', 'burst_easy_digital_downloads_remove_from_cart' );

/**
 * Get Easy Digital Downloads base currency for Burst.
 *
 * @return string The Easy Digital Downloads base currency code.
 */
function burst_easy_digital_downloads_base_currency(): string {
	if ( function_exists( 'edd_get_currency' ) ) {
		return edd_get_currency();
	}
	return 'USD';
}
add_filter( 'burst_base_currency', 'burst_easy_digital_downloads_base_currency' );

/**
 * Invalidate base currency cache when Easy Digital Downloads currency option is updated.
 *
 * @param string $option    Name of the option to update.
 * @param mixed  $old_value The old option value.
 * @param mixed  $value     The new option value.
 */
function burst_edd_invalidate_base_currency_cache( string $option, mixed $old_value, mixed $value ): void {
	if ( 'edd_settings' !== $option ) {
		return;
	}

	$settings     = is_array( $value ) ? $value : [];
	$old_settings = is_array( $old_value ) ? $old_value : [];

	if ( isset( $settings['currency'] ) && $settings['currency'] !== ( $old_settings['currency'] ?? '' ) ) {
		delete_transient( 'burst_base_currency' );
	}
}
add_action( 'update_option', 'burst_edd_invalidate_base_currency_cache', 10, 3 );
