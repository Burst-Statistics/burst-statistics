<?php
namespace Burst\Admin\Posts;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Posts {
	use Admin_Helper;
	use Helper;

	private array $time_range_options = [];
	private string $default_option    = '30_days';
	/**
	 * Initialize the posts class
	 */
	public function init(): void {
		add_action( 'admin_init', [ $this, 'add_burst_admin_columns' ], 1 );
		add_action( 'pre_get_posts', [ $this, 'posts_orderby_total_pageviews' ], 1 );
		add_action( 'load-edit.php', [ $this, 'add_screen_options' ] );
		add_filter( 'init', [ $this, 'load_screen_options' ], 10 );
		add_filter( 'init', [ $this, 'save_screen_option' ], 10 );
	}

	/**
	 * Load screen options for Burst.
	 */
	public function load_screen_options(): void {
		$this->time_range_options = [
			'7_days'   => __( '7 days', 'burst-statistics' ),
			'30_days'  => __( '30 days', 'burst-statistics' ),
			'3_months' => __( '3 months', 'burst-statistics' ),
			'1_year'   => __( '1 year', 'burst-statistics' ),
			'all_time' => __( 'All time', 'burst-statistics' ),
		];
	}

	/**
	 * Sanitize the time range string.
	 */
	private function sanitize_time_range( string $time_range ): string {
		$keys = array_keys( $this->time_range_options );
		if ( ! in_array( $time_range, $keys, true ) ) {
			return $this->default_option;
		}
		return $time_range;
	}

	/**
	 * Save our screen option.
	 */
	public function save_screen_option(): void {
		if ( isset( $_POST['burst_pageviews_timerange'] ) ) {

			check_admin_referer( 'screen-options-nonce', 'screenoptionnonce' );
			update_user_meta(
				get_current_user_id(),
				'burst_pageviews_timerange',
				$this->sanitize_time_range( $_POST['burst_pageviews_timerange'] )
			);
		}
	}
	/**
	 * Add screen options for pageview timerange
	 *
	 * @since 1.1
	 */
	public function add_screen_options(): void {
		$screen = get_current_screen();
		if ( is_null( $screen ) || ! in_array( $screen->post_type, $this->get_burst_column_post_types(), true ) ) {
			return;
		}

		if ( ! $this->user_can_view() ) {
			return;
		}

		add_screen_option(
			'burst_pageviews_timerange',
			[
				'label'   => __( 'Pageviews date range', 'burst-statistics' ),
				'default' => '30_days',
				'option'  => 'burst_pageviews_timerange',
			]
		);
		add_filter( 'screen_settings', [ $this, 'add_timerange_dropdown' ], 10, 2 );
	}

	/**
	 * Add time range dropdown to screen options.
	 *
	 * @param string     $settings Screen settings HTML.
	 * @param \WP_Screen $screen Current screen object.
	 * @return string Modified screen settings HTML.
	 */
	public function add_timerange_dropdown( string $settings, \WP_Screen $screen ): string {
		if ( ! in_array( $screen->post_type, $this->get_burst_column_post_types(), true ) ) {
			return $settings;
		}

		if ( ! $this->user_can_view() ) {
			return $settings;
		}

		$timerange      = $this->get_selected_timerange();
		$dropdown_html  = '<fieldset class="burst-pageviews-timerange">';
		$dropdown_html .= '<legend>' . esc_html__( 'Pageviews time range', 'burst-statistics' ) . '</legend>';
		$dropdown_html .= '<select name="burst_pageviews_timerange" id="burst-pageviews-timerange">';

		foreach ( $this->time_range_options as $value => $label ) {
			$selected       = selected( $timerange, $value, false );
			$dropdown_html .= sprintf(
				'<option value="%s" %s>%s</option>',
				esc_attr( $value ),
				$selected,
				esc_html( $label )
			);
		}

		$dropdown_html .= '</select>';
		$dropdown_html .= '</fieldset>';

		return $settings . $dropdown_html;
	}

	/**
	 * Get the selected time range
	 */
	private function get_selected_timerange(): string {
		return $this->sanitize_time_range( get_user_meta( get_current_user_id(), 'burst_pageviews_timerange', true ) );
	}

	/**
	 * Get start timestamp based on timerange
	 */
	private function get_start_timestamp( string $time_range ): int {
		switch ( $time_range ) {
			case '7_days':
				return strtotime( '-7 days' );
			case '3_months':
				return strtotime( '-3 months' );
			case '1_year':
				return strtotime( '-1 year' );
			case 'all_time':
				return 0;
			default:
				return strtotime( '-30 days' );
		}
	}

	/**
	 * Get burst column post types
	 */
	private function get_burst_column_post_types(): array {
		return apply_filters(
			'burst_column_post_types',
			get_post_types( [ 'public' => true ] )
		);
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

		add_action(
			'admin_head',
			function (): void {
				if ( get_current_screen()->post_type === 'product' ) {
					echo '<style>
			.wp-list-table .column-pageviews {
				width: 14%;
			}
		</style>';
				}
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

		$burst_column_post_types = $this->get_burst_column_post_types();
		$time_range              = $this->get_selected_timerange();
		$start                   = $this->get_start_timestamp( $time_range );
		$time_range_label        = $this->time_range_options[ $time_range ];
		foreach ( $burst_column_post_types as $post_type ) {
			$this->add_admin_column(
				'pageviews',
				'<span title="' . esc_attr( $this->get_column_title( $time_range ) ) . '">' . __( 'Pageviews', 'burst-statistics' ) . ' </span>',
				$post_type,
				true,
				function ( $post_id ) use ( $start ): void {
					$page_views = \Burst\burst_loader()->frontend->get_post_pageviews( $post_id, $start, time() );
					echo esc_html( $this->format_number_short( $page_views ) );
				}
			);
		}
	}

	/**
	 * Get column title based on time range
	 */
	private function get_column_title( string $time_range ): string {
		switch ( $time_range ) {
			case '7_days':
				return __( 'Total number of pageviews of the past 7 days.', 'burst-statistics' );
			case '3_months':
				return __( 'Total number of pageviews of the past 3 months.', 'burst-statistics' );
			case '1_year':
				return __( 'Total number of pageviews of the past year.', 'burst-statistics' );
			case 'all_time':
				return __( 'Total number of pageviews, all time.', 'burst-statistics' );
			default:
				return __( 'Total number of pageviews of the past 30 days.', 'burst-statistics' );
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

		$timerange = $this->get_selected_timerange();
		$start     = $this->get_start_timestamp( $timerange );

		if ( $start > 0 ) {
			$join .= $wpdb->prepare(
				" LEFT JOIN (
	            SELECT page_id, COUNT(*) as pageview_count
	            FROM {$wpdb->prefix}burst_statistics
	            WHERE page_id > 0 AND page_type = %s AND time >= %d
	            GROUP BY page_id
	        ) burst_stats ON {$wpdb->posts}.ID = burst_stats.page_id",
				$current_post_type,
				$start
			);
		} else {
			// All time - no time restriction.
			$join .= $wpdb->prepare(
				" LEFT JOIN (
	            SELECT page_id, COUNT(*) as pageview_count
	            FROM {$wpdb->prefix}burst_statistics
	            WHERE page_id > 0 AND page_type = %s
	            GROUP BY page_id
	        ) burst_stats ON {$wpdb->posts}.ID = burst_stats.page_id",
				$current_post_type
			);
		}

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
	public function cleanup_pageviews_filters( array $posts, \WP_Query $query ): array {
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
