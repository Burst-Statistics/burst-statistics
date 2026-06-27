<?php

namespace Burst\Integrations\Plugins\Subscriben;

use Burst\Traits\Database_Helper;

/**
 * Class Event_Listener
 */
class Event_Listener {

	use Database_Helper;

	/**
	 * Plugin source key; identifies this integration's rows in the dirty table.
	 */
	private const PLUGIN_SOURCE = 'subscriben';

	/**
	 * Safety cap on the dirty set; overflow arms a full rebuild instead of
	 * dropping IDs.
	 */
	private const DIRTY_MAX = 5000;

	/**
	 * Initialize the frontend integration.
	 */
	public function init(): void {
		// Subscriben lifecycle events. Each flags the changed subscription dirty;
		// the debounced today-update re-measures it and re-sweeps.
		add_action( 'subscriben_subscription_save_meta', [ $this, 'on_subscription' ], 10, 1 );
		add_action( 'subscriben_status_changed', [ $this, 'on_subscription' ], 10, 1 );
		add_action( 'subscriben_created_renewal_order', [ $this, 'on_subscription' ], 10, 1 );
		add_action( 'subscriben_payment_applied', [ $this, 'on_payment_applied' ], 10, 1 );
		add_action( 'subscriben_automatic_payment_failed', [ $this, 'on_payment_failed' ], 10, 2 );
		add_action( 'subscriben_multisubscription_save_meta', [ $this, 'on_multi_subscription' ], 10, 4 );
	}

	/**
	 * Handlers whose first argument is the Subscription object.
	 *
	 * @param object|int $subscription Subscription object or ID.
	 */
	public function on_subscription( object|int $subscription ): void {
		$this->mark_dirty( $this->resolve_id( $subscription ) );

		do_action( 'burst_subscription_update_today', 'subscriben' );
	}

	/**
	 * `subscriben_payment_applied` passes the subscription ID directly.
	 *
	 * @param int $subscription_id Subscription ID.
	 */
	public function on_payment_applied( int $subscription_id ): void {
		$this->mark_dirty( $subscription_id );

		do_action( 'burst_subscription_update_today', 'subscriben' );
	}

	/**
	 * `subscriben_automatic_payment_failed` passes ( $order, $subscription, ... ).
	 *
	 * @param mixed           $order        Order (unused).
	 * @param object|int|null $subscription Subscription object or ID.
	 */
	public function on_payment_failed( mixed $order, object|int|null $subscription = null ): void {
		$this->mark_dirty( $this->resolve_id( $subscription ) );

		do_action( 'burst_subscription_update_today', 'subscriben' );
	}

	/**
	 * `subscriben_multisubscription_save_meta` passes ( $sub, $order, $deprecated, $all_subs ).
	 *
	 * @param object|int $subscription Primary subscription.
	 * @param mixed      $order        Order (unused).
	 * @param mixed      $deprecated   Deprecated (unused).
	 * @param array      $all_subs     All subscriptions in the multi-save.
	 */
	public function on_multi_subscription( object|int $subscription, mixed $order = null, mixed $deprecated = null, array $all_subs = [] ): void {
		$this->mark_dirty( $this->resolve_id( $subscription ) );

		foreach ( $all_subs as $sub ) {
			$this->mark_dirty( $this->resolve_id( $sub ) );
		}

		do_action( 'burst_subscription_update_today', 'subscriben' );
	}

	/**
	 * Resolve a subscription ID from an object (public `$id`) or a scalar.
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
	 * @param int $sub_id Subscription post ID.
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
