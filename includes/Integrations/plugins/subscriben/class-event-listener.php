<?php

namespace Burst\Integrations\Plugins\Subscriben;

/**
 * Class Event_Listener
 */
class Event_Listener {

	/**
	 * Initialize the frontend integration.
	 */
	public function init(): void {
		// Subscriben lifecycle events that should trigger same-day aggregation refresh.
		add_action( 'subscriben_subscription_save_meta', [ $this, 'handle_subscriben_event' ] );
		add_action( 'subscriben_multisubscription_save_meta', [ $this, 'handle_subscriben_event' ] );
		add_action( 'subscriben_payment_applied', [ $this, 'handle_subscriben_event' ] );
		add_action( 'subscriben_status_changed', [ $this, 'handle_subscriben_event' ] );
		add_action( 'subscriben_created_renewal_order', [ $this, 'handle_subscriben_event' ] );
		add_action( 'subscriben_automatic_payment_failed', [ $this, 'handle_subscriben_event' ] );
	}

	/**
	 * Generic Subscriben hook handler.
	 */
	public function handle_subscriben_event(): void {
		do_action( 'burst_subscription_update_today', 'subscriben' );
	}
}
