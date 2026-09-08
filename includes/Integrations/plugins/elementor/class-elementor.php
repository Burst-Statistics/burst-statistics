<?php
namespace Burst\Integrations\Plugins\Elementor;

use Burst\Frontend\Goals\Goal;
use Burst\Frontend\Goals\Goals;
use Burst\Traits\Admin_Helper;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

class Elementor {
	use Admin_Helper;

	/**
	 * Constructor / Initializer
	 */
	public function init(): void {
		// Register Burst Goal controls in Elementor's Advanced tab.
		add_action( 'elementor/element/common/_section_style/after_section_end', [ $this, 'add_burst_goals_controls' ], 10, 2 );
		add_action( 'elementor/element/section/section_advanced/after_section_end', [ $this, 'add_burst_goals_controls' ], 10, 2 );
		add_action( 'elementor/element/container/section_layout/after_section_end', [ $this, 'add_burst_goals_controls' ], 10, 2 );
		add_action( 'elementor/element/column/section_advanced/after_section_end', [ $this, 'add_burst_goals_controls' ], 10, 2 );

		// Inject data-burst-goal attribute into rendered element wrapper.
		add_action( 'elementor/frontend/before_render', [ $this, 'render_burst_goal_attribute' ] );

		// Enqueue Elementor editor integration script and localized settings.
		add_action( 'elementor/editor/after_enqueue_scripts', [ $this, 'enqueue_elementor_editor_assets' ] );

		// Synchronize goals to database when an Elementor document is saved.
		add_action( 'elementor/editor/after_save', [ $this, 'on_elementor_editor_after_save' ], 10, 2 );
		add_action( 'updated_post_meta', [ $this, 'on_updated_post_meta' ], 10, 4 );
		add_action( 'added_post_meta', [ $this, 'on_updated_post_meta' ], 10, 4 );
	}

	/**
	 * Get the list of Elementor widget types considered clickable for goal tracking.
	 * Allows developers/extensions to customize via the `burst_elementor_clickable_widgets` filter.
	 *
	 * @return array<int, string>
	 */
	public static function get_clickable_widgets(): array {
		$clickable_widgets = [
			'button',
			'icon',
			'icon-box',
			'image',
			'image-box',
			'call-to-action',
			'animated-headline',
			'price-table',
			'form',
			'nav-menu',
			'search-form',
		];

		/**
		 * Filter the list of Elementor widget names that support click goal tracking.
		 *
		 * @param array<int, string> $clickable_widgets Array of Elementor widget type names.
		 */
		return (array) apply_filters( 'burst_elementor_clickable_widgets', $clickable_widgets );
	}

	/**
	 * Determine if an Elementor element is considered clickable/interactive.
	 *
	 * @param string $element_name Element or widget type name.
	 */
	public static function is_clickable_element( string $element_name ): bool {
		if ( empty( $element_name ) ) {
			return false;
		}

		$clickable_list = self::get_clickable_widgets();
		if ( in_array( $element_name, $clickable_list, true ) ) {
			return true;
		}

		$lower = strtolower( $element_name );
		return strpos( $lower, 'button' ) !== false
			|| strpos( $lower, 'nav-link' ) !== false
			|| strpos( $lower, 'link' ) !== false
			|| strpos( $lower, 'cta' ) !== false
			|| strpos( $lower, 'icon' ) !== false
			|| strpos( $lower, 'image' ) !== false;
	}

