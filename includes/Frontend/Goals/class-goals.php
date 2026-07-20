<?php
namespace Burst\Frontend\Goals;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Sanitize;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

class Goals {
	use Helper;
	use Admin_Helper;
	use Database_Helper;
	use Sanitize;

	private array $orderby_columns = [];

	/**
	 * Constructor
	 */
	public function init(): void {
		add_action( 'save_post', [ $this, 'update_goal_urls_on_post_save' ], 10, 3 );
	}

	/**
	 * Sanitize the orderby parameter.
	 */
	public function sanitize_orderby( string $orderby ): string {
		global $wpdb;

		// Get all columns from {$wpdb->prefix}burst_goals table.
		if ( empty( $this->orderby_columns ) ) {
			$cols                  = $wpdb->get_results( "SHOW COLUMNS FROM {$wpdb->prefix}burst_goals", ARRAY_A );
			$this->orderby_columns = array_column( $cols, 'Field' );
		}

		// If $orderby is not in $col_names, set it to 'ID'.
		if ( ! in_array( $orderby, $this->orderby_columns, true ) ) {
			$orderby = 'ID';
		}

		return $orderby;
	}

	/**
	 *  Get predefined goals from the integrations list.
	 *
	 *  @param bool $skip_active_check Whether to skip checking if the plugin is active.
	 *  @return array<int, array{
	 *      id: string,
	 *      type: string,
	 *      description: string,
	 *      status: string,
	 *      server_side: bool,
	 *      url: string,
	 *      hook: string
	 *  }>
	 */
	public function get_predefined_goals( bool $skip_active_check = false ): array {
		if ( isset( \Burst\burst_loader()->integrations ) ) {
			\Burst\burst_loader()->integrations->load_translations();
		}
		$predefined_goals = [];
		foreach ( \Burst\burst_loader()->integrations->integrations as $plugin => $details ) {
			if ( ! isset( $details['goals'] ) ) {
				continue;
			}

			if ( ! $skip_active_check && ! \Burst\burst_loader()->integrations->plugin_is_active( $plugin ) ) {
				continue;
			}

			$predefined_goals = array_merge( $details['goals'], $predefined_goals );
		}
		return $predefined_goals;
	}

	/**
	 * Get list of goals
	 *
	 * @param array $args Optional arguments for filtering and pagination.
	 * @return Goal[] Array of Goal objects.
	 */
	public function get_goals( array $args = [] ): array {
		global $wpdb;
		try {
			$default_args = [
				'status'     => 'all',
				'limit'      => 9999,
				'offset'     => 0,
				'orderby'    => 'ID',
				'order'      => 'ASC',
				'date_start' => -1,
				'date_end'   => time(),
			];

			// merge args.
			$args = wp_parse_args( $args, $default_args );

			// sanitize args.
			$args['order']      = $args['order'] === 'DESC' ? 'DESC' : 'ASC';
			$args['orderby']    = $this->sanitize_orderby( $args['orderby'] );
			$args['status']     = $this->sanitize_status( $args['status'] );
			$args['limit']      = (int) $args['limit'];
			$args['offset']     = (int) $args['offset'];
			$args['date_start'] = (int) $args['date_start'];
			$args['date_end']   = (int) $args['date_end'];

			$where = [];

			if ( -1 !== $args['date_start'] ) {
				$where[] = $wpdb->prepare(
					'date_created >= %d',
					$args['date_start']
				);
			}

			if ( $args['date_end'] > 0 ) {
				$where[] = $wpdb->prepare(
					'date_created <= %d',
					$args['date_end']
				);
			}

			if ( 'all' !== $args['status'] ) {
				$where[] = $wpdb->prepare(
					'status = %s',
					$args['status']
				);
			}

			$where_sql = '';
			if ( ! empty( $where ) ) {
				$where_sql = 'WHERE ' . implode( ' AND ', $where );
			}

			$results = $wpdb->get_results(
				$wpdb->prepare(
					// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- $where_sql is constructed safely above.
					"SELECT * FROM {$wpdb->prefix}burst_goals $where_sql ORDER BY %s %s LIMIT %d, %d",
					esc_sql( $args['orderby'] ),
					esc_sql( $args['order'] ),
					$args['offset'],
					$args['limit']
				),
				ARRAY_A
			);

		} catch ( \Exception $e ) {
			self::error_log( $e->getMessage() );
			return [];
		}

		$goals = array_reduce(
			$results,
			static function ( $accumulator, $current_value ) {
				$id = $current_value['ID'];
				unset( $current_value['ID'] );
				$accumulator[ $id ] = $current_value;
				return $accumulator;
			},
			[]
		);

		// loop through goals and add the fields and get then object for each goal.
		$objects = [];
		foreach ( $goals as $goal_id => $goal_item ) {
			$goal      = new Goal( $goal_id );
			$objects[] = $goal;
		}

		return $objects;
	}

	/**
	 * Update goal URLs in the database when a post is saved and its slug/URL changes.
	 *
	 * @param int      $post_id The ID of the post.
	 * @param \WP_Post $post    The post object.
	 * @param bool     $update  Whether this is an update of an existing post.
	 */
	public function update_goal_urls_on_post_save( int $post_id, \WP_Post $post, bool $update ): void {
		unset( $update );

		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}

		if ( $post->post_status !== 'publish' && $post->post_status !== 'draft' && $post->post_status !== 'pending' && $post->post_status !== 'private' && $post->post_status !== 'future' ) {
			return;
		}

		$permalink = get_permalink( $post_id );
		if ( ! $permalink ) {
			return;
		}
		$new_url = wp_parse_url( $permalink, PHP_URL_PATH );
		if ( empty( $new_url ) ) {
			return;
		}

		global $wpdb;
		$table_name   = $wpdb->prefix . 'burst_goals';
		$table_exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table_name ) ) === $table_name;
		if ( ! $table_exists ) {
			return;
		}

		// 1. Update the URL of any goals on this page.
		$wpdb->update(
			$table_name,
			[ 'url' => $new_url ],
			[ 'page_id' => $post_id ],
			[ '%s' ],
			[ '%d' ]
		);

		// 2. Perform a post-save cleanup of block goals on this page.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$block_goals = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table_name} WHERE block_goal = 1 AND page_id = %d", $post_id ), ARRAY_A );
		if ( ! empty( $block_goals ) ) {
			foreach ( $block_goals as $goal ) {
				$goal_id = (int) $goal['ID'];
				$uid     = '';
				if ( preg_match( '/data-burst-goal="([^"]+)"/', $goal['selector'], $matches ) ) {
					$uid = $matches[1];
				}
				if ( empty( $uid ) ) {
					continue;
				}

				// If the goal's unique ID is no longer present in the post content, clean it up.
				if ( strpos( $post->post_content, $uid ) === false ) {
					// Check if this goal has statistics.
					// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
					$has_data = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_goal_statistics WHERE goal_id = %d", $goal_id ) ) > 0;

					if ( ! $has_data ) {
						// Delete goal completely if it has no stats.
						$goal_obj = new Goal( $goal_id );
						$goal_obj->delete();
					} elseif ( $goal['status'] !== 'inactive' ) {
						// Otherwise deactivate it to preserve stats.
						// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
						$wpdb->update( $table_name, [ 'status' => 'inactive' ], [ 'ID' => $goal_id ], [ '%s' ], [ '%d' ] );
						wp_cache_delete( 'burst_goal_' . $goal_id, 'burst' );
					}
				}
			}
		}

		// Ensure updates are synchronized.
		do_action( 'burst_after_updated_goals' );
	}
}
