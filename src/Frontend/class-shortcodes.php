<?php
namespace Burst\Frontend;

use Burst\Admin\Statistics\Query_Data;
use Burst\Traits\Helper;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Shortcodes
 *
 * This class handles the registration and processing of shortcodes
 * for displaying statistics on the frontend.
 *
 * @package Burst\Frontend
 * @since 2.1.0
 */
class Shortcodes {
	use Helper;

	/**
	 * Instance of Frontend_Statistics class
	 *
	 * @var Frontend_Statistics
	 */
	private Frontend_Statistics $statistics;

	/**
	 * Constructor
	 */
	public function init(): void {
		// Register old shortcode as deprecated but keep for backward compatibility.
		add_shortcode( 'burst-most-visited', [ $this, 'deprecated_most_visited_posts' ] );

		// Register the main statistics shortcode.
		add_shortcode( 'burst_statistics', [ $this, 'statistics_shortcode' ] );
		add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_burst_shortcodes_styles' ] );

		// Initialize statistics handler.
		$this->statistics = new Frontend_Statistics();
	}


	/**
	 * Register the shortcodes stylesheet and enqueue it when needed
	 */
	public function enqueue_burst_shortcodes_styles(): void {
		// Register the stylesheet but don't enqueue it yet.
		wp_register_style(
			'burst-statistics-shortcodes',
			BURST_URL . 'assets/css/shortcodes.css',
			[],
			filemtime( BURST_PATH . 'assets/css/shortcodes.css' )
		);

		// Add filters to detect our shortcodes and enqueue the style when needed.
		add_filter( 'the_content', [ $this, 'check_for_burst_shortcodes' ], 10, 1 );

		// Also check in widgets, Gutenberg blocks, etc.
		add_action( 'wp_footer', [ $this, 'maybe_enqueue_shortcode_styles' ], 10 );
	}

	/**
	 * Check content for Burst shortcodes
	 *
	 * @param string|null $content The post content.
	 * @return string The unmodified content
	 */
	public function check_for_burst_shortcodes( ?string $content ): string {
		if ( empty( $content ) ) {
			return $content;
		}

		if ( ! is_admin() &&
			(
				has_shortcode( $content, 'burst-most-visited' ) ||
				has_shortcode( $content, 'burst_statistics' )
			)
		) {
			$this->enqueue_shortcode_styles();
		}

		return $content;
	}

	/**
	 * Fallback check for shortcodes in widgets or other areas
	 */
	public function maybe_enqueue_shortcode_styles(): void {
		global $wp_query;

		// Check if we're on a singular post or page.
		if ( is_singular() ) {
			$post = $wp_query->get_queried_object();

			// Check post content for shortcodes.
			if ( $post && isset( $post->post_content ) && (
					has_shortcode( $post->post_content, 'burst-most-visited' ) ||
					has_shortcode( $post->post_content, 'burst_statistics' )
				) ) {
				$this->enqueue_shortcode_styles();
				return;
			}
		}

		// Check active widgets for shortcodes.
		$active_widgets = wp_get_sidebars_widgets();
		if ( is_array( $active_widgets ) ) {
			foreach ( $active_widgets as $sidebar_widgets ) {
				if ( ! is_array( $sidebar_widgets ) ) {
					continue;
				}

				foreach ( $sidebar_widgets as $widget ) {
					if ( strpos( $widget, 'text' ) !== false ) {
						// This is a text widget that might contain shortcodes.
						$this->enqueue_shortcode_styles();
						return;
					}
				}
			}
		}
	}

	/**
	 * Actually enqueue the shortcode styles
	 */
	private function enqueue_shortcode_styles(): void {
		wp_enqueue_style( 'burst-statistics-shortcodes' );
	}

