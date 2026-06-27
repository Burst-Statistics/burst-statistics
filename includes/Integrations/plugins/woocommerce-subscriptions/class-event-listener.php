<?php

namespace Burst\Integrations\Plugins\WooCommerce_Subscriptions;

use Burst\Traits\Database_Helper;

/**
 * Class Event_Listener
 */
class Event_Listener {

	use Database_Helper;

	/**
	 * Plugin source key; identifies this integration's rows in the dirty table.
	 */
	private const PLUGIN_SOURCE = 'woocommerce_subscriptions';

	/**
	 * Safety cap on the dirty set; overflow arms a full rebuild instead of
	 * dropping IDs.
	 */
	private const DIRTY_MAX = 5000;

	/**
	 * Initialize the frontend integration.
	 */
	public function init(): void {
		// WooCommerce Subscriptions. Each hook passes the WC_Subscription first;
		// the changed subscription is flagged dirty and the debounced today-update
		// re-measures it and re-sweeps.
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

		// Switch (upgrade/downgrade) changes the recurring amount without a status
		// change. Passes ( $order, $subscription, … ) — flag the subscription (2nd arg).
		add_action( 'woocommerce_subscription_item_switched', [ $this, 'handle_item_switched' ], 10, 2 );

		// Refunding a renewal/parent order changes revenue with no subscription-level
		// event; resolve the order's subscriptions from the order and flag them.
		add_action( 'woocommerce_order_refunded', [ $this, 'handle_order_refunded' ] );

		// Trash/delete removes a subscription without a status transition; flag it so
		// the re-collection drops its contribution rows from the counts.
		add_action( 'woocommerce_subscription_trashed', [ $this, 'handle_woocommerce_event' ] );
		add_action( 'woocommerce_subscription_deleted', [ $this, 'handle_woocommerce_event' ] );
	}

	/**
	 * Generic WooCommerce Subscriptions hook handler. Best-effort flags the
	 * changed subscription dirty, then triggers the debounced today-update.
	 *
	 * @param object|int|mixed $subscription WC_Subscription object or ID.
	 */
	public function handle_woocommerce_event( mixed $subscription = null ): void {
		$id = $this->resolve_id( $subscription );

		if ( $id > 0 ) {
			$this->mark_dirty( $id );
		}

		do_action( 'burst_subscription_update_today', 'woocommerce_subscriptions' );
	}

	/**
	 * Switch handler. `woocommerce_subscription_item_switched` passes
	 * ( $order, $subscription, … ); flag the switched subscription (2nd arg) so its
	 * changed recurring amount re-measures.
	 *
	 * @param mixed            $order        Switch order (unused).
	 * @param object|int|mixed $subscription WC_Subscription object.
	 */
	public function handle_item_switched( mixed $order, mixed $subscription = null ): void {
		$id = $this->resolve_id( $subscription );

		if ( $id > 0 ) {
			$this->mark_dirty( $id );
		}

		do_action( 'burst_subscription_update_today', 'woocommerce_subscriptions' );
	}

	/**
	 * Order-refund handler. `woocommerce_order_refunded` passes the refunded order
	 * ID; a renewal/parent refund carries no subscription event, so resolve the
	 * order's subscriptions and flag each dirty.
	 *
	 * @param int|mixed $order_id Refunded order ID.
	 */
	public function handle_order_refunded( mixed $order_id = 0 ): void {
		if ( ! function_exists( 'wcs_get_subscriptions_for_order' ) ) {
			return;
		}

		$subscriptions = wcs_get_subscriptions_for_order( (int) $order_id, [ 'order_type' => [ 'any' ] ] );

		foreach ( (array) $subscriptions as $subscription ) {
			$id = $this->resolve_id( $subscription );

			if ( $id > 0 ) {
				$this->mark_dirty( $id );
			}
		}

		do_action( 'burst_subscription_update_today', 'woocommerce_subscriptions' );
	}

	/**
	 * Resolve a subscription ID from a WC_Subscription object or a scalar.
	 *
	 * @param object|int|mixed $subscription Subscription object or ID.
	 */
	private function resolve_id( mixed $subscription ): int {
		if ( is_object( $subscription ) && method_exists( $subscription, 'get_id' ) ) {
			return (int) $subscription->get_id();
		}

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
