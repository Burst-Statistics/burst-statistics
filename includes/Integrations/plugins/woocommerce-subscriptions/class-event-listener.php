<?php

namespace Burst\Integrations\Plugins\WooCommerce_Subscriptions;

/**
 * Class Event_Listener
 */
class Event_Listener {

	/**
	 * Initialize the frontend integration.
	 */
	public function init(): void {
		// WooCommerce Subscriptions.
		add_action( 'wcs_create_subscription', [ $this, 'handle_woocommerce_event' ] );
		add_action( 'woocommerce_new_subscription', [ $this, 'handle_woocommerce_event' ] );
		add_action( 'woocommerce_subscription_status_updated', [ $this, 'handle_woocommerce_event' ] );
		add_action( 'woocommerce_subscription_status_changed', [ $this, 'handle_woocommerce_event' ] );
		add_action( 'woocommerce_subscription_payment_complete', [ $this, 'handle_woocommerce_event' ] );
		add_action( 'woocommerce_subscription_renewal_payment_complete', [ $this, 'handle_woocommerce_event' ] );
		add_action( 'woocommerce_subscription_payment_failed', [ $this, 'handle_woocommerce_event' ] );
		add_action( 'woocommerce_subscription_renewal_payment_failed', [ $this, 'handle_woocommerce_event' ] );
		add_action( 'woocommerce_subscription_date_updated', [ $this, 'handle_woocommerce_event' ] );
		add_action( 'woocommerce_subscription_date_deleted', [ $this, 'handle_woocommerce_event' ] );
	}

	/**
	 * Generic WooCommerce Subscriptions hook handler.
	 */
	public function handle_woocommerce_event(): void {
		do_action( 'burst_subscription_update_today', 'woocommerce_subscriptions' );
	}
}
