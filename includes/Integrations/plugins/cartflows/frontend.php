<?php
/**
 * CartFlows integration functions.
 *
 * CartFlows replaces the WooCommerce checkout page with checkout steps of its
 * own post type, so visits to those steps have to count as checkout visits in
 * the sales funnel, the quick wins and the live traffic block.
 */

defined( 'ABSPATH' ) || die();

/**
 * Add every published CartFlows checkout step to the checkout page IDs.
 *
 * @param int[] $page_ids The current checkout page IDs.
 * @return int[] The checkout page IDs including the CartFlows checkout steps.
 */
function burst_add_cartflows_checkout_page_ids( array $page_ids ): array {
	// The step type only lives in post meta, and a site has a handful of
	// checkout steps at most; burst_checkout_page_ids() caches the result
	// for a day, so this query runs once per day, not per request.
	// phpcs:disable WordPress.DB.SlowDBQuery.slow_db_query_meta_key, WordPress.DB.SlowDBQuery.slow_db_query_meta_value
	$step_ids = get_posts(
		[
			'post_type'              => 'cartflows_step',
			'post_status'            => 'publish',
			'posts_per_page'         => 100,
			'fields'                 => 'ids',
			'meta_key'               => 'wcf-step-type',
			'meta_value'             => 'checkout',
			'no_found_rows'          => true,
			'update_post_meta_cache' => false,
			'update_post_term_cache' => false,
		]
	);
	// phpcs:enable

	return array_merge( $page_ids, array_map( 'intval', $step_ids ) );
}
add_filter( 'burst_checkout_page_ids', 'burst_add_cartflows_checkout_page_ids' );

/**
 * Drop the cached checkout page IDs when a CartFlows step is saved.
 */
function burst_cartflows_step_saved(): void {
	delete_transient( 'burst_checkout_page_ids' );
}
add_action( 'save_post_cartflows_step', 'burst_cartflows_step_saved' );

/**
 * Drop the cached checkout page IDs when a CartFlows step is deleted.
 *
 * @param int           $post_id The deleted post ID.
 * @param \WP_Post|null $post    The deleted post.
 */
function burst_cartflows_step_deleted( int $post_id, ?WP_Post $post = null ): void {
	if ( $post instanceof WP_Post && 'cartflows_step' === $post->post_type ) {
		delete_transient( 'burst_checkout_page_ids' );
	}
}
add_action( 'deleted_post', 'burst_cartflows_step_deleted', 10, 2 );