	/**
	 * Add Burst Goals controls section to Elementor element's Advanced tab.
	 *
	 * @param \Elementor\Element_Base $element The Elementor element instance.
	 * @param array<string, mixed>    $args    Section arguments.
	 */
	public function add_burst_goals_controls( \Elementor\Element_Base $element, array $args = [] ): void {
		unset( $args );

		if ( ! $this->user_can_manage() ) {
			return;
		}

		$element->start_controls_section(
			'burst_goals_section',
			[
				'label' => __( 'Burst Goal', 'burst-statistics' ),
				'tab'   => \Elementor\Controls_Manager::TAB_ADVANCED,
			]
		);

		$element->add_control(
			'burst_goal_active',
			[
				'label'        => __( 'Track with a Burst Goal', 'burst-statistics' ),
				'type'         => \Elementor\Controls_Manager::SWITCHER,
				'label_on'     => __( 'Yes', 'burst-statistics' ),
				'label_off'    => __( 'No', 'burst-statistics' ),
				'return_value' => 'yes',
				'default'      => '',
			]
		);

		$element->add_control(
			'burst_goal_uid',
			[
				'type'    => \Elementor\Controls_Manager::HIDDEN,
				'default' => '',
			]
		);

		$element->add_control(
			'burst_goal_id',
			[
				'type'    => \Elementor\Controls_Manager::HIDDEN,
				'default' => 0,
			]
		);

		$element_name                   = $element->get_name();
		$is_section_container_or_column = in_array( $element_name, [ 'section', 'container', 'column' ], true );

		$type_options = $is_section_container_or_column
			? [ 'views' => __( 'Visibility (scrolled into view)', 'burst-statistics' ) ]
			: [
				'clicks' => __( 'Click (on user click)', 'burst-statistics' ),
				'views'  => __( 'Visibility (scrolled into view)', 'burst-statistics' ),
			];

		$element->add_control(
			'burst_goal_type',
			[
				'label'     => __( 'Goal trigger type', 'burst-statistics' ),
				'type'      => \Elementor\Controls_Manager::SELECT,
				'default'   => $is_section_container_or_column ? 'views' : 'clicks',
				'options'   => $type_options,
				'condition' => [
					'burst_goal_active' => 'yes',
				],
			]
		);

		$element->add_control(
			'burst_goal_title',
			[
				'label'       => __( 'Goal title', 'burst-statistics' ),
				'type'        => \Elementor\Controls_Manager::TEXT,
				'dynamic'     => [
					'active' => false,
				],
				'placeholder' => __( 'e.g. CTA Button click', 'burst-statistics' ),
				'condition'   => [
					'burst_goal_active' => 'yes',
				],
			]
		);

		$element->add_control(
			'burst_goal_metric',
			[
				'label'     => __( 'Conversion metric', 'burst-statistics' ),
				'type'      => \Elementor\Controls_Manager::SELECT,
				'default'   => 'visitors',
				'options'   => [
					'visitors'  => __( 'Visitors', 'burst-statistics' ),
					'sessions'  => __( 'Sessions', 'burst-statistics' ),
					'pageviews' => __( 'Pageviews', 'burst-statistics' ),
				],
				'condition' => [
					'burst_goal_active' => 'yes',
				],
			]
		);

		$element->add_control(
			'burst_goal_scope',
			[
				'label'     => __( 'Page scope', 'burst-statistics' ),
				'type'      => \Elementor\Controls_Manager::SELECT,
				'default'   => 'page',
				'options'   => [
					'page'    => __( 'Current page', 'burst-statistics' ),
					'website' => __( 'All pages', 'burst-statistics' ),
				],
				'condition' => [
					'burst_goal_active' => 'yes',
				],
			]
		);

		// Limit notice for Free version when goal limit is reached.
		$is_pro_valid = burst_license_is_valid();
		if ( ! $is_pro_valid ) {
			$element->add_control(
				'burst_goal_limit_notice',
				[
					'type'            => \Elementor\Controls_Manager::RAW_HTML,
					'raw'             => sprintf(
						'<div class="elementor-control-raw-html elementor-panel-alert elementor-panel-alert-warning" style="margin-top:10px;padding:10px;background:#fff3cd;border:1px solid #ffeeba;border-radius:4px;color:#856404;font-size:12px;">%s <a href="https://burst-statistics.com/pricing/?utm_source=elementor-editor&utm_medium=goals" target="_blank" style="color:#533f03;text-decoration:underline;font-weight:bold;">%s</a></div>',
						esc_html__( 'You have reached the limit of 3 active goals in the Free version.', 'burst-statistics' ),
						esc_html__( 'Upgrade to Pro', 'burst-statistics' )
					),
					'content_classes' => 'burst-goal-limit-notice',
					'condition'       => [
						'burst_goal_active' => 'yes',
					],
				]
			);
		}

		$element->end_controls_section();
	}