	/**
	 * Deprecated shortcode (for backward compatibility)
	 * Shows a deprecation notice in admin and maps to the new syntax
	 */
	public function deprecated_most_visited_posts(
		array $atts = [],
		?string $content = null
	): string {
		// Show deprecation notice in admin.
		if ( is_admin() && current_user_can( 'manage_options' ) ) {
			_deprecated_function(
				'[burst-most-visited]',
				'1.5.0',
				'[burst_statistics type="most_visited"]'
			);
		}

		// Map old attributes to new format.
		$new_atts = [
			'type'       => 'most_visited',
			'limit'      => isset( $atts['count'] ) ? $atts['count'] : 5,
			'post_type'  => isset( $atts['post_type'] ) ? $atts['post_type'] : 'post',
			'show_count' => isset( $atts['show_count'] ) ? $atts['show_count'] : false,
		];

		// Use the new shortcode handler.
		return $this->statistics_shortcode( $new_atts, $content, 'burst_statistics' );
	}

	/**
	 * Main statistics shortcode
	 *
	 * @param array       $atts    Shortcode attributes.
	 * @param string|null $content Shortcode content.
	 * @param string      $tag     Shortcode tag.
	 * @return string Formatted output
	 */
	public function statistics_shortcode(
		array $atts = [],
		?string $content = null,
		string $tag = ''
	): string {
		// Ensure styles are enqueued.
		$this->enqueue_shortcode_styles();

		global $wpdb, $post;

		// Normalize attribute keys to lowercase.
		$atts = array_change_key_case( $atts, CASE_LOWER );

		// Default attributes.
		$atts = shortcode_atts(
			[
				'type'           => 'pageviews',
				'period'         => '30days',
				'post_id'        => '',
				'page_url'       => '',
				'object_type'    => 'post',
				'limit'          => 5,
				'format'         => 'number',
				'label'          => '',
				'empty_message'  => '',
				'cache_duration' => 3600,
				'start_date'     => '',
				'end_date'       => '',
				// For most_visited type.
				'show_count'     => false,
				// For most_visited type.
				'post_type'      => 'post',
			],
			$atts,
			$tag
		);

		// Sanitize all text-based attributes using WordPress functions.
		$atts['type']          = sanitize_key( $atts['type'] );
		$atts['period']        = sanitize_key( $atts['period'] );
		$atts['post_id']       = sanitize_text_field( $atts['post_id'] );
		$atts['object_type']   = sanitize_key( $atts['object_type'] );
		$atts['format']        = sanitize_key( $atts['format'] );
		$atts['label']         = sanitize_text_field( $atts['label'] );
		$atts['empty_message'] = sanitize_text_field( $atts['empty_message'] );
		$atts['post_type']     = sanitize_key( $atts['post_type'] );

		// Sanitize numeric attributes.
		$atts['limit']          = absint( $atts['limit'] );
		$atts['cache_duration'] = absint( $atts['cache_duration'] );

		// Sanitize boolean attributes.
		$atts['show_count'] = rest_sanitize_boolean( $atts['show_count'] );

		// Validate post type.
		if ( ! in_array( $atts['post_type'], get_post_types(), true ) ) {
			$atts['post_type'] = 'post';
		}

		// Validate date formats using WordPress sanitization.
		if ( ! empty( $atts['start_date'] ) ) {
			$atts['start_date'] = sanitize_text_field( $atts['start_date'] );
			if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $atts['start_date'] ) ) {
				$atts['start_date'] = '';
			}
		}

		if ( ! empty( $atts['end_date'] ) ) {
			$atts['end_date'] = sanitize_text_field( $atts['end_date'] );
			if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $atts['end_date'] ) ) {
				$atts['end_date'] = '';
			}
		}

		// Handle special case for most_visited (replaces the old burst-most-visited shortcode).
		if ( $atts['type'] === 'most_visited' ) {
			return $this->render_most_visited_posts(
				(int) $atts['limit'],
				$atts['post_type'],
				filter_var( $atts['show_count'], FILTER_VALIDATE_BOOLEAN )
			);
		}

		// Handle page_url and post_id parameters.
		$page_url_filter = '';
		if ( ! empty( $atts['page_url'] ) ) {
			// Sanitize page_url using WordPress functions.
			$page_url = sanitize_text_field( $atts['page_url'] );

			// Ensure it's a valid relative URL path.
			$page_url = wp_parse_url( $page_url, PHP_URL_PATH );
			if ( ! empty( $page_url ) ) {
				$page_url_filter = $page_url;
			}
		} elseif ( $atts['post_id'] === 'current' && is_object( $post ) ) {
			// Get page URL for current post.
			$page_url_filter = str_replace( home_url(), '', get_permalink( $post->ID ) );
		} elseif ( is_numeric( $atts['post_id'] ) && (int) $atts['post_id'] > 0 ) {
			// Get page URL for specific post ID.
			$page_url_filter = str_replace( home_url(), '', get_permalink( (int) $atts['post_id'] ) );
		}

		// Get date range based on period (now includes normalization for consistent caching).
		$date_range = $this->statistics->get_date_range( $atts['period'], $atts['start_date'], $atts['end_date'] );
		$start      = $date_range['start'];
		$end        = $date_range['end'];

		// Create a consistent cache key including all parameters that affect output.
		$cache_data = [
			'atts'           => $atts,
			'page_url'       => $page_url_filter,
			'date_range'     => $date_range,
			'plugin_version' => defined( 'BURST_VERSION' ) ? BURST_VERSION : '1.0',
		];

		$cache_key     = 'burst_stats_' . crc32( wp_json_encode( $cache_data ) );
		$cached_output = get_transient( $cache_key );
		// @phpstan-ignore-next-line booleanAnd.rightAlwaysTrue
		if ( false !== $cached_output && ! ( defined( 'WP_DEBUG' ) && WP_DEBUG ) ) {
			return $cached_output;
		}

		// Initialize variables.
		$output   = '';
		$result   = null;
		$select   = [];
		$filters  = [];
		$group_by = '';
		$order_by = '';
		$limit    = (int) $atts['limit'];

		// Set up query parameters based on type.
		switch ( $atts['type'] ) {
			case 'pageviews':
			case 'visitors':
			case 'sessions':
			case 'bounce_rate':
			case 'avg_time_on_page':
			case 'first_time_visitors':
			case 'conversions':
				$select = [ $atts['type'] ];
				if ( ! empty( $page_url_filter ) ) {
					$filters['page_url'] = $page_url_filter;
				}
				break;

			case 'top_pages':
				$select   = [ 'pageviews', 'page_url' ];
				$group_by = 'page_url';
				$order_by = 'pageviews DESC';
				break;

			case 'top_referrers':
				$select   = [ 'pageviews', 'referrer' ];
				$group_by = 'referrer';
				$order_by = 'pageviews DESC';
				break;

			case 'device_breakdown':
				$select   = [ 'pageviews', 'device' ];
				$group_by = 'device_id';
				$order_by = 'pageviews DESC';
				if ( ! empty( $page_url_filter ) ) {
					$filters['page_url'] = $page_url_filter;
				}
				break;

			default:
				// Allow custom types via filter.
				$custom_query = apply_filters( 'burst_statistics_shortcode_custom_type', false, $atts, $start, $end );
				if ( $custom_query !== false && is_string( $custom_query ) ) {
					return wp_kses_post( $custom_query );
				}
				return esc_html__( 'Invalid statistic type', 'burst-statistics' );
		}

		// Allow modification of query parameters.
		$query_args = apply_filters(
			'burst_statistics_shortcode_query_args',
			[
				'select'   => $select,
				'filters'  => $filters,
				'group_by' => $group_by,
				'order_by' => $order_by,
				'limit'    => $limit,
			],
			$atts
		);

		try {
			$qd = new Query_Data(
				[
					'date_start' => $start,
					'date_end'   => $end,
					'select'     => $query_args['select'],
					'filters'    => $query_args['filters'],
					'group_by'   => $query_args['group_by'],
					'order_by'   => $query_args['order_by'],
					'limit'      => $query_args['limit'],
				]
			);
			// Use our frontend statistics query builder.
			$sql = $this->statistics->generate_statistics_query( $qd );

			// Execute query based on type.
			if ( in_array( $atts['type'], [ 'top_pages', 'top_referrers', 'device_breakdown' ], true ) ) {
				// List-type data.
				$results = $wpdb->get_results( $sql, ARRAY_A );
				$output  = $this->render_list_type_results( $results, $atts );
			} else {
				// Single value data.
				$result = $wpdb->get_row( $sql, ARRAY_A );
				$output = $this->render_single_value_result( $result, $atts );
			}
		} catch ( \Exception $e ) {
			$output = '<p class="burst-statistics-error">' . esc_html__( 'Error fetching statistics', 'burst-statistics' ) . '</p>';
		}

		// Allow output modification via filter.
		$filtered_output = apply_filters( 'burst_statistics_shortcode_output', $output, $result, $atts );
		if ( is_string( $filtered_output ) ) {
			// Ensure filtered output is safe HTML.
			$output = wp_kses_post( $filtered_output );
		}

		// Cache the result.
		if ( ! empty( $output ) && (int) $atts['cache_duration'] > 0 ) {
			set_transient( $cache_key, $output, (int) $atts['cache_duration'] );
		}

		return $output;
	}

	/**
	 * Render list-type results (top pages, top referrers, device breakdown)
	 *
	 * @param array $results The query results.
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output
	 */
	private function render_list_type_results( array $results, array $atts ): string {
		if ( empty( $results ) ) {
			return ! empty( $atts['empty_message'] )
				? '<p class="burst-statistics-empty">' . esc_html( $atts['empty_message'] ) . '</p>'
				: '';
		}

		$output = '<ul class="burst-statistics-list burst-statistics-' . esc_attr( $atts['type'] ) . '">';

		// Calculate total for percentage calculations (for device_breakdown).
		$total_pageviews = 0;
		if ( $atts['type'] === 'device_breakdown' ) {
			foreach ( $results as $item ) {
				$total_pageviews += (int) $item['pageviews'];
			}
		}

		foreach ( $results as $item ) {
			$label = '';
			$value = '';

			if ( $atts['type'] === 'top_pages' ) {
				// Clean up page URL for display.
				$url   = $item['page_url'];
				$title = $url;

				// Try to get post title if it's a WordPress post/page.
				$post_id = url_to_postid( home_url( $url ) );
				if ( $post_id > 0 ) {
					$title = get_the_title( $post_id );
				} elseif ( $url === '/' ) {
					$title = __( 'Homepage', 'burst-statistics' );
				}

				$label = $title;
				$value = number_format_i18n( $item['pageviews'] );
			} elseif ( $atts['type'] === 'top_referrers' ) {
				$label = ! empty( $item['referrer'] ) ? $item['referrer'] : __( 'Direct', 'burst-statistics' );
				$value = number_format_i18n( $item['pageviews'] );
			} elseif ( $atts['type'] === 'device_breakdown' ) {
				// Get device name - handle both lookup table and direct storage modes.
				if ( isset( $item['device_id'] ) ) {
					// Using lookup tables - get device name by ID.
					$device_name = $this->statistics->get_device_name_by_id( (int) $item['device_id'] );
				} else {
					// Direct storage mode - device name is directly in the result.
					$device_name = $item['device'] ?? '';
				}

				// If device name is empty, default to 'other'.
				if ( empty( $device_name ) ) {
					$device_name = 'other';
				}

				// Map device types to human-readable names.
				$device_labels = [
					'desktop' => __( 'Desktop', 'burst-statistics' ),
					'tablet'  => __( 'Tablet', 'burst-statistics' ),
					'mobile'  => __( 'Mobile', 'burst-statistics' ),
					'other'   => __( 'Other', 'burst-statistics' ),
				];

				$device = strtolower( $device_name );
				$label  = isset( $device_labels[ $device ] ) ? $device_labels[ $device ] : esc_html( ucfirst( $device ) );

				// Calculate percentage.
				$pageviews  = (int) $item['pageviews'];
				$percentage = $total_pageviews > 0 ? round( ( $pageviews / $total_pageviews ) * 100, 1 ) : 0;
				$value      = $percentage . '%';
			}

			$output .= '<li class="burst-statistics-item">';
			$output .= '<span class="burst-statistics-label">' . esc_html( $label ) . '</span>';
			$output .= '<span class="burst-statistics-value">' . esc_html( $value ) . '</span>';
			$output .= '</li>';
		}

		$output .= '</ul>';

		return $output;
	}

	/**
	 * Render single value result
	 *
	 * @param array|null $result The query result.
	 * @param array      $atts Shortcode attributes.
	 * @return string HTML output
	 */
	private function render_single_value_result( ?array $result, array $atts ): string {
		if ( $result === null || ! isset( $result[ $atts['type'] ] ) ) {
			return ! empty( $atts['empty_message'] )
				? '<p class="burst-statistics-empty">' . esc_html( $atts['empty_message'] ) . '</p>'
				: '';
		}

		$value           = $result[ $atts['type'] ];
		$formatted_value = $this->format_statistic_value( $atts['type'], $value );

		// Apply format.
		if ( $atts['format'] === 'text' ) {
			// Get metric labels from our Frontend_Statistics class.
			$metric_labels = $this->statistics->get_metric_labels();
			$metric_label  = isset( $metric_labels[ $atts['type'] ] ) ? $metric_labels[ $atts['type'] ] : '';
			$output        = sprintf(
				'<p class="burst-statistics-text burst-statistics-%s">%s: %s</p>',
				esc_attr( $atts['type'] ),
				esc_html( $metric_label ),
				esc_html( $formatted_value )
			);
		} else {
			// Default number format.
			$output = sprintf(
				'<p class="burst-statistics-number burst-statistics-%s">%s</p>',
				esc_attr( $atts['type'] ),
				esc_html( $formatted_value )
			);
		}

		// Add label if provided.
		if ( ! empty( $atts['label'] ) ) {
			$output = sprintf(
				'<p class="burst-statistics-custom-label">%s</p> %s',
				esc_html( $atts['label'] ),
				$output
			);
		}

		return $output;
	}

	/**
	 * Format a statistic value based on its type.
	 *
	 * @param string $type  The statistic type.
	 * @param string $value The raw value from database query.
	 * @return string Formatted value.
	 */
	private function format_statistic_value( string $type, string $value ): string {
		switch ( $type ) {
			case 'avg_time_on_page':
				// Convert milliseconds to seconds and format.
				$seconds = (int) round( (float) $value / 1000 );

				// Translators: %s is the number of seconds a visitor spent on page.
				return sprintf(
					/* translators: %s: number of seconds */
					_n( '%s second', '%s seconds', $seconds, 'burst-statistics' ),
					number_format_i18n( $seconds )
				);

			case 'bounce_rate':
				return number_format_i18n( (float) $value, 1 ) . '%';

			default:
				return number_format_i18n( (float) $value );
		}
	}

	/**
	 * Render most visited posts (extracted from deprecated shortcode)
	 *
	 * @param int    $count Number of posts to show.
	 * @param string $post_type Post type to query.
	 * @param bool   $show_count Whether to show the view count.
	 * @return string HTML output
	 */
	private function render_most_visited_posts( int $count = 5, string $post_type = 'post', bool $show_count = false ): string {
		// Validate post type.
		if ( ! in_array( $post_type, get_post_types(), true ) ) {
			$post_type = 'post';
		}

		// Get most viewed posts from the Frontend_Statistics class.
		$most_viewed_posts = $this->statistics->get_most_viewed_posts( $count, $post_type );
		ob_start();

		if ( count( $most_viewed_posts ) > 0 ) {
			?>
			<ul class="burst-posts-list">
				<?php
				foreach ( $most_viewed_posts as $data ) {
					$post       = $data['post'];
					$count      = $data['views'];
					$count_html = '';
					if ( $show_count ) {
						$count_html = '&nbsp;<span class="burst-post-count">' . esc_html( apply_filters( 'burst_most_visited_count', $count, $post ) ) . '</span>';
					}
					?>

					<li class="burst-posts-list__item"><a href="<?php echo esc_url( get_the_permalink( $post ) ); ?>"><?php echo esc_html( get_the_title( $post ) ); ?><?php echo wp_kses_post( $count_html ); ?></a></li>
				<?php } ?>
			</ul>
			<?php
		} else {
			?>
			<p class="burst-posts-list__not-found">
				<?php esc_html_e( 'No posts found', 'burst-statistics' ); ?>
			</p>
			<?php
		}
		$output = ob_get_clean();
		return $output ?: '';
	}
}
