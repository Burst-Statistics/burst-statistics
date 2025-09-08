<?php
namespace Burst\Admin\Posts;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;

class Posts {
	use Admin_Helper;
	use Helper;

	/**
	 * Initialize the posts class
	 */
	public function init(): void {
		add_action( 'admin_init', [ $this, 'add_burst_admin_columns' ], 1 );
		add_action( 'pre_get_posts', [ $this, 'posts_orderby_total_pageviews' ], 1 );
	}

	/**
	 * Add counts column
	 *
	 * @since 1.1
	 */
	public function add_admin_column( string $column_name, string $column_title, string $post_type, bool $sortable, callable $cb ): void {
		// Add column.
		add_filter(
			'manage_' . $post_type . '_posts_columns',
			function ( $columns ) use ( $column_name, $column_title ) {
				$columns[ $column_name ] = $column_title;

				return $columns;
			}
		);

		// Add column content.
		add_action(
			'manage_' . $post_type . '_posts_custom_column',
			function ( $column, $post_id ) use ( $column_name, $cb ): void {
				if ( $column_name === $column ) {
					$cb( $post_id );
				}
			},
			10,
			2
		);

		// Add sortable column.
		if ( $sortable ) {
			add_filter(
				'manage_edit-' . $post_type . '_sortable_columns',
				function ( $columns ) use ( $column_name ) {
					$columns[ $column_name ] = $column_name;

					return $columns;
				}
			);
		}
	}

	/**
	 * Function to add pageviews column to post table
	 *
	 * @since 1.1
	 */
	public function add_burst_admin_columns(): void {
		if ( ! $this->user_can_view() ) {
			return;
		}
		$burst_column_post_types = apply_filters(
			'burst_column_post_types',
			[ 'post', 'page' ]
		);
		foreach ( $burst_column_post_types as $post_type ) {
			$this->add_admin_column(
				'pageviews',
				__( 'Pageviews', 'burst-statistics' ),
				$post_type,
				true,
				function ( $post_id ): void {
					$page_views = \Burst\burst_loader()->frontend->get_post_pageviews( $post_id );
					echo esc_html( $this->format_number_short( $page_views ) );
				}
			);
		}
	}

	/**
	 * Function to order posts by pageviews
	 */
	public function posts_orderby_total_pageviews( \WP_Query $query ): void {
		if ( ! is_admin() || ! $query->is_main_query() || ! $this->user_can_view() ) {
			return;
		}

		if ( 'pageviews' === $query->get( 'orderby' ) ) {
			add_filter( 'posts_join', [ $this, 'join_pageviews_table' ], 20 );
			add_filter( 'posts_fields', [ $this, 'select_pageviews_field' ], 20 );
			add_filter( 'posts_orderby', [ $this, 'orderby_pageviews' ], 20 );
			add_filter( 'posts_groupby', [ $this, 'groupby_post_id' ], 20 );
			// Cleanup after query is completely done.
			add_action( 'wp_loaded', [ $this, 'cleanup_pageviews_filters' ], 999 );
		}
	}

	/**
	 * Join the pageviews for the ordering
	 */
	public function join_pageviews_table( string $join ): string {
		global $wpdb, $wp_query;

		$current_post_type = $wp_query->get( 'post_type' );
		if ( empty( $current_post_type ) ) {
			$current_post_type = 'post';
		}
		$join .= $wpdb->prepare(
			" LEFT JOIN (
            SELECT page_id, COUNT(*) as pageview_count
            FROM {$wpdb->prefix}burst_statistics
            WHERE page_id > 0 AND page_type = %s
            GROUP BY page_id
        ) burst_stats ON {$wpdb->posts}.ID = burst_stats.page_id",
			$current_post_type
		);
		return $join;
	}

	/**
	 * Select the pageviews for the ordering.
	 */
	public function select_pageviews_field( string $fields ): string {
		$fields .= ', COALESCE(burst_stats.pageview_count, 0) as pageviews';
		return $fields;
	}

	/**
	 * Actual ordering.
	 */
	public function orderby_pageviews( string $orderby ): string {
		global $wp_query;
		if ( $wp_query->get( 'orderby' ) === 'pageviews' ) {
			$order   = $wp_query->get( 'order' ) === 'ASC' ? 'ASC' : 'DESC';
			$orderby = "pageviews $order";
		}
		return $orderby;
	}

	/**
	 * Group by for ordering.
	 */
	public function groupby_post_id( string $groupby ): string {
		global $wpdb;
		if ( empty( $groupby ) ) {
			$groupby = "{$wpdb->posts}.ID";
		}
		return $groupby;
	}

	/**
	 * Cleanup filters after ordering.
	 */
	public function cleanup_pageviews_filters( array $posts, \WP_Query $query ) {
		if ( 'pageviews' === $query->get( 'orderby' ) ) {
			remove_filter( 'posts_join', [ $this, 'join_pageviews_table' ] );
			remove_filter( 'posts_fields', [ $this, 'select_pageviews_field' ] );
			remove_filter( 'posts_orderby', [ $this, 'orderby_pageviews' ] );
			remove_filter( 'posts_groupby', [ $this, 'groupby_post_id' ] );
			remove_action( 'the_posts', [ $this, 'cleanup_pageviews_filters_once' ] );
		}
		return $posts;
	}
}
