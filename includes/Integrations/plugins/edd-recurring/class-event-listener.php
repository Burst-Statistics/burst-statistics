<?php

namespace Burst\Integrations\Plugins\EDD_Recurring;

use Burst\Traits\Database_Helper;

/**
 * Class Event_Listener
 */
class Event_Listener {

	use Database_Helper;

	/**
	 * Plugin source key; identifies this integration's rows in the dirty table.
	 */
	private const PLUGIN_SOURCE = 'edd_recurring';

	/**
	 * Safety cap on the dirty set; overflow arms a full rebuild instead of
	 * dropping IDs.
	 */
	private const DIRTY_MAX = 5000;

	/**
	 * Initialize the frontend integration.
	 */
	public function init(): void {
		// EDD Recurring lifecycle hooks pass the subscription ID first — flag it
		// dirty so the debounced today-update re-measures just that subscription.
		add_action( 'edd_subscription_post_create', [ $this, 'handle_subscription_event' ] );
		add_action( 'edd_subscription_post_renew', [ $this, 'handle_subscription_event' ] );
		add_action( 'edd_subscription_cancelled', [ $this, 'handle_subscription_event' ] );
		add_action( 'edd_subscription_expired', [ $this, 'handle_subscription_event' ] );
		add_action( 'edd_subscription_completed', [ $this, 'handle_subscription_event' ] );
		add_action( 'edd_recurring_update_subscription', [ $this, 'handle_subscription_event' ] );

		// `set_status()` fires this on every transition with the subscription as the
		// 3rd arg — flag it dirty so transitions the hooks above miss (trial→active,
		// failing, reactivate) still re-measure the subscription.
		add_action( 'edd_subscription_status_change', [ $this, 'handle_status_change' ], 10, 3 );

		// Passes a payment/order ID first (not a subscription), so it only triggers
		// the debounced re-sweep.
		add_action( 'edd_recurring_record_payment', [ $this, 'handle_event_only' ] );
	}

	/**
	 * Lifecycle hook handler: flag the changed subscription dirty, then trigger
	 * the debounced today-update.
	 *
	 * @param object|int|mixed $subscription EDD_Subscription object or ID.
	 */
	public function handle_subscription_event( mixed $subscription = null ): void {
		$id = $this->resolve_id( $subscription );

		if ( $id > 0 ) {
			$this->mark_dirty( $id );
		}

		do_action( 'burst_subscription_update_today', 'edd_recurring' );
	}

	/**
	 * Status-change handler. `edd_subscription_status_change` passes the
	 * EDD_Subscription as its 3rd argument; flag it dirty so every transition
	 * (incl. activate / failing / reactivate) re-measures the subscription.
	 *
	 * @param string           $old_status   Previous status (unused).
	 * @param string           $new_status   New status (unused).
	 * @param object|int|mixed $subscription EDD_Subscription object.
	 */
	public function handle_status_change( string $old_status, string $new_status, mixed $subscription = null ): void {
		$id = $this->resolve_id( $subscription );

		if ( $id > 0 ) {
			$this->mark_dirty( $id );
		}

		do_action( 'burst_subscription_update_today', 'edd_recurring' );
	}

	/**
	 * Trigger the debounced today-update without flagging a specific subscription.
	 */
	public function handle_event_only(): void {
		do_action( 'burst_subscription_update_today', 'edd_recurring' );
	}

	/**
	 * Resolve a subscription ID from an EDD_Subscription object or a scalar.
	 *
	 * @param object|int|mixed $subscription Subscription object or ID.
	 */
	private function resolve_id( mixed $subscription ): int {
		if ( is_object( $subscription ) && isset( $subscription->id ) ) {
			return (int) $subscription->id;
		}

		return (int) $subscription;
	}

	/**
	 * Add a subscription ID to the dirty set (atomic; capped).
	 *
	 * @param int $sub_id Subscription ID.
	 */
	private function mark_dirty( int $sub_id ): void {
		if ( $sub_id <= 0 || ! defined( 'BURST_PRO_FILE' ) || ! $this->table_exists( 'burst_subscription_dirty' ) ) {
			return;
		}

		global $wpdb;

		// Atomic dedup insert via the PK — no get/update_option read-modify-write,
		// so concurrent events cannot lose each other's IDs.
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$wpdb->prefix}burst_subscription_dirty (plugin_source, sub_id) VALUES (%s, %d)", self::PLUGIN_SOURCE, $sub_id ) );

		// Overflow: too many pending changes to refresh incrementally. Flag a full
		// rebuild (consumed on cron) instead of silently dropping the ID.
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$count = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_subscription_dirty WHERE plugin_source = %s", self::PLUGIN_SOURCE ) );
		if ( $count > self::DIRTY_MAX ) {
			update_option( 'burst_subscription_needs_rebuild_' . self::PLUGIN_SOURCE, 1, false );
		}
	}
}
