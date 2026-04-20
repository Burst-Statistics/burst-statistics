<?php

namespace Burst\Integrations\Plugins\EDD_Recurring;

/**
 * Class Event_Listener
 */
class Event_Listener {

	/**
	 * Initialize the frontend integration.
	 */
	public function init(): void {
		// EDD Recurring.
		add_action( 'edd_subscription_post_create', [ $this, 'handle_edd_event' ] );
		add_action( 'edd_subscription_post_renew', [ $this, 'handle_edd_event' ] );
		add_action( 'edd_recurring_record_payment', [ $this, 'handle_edd_event' ] );
		add_action( 'edd_subscription_cancelled', [ $this, 'handle_edd_event' ] );
		add_action( 'edd_subscription_expired', [ $this, 'handle_edd_event' ] );
		add_action( 'edd_subscription_completed', [ $this, 'handle_edd_event' ] );
		add_action( 'edd_subscription_status_change', [ $this, 'handle_edd_event' ] );
	}

	/**
	 * Generic Edd Subscriptions hook handler.
	 */
	public function handle_edd_event(): void {
		do_action( 'burst_subscription_update_today', 'edd_recurring' );
	}
}