	/**
	 * Inject data-burst-goal attribute on the element wrapper in frontend render.
	 *
	 * @param \Elementor\Element_Base $element The Elementor element instance.
	 */
	public function render_burst_goal_attribute( \Elementor\Element_Base $element ): void {
		$settings = $element->get_settings_for_display();

		if ( empty( $settings['burst_goal_active'] ) || $settings['burst_goal_active'] !== 'yes' ) {
			return;
		}

		$uid = ! empty( $settings['burst_goal_uid'] ) ? sanitize_key( (string) $settings['burst_goal_uid'] ) : '';
		if ( empty( $uid ) ) {
			return;
		}

		$element->add_render_attribute( '_wrapper', 'data-burst-goal', esc_attr( $uid ) );
	}

	/**
	 * Enqueue the Burst Elementor Editor integration script and localized settings.
	 */
	public function enqueue_elementor_editor_assets(): void {
		if ( ! $this->user_can_manage() ) {
			return;
		}

		$handle    = 'burst-elementor-editor';
		$file      = 'burst-elementor-editor.js';
		$file_path = __DIR__ . '/' . $file;

		if ( ! file_exists( $file_path ) ) {
			return;
		}

		$src = plugins_url( $file, __FILE__ );

		wp_enqueue_script(
			$handle,
			$src,
			[
				'jquery',
				'wp-i18n',
				'wp-api-fetch',
			],
			(string) filemtime( $file_path ),
			true
		);

		// Localize settings for the Elementor editor script.
		global $wpdb;
		$goal_count         = 0;
		$all_block_goals    = [];
		$active_block_goals = [];
		$goals_list         = [];

		$table_name   = $wpdb->prefix . 'burst_goals';
		$table_exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table_name ) ) === $table_name;
		if ( $table_exists ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
			$goal_count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_goals WHERE status = 'active'" );

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
			$raw_goals = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}burst_goals", ARRAY_A );

			// Batch retrieve goals that have statistics to avoid N+1 queries.
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
			$goals_with_stats = $wpdb->get_col( "SELECT DISTINCT goal_id FROM {$wpdb->prefix}burst_goal_statistics" );
			$goals_with_stats = is_array( $goals_with_stats ) ? array_map( 'intval', $goals_with_stats ) : [];

			if ( is_array( $raw_goals ) ) {
				foreach ( $raw_goals as $g ) {
					$selector = $g['selector'];
					$uid      = str_replace( [ '[data-burst-goal="', '"]' ], '', $selector );
					$goal_id  = (int) $g['ID'];

					$has_data = in_array( $goal_id, $goals_with_stats, true );

					$page_id = isset( $g['page_id'] ) ? (int) $g['page_id'] : 0;
					if ( 0 === $page_id && ! empty( $g['url'] ) && '*' !== $g['url'] ) {
						static $url_to_post_id_cache = [];
						if ( ! isset( $url_to_post_id_cache[ $g['url'] ] ) ) {
							$url_to_post_id_cache[ $g['url'] ] = url_to_postid( home_url( $g['url'] ) );
						}
						$page_id = $url_to_post_id_cache[ $g['url'] ];
					}

					$goals_list[] = [
						'id'                => $goal_id,
						'title'             => $g['title'],
						'type'              => $g['type'],
						'status'            => $g['status'],
						'url'               => $g['url'],
						'conversion_metric' => $g['conversion_metric'],
						'selector'          => $g['selector'],
						'block_goal'        => (int) $g['block_goal'],
						'uid'               => $uid,
						'has_data'          => $has_data ? 1 : 0,
						'page_id'           => $page_id,
						'is_draft'          => ( $page_id > 0 ) ? ( get_post_status( $page_id ) !== 'publish' ) : false,
					];

					if ( (int) $g['block_goal'] === 1 && ! empty( $uid ) ) {
						$all_block_goals[] = $uid;
						if ( $g['status'] === 'active' ) {
							$active_block_goals[] = $uid;
						}
					}
				}
			}
		}

		$is_pro_valid = burst_license_is_valid();
		$goal_limit   = $is_pro_valid ? -1 : Goal::LIMIT_FREE;
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$post_id = isset( $_GET['post'] ) ? (int) $_GET['post'] : (int) get_the_ID();

		wp_localize_script(
			$handle,
			'burstElementorEditor',
			[
				'rest_url'               => get_rest_url(),
				'nonce'                  => wp_create_nonce( 'wp_rest' ),
				'burst_nonce'            => wp_create_nonce( 'burst_nonce' ),
				'user_can_manage'        => 1,
				'post_id'                => $post_id,
				'goal_count'             => $goal_count,
				'goal_limit'             => $goal_limit,
				'is_pro'                 => $is_pro_valid ? 1 : 0,
				'all_block_goal_uids'    => $all_block_goals,
				'active_block_goal_uids' => $active_block_goals,
				'goals'                  => $goals_list,
				'clickable_widgets'      => self::get_clickable_widgets(),
			]
		);

		wp_set_script_translations( $handle, 'burst-statistics', BURST_PATH . '/languages' );
	}

	/**
	 * Synchronize Elementor block goals when an editor document is saved.
	 *
	 * @param int                  $post_id     The ID of the saved post.
	 * @param array<string, mixed> $editor_data The saved editor payload.
	 */
	public function on_elementor_editor_after_save( int $post_id, array $editor_data ): void {
		$elements_data = [];
		if ( isset( $editor_data['elements'] ) && is_array( $editor_data['elements'] ) ) {
			$elements_data = $editor_data['elements'];
		} else {
			$raw_meta = get_post_meta( $post_id, '_elementor_data', true );
			if ( ! empty( $raw_meta ) ) {
				if ( is_string( $raw_meta ) ) {
					$decoded = json_decode( $raw_meta, true );
					if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $decoded ) ) {
						return;
					}
					$elements_data = $decoded;
				} elseif ( is_array( $raw_meta ) ) {
					$elements_data = $raw_meta;
				}
			}
		}

		$this->sync_elementor_goals_on_save( $post_id, $elements_data );
	}

	/**
	 * Listen to postmeta updates to synchronize goals when _elementor_data is saved directly.
	 *
	 * @param int    $meta_id    The ID of the updated postmeta.
	 * @param int    $post_id    The ID of the post.
	 * @param string $meta_key   The postmeta key.
	 * @param mixed  $meta_value The postmeta value.
	 */
	public function on_updated_post_meta( int $meta_id, int $post_id, string $meta_key, mixed $meta_value ): void {
		unset( $meta_id );
		if ( '_elementor_data' !== $meta_key || empty( $meta_value ) ) {
			return;
		}

		if ( is_string( $meta_value ) ) {
			$decoded = json_decode( $meta_value, true );
			if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $decoded ) ) {
				return;
			}
			$elements_data = $decoded;
		} elseif ( is_array( $meta_value ) ) {
			$elements_data = $meta_value;
		} else {
			return;
		}

		$this->sync_elementor_goals_on_save( $post_id, $elements_data );
	}

	/**
	 * Extract all Burst goal UIDs present in an Elementor element tree (regardless of active status).
	 *
	 * @param array<int|string, mixed> $elements Array of Elementor element arrays.
	 * @return array<string, bool> Map of UID => isActive flag.
	 */
	public function extract_all_uids_from_elements( array $elements ): array {
		$uids = [];

		foreach ( $elements as $element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}

			$settings  = isset( $element['settings'] ) && is_array( $element['settings'] ) ? $element['settings'] : [];
			$uid       = ! empty( $settings['burst_goal_uid'] ) ? sanitize_key( (string) $settings['burst_goal_uid'] ) : '';
			$is_active = isset( $settings['burst_goal_active'] ) && 'yes' === $settings['burst_goal_active'];

			if ( ! empty( $uid ) ) {
				$uids[ $uid ] = $is_active;
			}

			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				$child_uids = $this->extract_all_uids_from_elements( $element['elements'] );
				foreach ( $child_uids as $c_uid => $c_active ) {
					$uids[ $c_uid ] = $c_active;
				}
			}
		}

		return $uids;
	}

	/**
	 * Recursively replace an old Burst goal UID with a new UID in an Elementor elements tree.
	 *
	 * @param array<int|string, mixed> $elements Array of Elementor element arrays.
	 * @param string                   $old_uid  Old goal UID.
	 * @param string                   $new_uid  New goal UID.
	 * @return array<int|string, mixed>
	 */
	public function replace_element_goal_uid( array $elements, string $old_uid, string $new_uid ): array {
		foreach ( $elements as &$element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}

			if ( isset( $element['settings']['burst_goal_uid'] ) && $element['settings']['burst_goal_uid'] === $old_uid ) {
				$element['settings']['burst_goal_uid'] = $new_uid;
			}

			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				$element['elements'] = $this->replace_element_goal_uid( $element['elements'], $old_uid, $new_uid );
			}
		}
		unset( $element );

		return $elements;
	}

	/**
	 * Recursively extract all active Burst goal configurations from Elementor element tree.
	 *
	 * @param array<int|string, mixed> $elements Array of Elementor element arrays.
	 * @return array<string, array<string, mixed>> Map of UID => goal configuration.
	 */
	public function extract_goals_from_elements( array $elements ): array {
		$active_goals = [];

		foreach ( $elements as $element ) {
			if ( ! is_array( $element ) ) {
				continue;
			}

			$settings  = isset( $element['settings'] ) && is_array( $element['settings'] ) ? $element['settings'] : [];
			$is_active = isset( $settings['burst_goal_active'] ) && 'yes' === $settings['burst_goal_active'];
			$uid       = ! empty( $settings['burst_goal_uid'] ) ? sanitize_key( (string) $settings['burst_goal_uid'] ) : '';

			if ( $is_active && ! empty( $uid ) ) {
				$widget_type = isset( $element['widgetType'] ) && is_string( $element['widgetType'] )
					? $element['widgetType']
					: ( isset( $element['elType'] ) && is_string( $element['elType'] ) ? $element['elType'] : 'widget' );

				$is_clickable = self::is_clickable_element( $widget_type );

				$type = ! $is_clickable
					? 'views'
					: ( isset( $settings['burst_goal_type'] ) && is_string( $settings['burst_goal_type'] )
						? sanitize_text_field( $settings['burst_goal_type'] )
						: 'clicks' );

				$title = isset( $settings['burst_goal_title'] ) && is_string( $settings['burst_goal_title'] )
					? sanitize_text_field( $settings['burst_goal_title'] )
					: '';

				if ( empty( $title ) ) {
					$type_label = ( 'widget' !== $widget_type ) ? ucfirst( $widget_type ) : 'Element';
					$title      = sprintf(
						/* translators: 1: Element type, 2: Trigger type (click/visibility) */
						__( '%1$s %2$s', 'burst-statistics' ),
						$type_label,
						( 'clicks' === $type ? __( 'click', 'burst-statistics' ) : __( 'visibility', 'burst-statistics' ) )
					);
				}

				$metric = isset( $settings['burst_goal_metric'] ) && is_string( $settings['burst_goal_metric'] )
					? sanitize_text_field( $settings['burst_goal_metric'] )
					: 'visitors';

				$scope = isset( $settings['burst_goal_scope'] ) && is_string( $settings['burst_goal_scope'] )
					? sanitize_text_field( $settings['burst_goal_scope'] )
					: 'page';

				$active_goals[ $uid ] = [
					'uid'               => $uid,
					'title'             => $title,
					'type'              => $type,
					'conversion_metric' => $metric,
					'scope'             => $scope,
				];
			}

			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				$child_goals  = $this->extract_goals_from_elements( $element['elements'] );
				$active_goals = array_merge( $active_goals, $child_goals );
			}
		}

		return $active_goals;
	}

	/**
	 * Synchronize Elementor active goals with the burst_goals database table on post save.
	 *
	 * @param int                      $post_id       The ID of the saved post.
	 * @param array<int|string, mixed> $elements_data Array of Elementor elements.
	 */
	public function sync_elementor_goals_on_save( int $post_id, array $elements_data ): void {
		static $last_synced_hash = [];
		static $in_progress      = [];

		// Goals are written from client-controlled _elementor_data, so this is
		// a goal write path like the goals REST routes and needs the same
		// capability: manage_burst_statistics (user_can_manage() also admits
		// cron and WP-CLI for imports). Elementor's own save handler has
		// already verified its editor nonce and the edit_post capability
		// before the meta update fires; a Burst nonce cannot be attached to a
		// post-meta hook, so the capability check is the guard here.
		if ( ! $this->user_can_manage() ) {
			return;
		}

		if ( isset( $in_progress[ $post_id ] ) ) {
			return;
		}

		$current_hash = hash( 'sha256', (string) wp_json_encode( $elements_data ) );
		if ( isset( $last_synced_hash[ $post_id ] ) && $last_synced_hash[ $post_id ] === $current_hash ) {
			return;
		}

		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}

		global $wpdb;
		$table_name   = $wpdb->prefix . 'burst_goals';
		$table_exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table_name ) ) === $table_name;
		if ( ! $table_exists ) {
			return;
		}

		$in_progress[ $post_id ] = true;

		// Recursively extract all active Burst goals currently configured on the elements canvas.
		$active_goals = $this->extract_goals_from_elements( $elements_data );
		$all_doc_uids = $this->extract_all_uids_from_elements( $elements_data );

		$permalink = get_permalink( $post_id );
		$post_path = $permalink ? (string) wp_parse_url( $permalink, PHP_URL_PATH ) : '';

		$has_modified_elements = false;

		// 1. Upsert all active goals found in the elements tree.
		foreach ( $active_goals as $uid => $goal_data ) {
			$selector = sprintf( '[data-burst-goal="%s"]', $uid );
			$goal     = Goal::get_by_uid( $uid );

			if ( null !== $goal ) {
				$goal_page_id = (int) $goal->page_id;
				// If the found goal belongs to a DIFFERENT post (e.g. copied via Duplicate Post, WPML, importer),
				// do NOT steal the original goal. Instead, generate a fresh UID for this post's goal.
				if ( $goal_page_id > 0 && $goal_page_id !== $post_id ) {
					$new_uid      = 'burst-' . bin2hex( random_bytes( 4 ) );
					$new_selector = sprintf( '[data-burst-goal="%s"]', $new_uid );

					$new_goal                    = new Goal();
					$new_goal->title             = $goal_data['title'];
					$new_goal->type              = $goal_data['type'];
					$new_goal->conversion_metric = $goal_data['conversion_metric'];
					$new_goal->page_or_website   = $goal_data['scope'];
					$new_goal->page_id           = ( 'page' === $goal_data['scope'] ) ? $post_id : 0;
					$new_goal->url               = ( 'page' === $goal_data['scope'] ) ? $post_path : '*';
					$new_goal->selector          = $new_selector;
					$new_goal->status            = 'active';
					$new_goal->block_goal        = 1;

					if ( $new_goal->can_add_goal() ) {
						$new_goal->save();
					}

					$elements_data         = $this->replace_element_goal_uid( $elements_data, $uid, $new_uid );
					$has_modified_elements = true;
					continue;
				}

				// Update existing goal properties.
				$goal->title             = $goal_data['title'];
				$goal->type              = $goal_data['type'];
				$goal->conversion_metric = $goal_data['conversion_metric'];
				$goal->page_or_website   = $goal_data['scope'];
				$goal->page_id           = ( 'page' === $goal_data['scope'] ) ? $post_id : 0;
				$goal->url               = ( 'page' === $goal_data['scope'] ) ? $post_path : '*';
				$goal->status            = 'active';
				$goal->block_goal        = 1;
				$goal->save();
			} else {
				// Insert new goal.
				$new_goal                    = new Goal();
				$new_goal->title             = $goal_data['title'];
				$new_goal->type              = $goal_data['type'];
				$new_goal->conversion_metric = $goal_data['conversion_metric'];
				$new_goal->page_or_website   = $goal_data['scope'];
				$new_goal->page_id           = ( 'page' === $goal_data['scope'] ) ? $post_id : 0;
				$new_goal->url               = ( 'page' === $goal_data['scope'] ) ? $post_path : '*';
				$new_goal->selector          = $selector;
				$new_goal->status            = 'active';
				$new_goal->block_goal        = 1;

				if ( $new_goal->can_add_goal() ) {
					$new_goal->save();
				}
			}
		}

		if ( $has_modified_elements ) {
			// Update _elementor_data post meta with updated UIDs (safely guarded by $in_progress).
			update_post_meta( $post_id, '_elementor_data', wp_slash( wp_json_encode( $elements_data ) ) );
			$current_hash = hash( 'sha256', (string) wp_json_encode( $elements_data ) );
		}

		// 2. Clean up any block goals for this post or in this document that were deactivated or deleted.
		$selectors_to_check = [];
		foreach ( array_keys( $all_doc_uids ) as $doc_uid ) {
			$selectors_to_check[] = sprintf( '[data-burst-goal="%s"]', $doc_uid );
		}

		$existing_page_goals = [];
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$page_goals = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table_name} WHERE block_goal = 1 AND page_id = %d", $post_id ), ARRAY_A );
		if ( is_array( $page_goals ) ) {
			foreach ( $page_goals as $pg ) {
				$existing_page_goals[ (int) $pg['ID'] ] = $pg;
			}
		}

		if ( ! empty( $selectors_to_check ) ) {
			$placeholders = implode( ', ', array_fill( 0, count( $selectors_to_check ), '%s' ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.PreparedSQL.InterpolatedNotPrepared,WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
			$selector_goals = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table_name} WHERE block_goal = 1 AND selector IN ($placeholders)", ...$selectors_to_check ), ARRAY_A );
			if ( is_array( $selector_goals ) ) {
				foreach ( $selector_goals as $sg ) {
					$sg_page_id = isset( $sg['page_id'] ) ? (int) $sg['page_id'] : 0;
					if ( $sg_page_id > 0 && $sg_page_id !== $post_id ) {
						continue;
					}
					$existing_page_goals[ (int) $sg['ID'] ] = $sg;
				}
			}
		}

		if ( ! empty( $existing_page_goals ) ) {
			foreach ( $existing_page_goals as $g ) {
				$g_id  = (int) $g['ID'];
				$g_uid = '';
				if ( preg_match( '/data-burst-goal="([^"]+)"/', $g['selector'], $matches ) ) {
					$g_uid = $matches[1];
				}

				if ( empty( $g_uid ) || ! isset( $active_goals[ $g_uid ] ) ) {
					// Goal was removed or deactivated in Elementor.
					Goals::retire_goal_if_orphaned( $g_id );
				}
			}
		}

		unset( $in_progress[ $post_id ] );
		$last_synced_hash[ $post_id ] = $current_hash;

		do_action( 'burst_after_updated_goals' );
	}
}

// Instantiate and initialize the Elementor integration.
( new Elementor() )->init();
