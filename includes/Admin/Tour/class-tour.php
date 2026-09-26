<?php
namespace Burst\Admin\Tour;

use Burst\Admin\Mailer\Mailer;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Sanitize;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;
use function Burst\burst_loader;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Tour
 *
 * Manages interactive dashboard and feature tours, localized tour configuration,
 * dynamic mock data injection for real-time interactivity, and reminder cron jobs.
 */
class Tour {
	use Admin_Helper;
	use Helper;
	use Sanitize;

	/**
	 * Meta key for storing completed feature tour IDs for a user.
	 */
	public const COMPLETED_TOURS_META_KEY = 'burst_completed_tours';

	/**
	 * Meta key for tracking whether a user started a tour.
	 */
	public const TOUR_STARTED_META_KEY = 'burst_tour_started';

	/**
	 * Meta key for tracking whether a user dismissed the tour.
	 */
	public const TOUR_DISMISSED_META_KEY = 'burst_tour_dismissed';

	/**
	 * Meta key for tracking tour reminder email status.
	 */
	public const REMINDER_SENT_META_KEY = 'burst_tour_reminder_sent';

	/**
	 * Meta key for tracking last section reached by user.
	 */
	public const LAST_SECTION_META_KEY = 'burst_tour_last_section';

	/**
	 * Meta key for tracking whether the tour has been completed.
	 */
	public const TOUR_COMPLETED_META_KEY = 'burst_tour_completed';

	/**
	 * Meta key for tracking whether the tour is currently active.
	 */
	public const TOUR_ACTIVE_META_KEY = 'burst_tour_active';

	/**
	 * Initialize tour hooks.
	 */
	public function init(): void {
		add_filter( 'burst_do_action', [ $this, 'handle_do_action' ], 10, 3 );
		add_filter( 'burst_get_action', [ $this, 'handle_get_action' ], 10, 3 );
		add_filter( 'burst_localize_script', [ $this, 'maybe_localize_tour_data' ], 20, 1 );
		add_filter( 'burst_field', [ $this, 'reset_field_in_tour' ], 20, 1 );
		add_filter( 'rest_pre_dispatch', [ $this, 'intercept_tour_mutations' ], 10, 3 );
		// The admin-ajax fallback (REST API blocked) dispatches Burst actions
		// without rest_pre_dispatch; it fires this filter with the same
		// signature so tour mode mocks those writes as well.
		add_filter( 'burst_ajax_fallback_pre_dispatch', [ $this, 'intercept_tour_mutations' ], 10, 3 );
		add_action( 'burst_tour_reminder_cron', [ $this, 'send_tour_reminder_email' ], 10, 1 );
		add_action( 'burst_onboarding_completed', [ $this, 'schedule_tour_reminder' ], 10, 1 );
		add_action( 'update_option_burst_completed_onboarding', [ $this, 'schedule_tour_reminder' ], 10, 0 );
		add_action( 'add_option_burst_completed_onboarding', [ $this, 'schedule_tour_reminder' ], 10, 0 );
		add_filter( 'burst_fields', [ $this, 'add_settings_field' ] );
		add_filter( 'burst_tasks', [ $this, 'add_tour_task' ] );
		add_action( 'burst_onboarding_completed', [ $this, 'schedule_tour_task_validation' ], 10, 0 );
		add_action( 'update_option_burst_completed_onboarding', [ $this, 'schedule_tour_task_validation' ], 10, 0 );
	}

	/**
	 * Check whether the tour is currently requested via URL parameter.
	 */
	public static function is_tour_requested(): bool {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return isset( $_GET['tour'] );
	}

	/**
	 * Check whether the site runs as a demo environment (WordPress Playground blueprint).
	 *
	 * In demo mode the mock data stays active after the tour ends, because the
	 * environment has no real statistics to fall back on.
	 */
	public static function is_demo_mode(): bool {
		return defined( 'BURST_BLUEPRINT' );
	}

	/**
	 * Get the active tour identifier from the request.
	 */
	public function get_requested_tour_id(): string {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$tour = isset( $_GET['tour'] ) ? sanitize_text_field( wp_unslash( $_GET['tour'] ) ) : '';
		if ( '' === $tour || '1' === $tour || 'true' === $tour ) {
			return 'dashboard';
		}
		return $tour;
	}

	/**
	 * Localize tour data into `burst_settings` if the tour parameter is present.
	 *
	 * @param array<string, mixed> $data Localized data array.
	 * @return array<string, mixed>
	 */
	public function maybe_localize_tour_data( array $data ): array {
		$user_id = get_current_user_id();

		if ( ! self::is_tour_requested() ) {
			// The tour keeps ?tour in the url while it runs, so a dashboard load
			// without it means no tour is running. Clear the server-side flag:
			// left set after an abandoned tour (tab closed mid-tour), it would
			// keep intercept_tour_mutations() answering every Burst mutation
			// with a mocked success. Resuming sets it again (tour_steps, tour_resume).
			if ( 0 !== $user_id && $this->is_user_tour_active( $user_id ) ) {
				delete_user_meta( $user_id, self::TOUR_ACTIVE_META_KEY );
			}
		} else {
			$this->get_requested_tour_id();

			// Tour state and the "take the tour" task are written for users who
			// manage Burst only: the share page localizes this data for the
			// viewer role as well, and ?tour on a share url must not dismiss the
			// site's task or write meta.
			if ( 0 !== $user_id && $this->user_can_manage() ) {
				// Mark tour as started for the user so reminder emails are avoided.
				update_user_meta( $user_id, self::TOUR_STARTED_META_KEY, time() );
				update_user_meta( $user_id, self::TOUR_ACTIVE_META_KEY, 1 );
				burst_loader()->admin->tasks->dismiss_task( 'interactive_tour' );
			}

			// Reset all localized setting fields to their clean defaults during tour.
			if ( isset( $data['fields'] ) && is_array( $data['fields'] ) ) {
				foreach ( $data['fields'] as &$field ) {
					if ( isset( $field['default'] ) ) {
						$field['value'] = $field['default'];
					}
				}
				unset( $field );
			}

			// Clear pinned filters during tour.
			$data['pinned_filters'] = [];

			// Mock community benchmark statistics for the tour.
			$data['community_data'] = [
				'sample_size'             => 1500,
				'insufficient_data'       => false,
				'bounce_rate'             => [
					'percentiles' => [
						'p5'  => 18.0,
						'p10' => 22.0,
						'p25' => 30.0,
						'p50' => 38.0,
						'p75' => 48.0,
						'p90' => 58.0,
						'p95' => 68.0,
					],
				],
				'average_time_on_page'    => [
					'percentiles' => [
						'p5'  => 30,
						'p10' => 45,
						'p25' => 75,
						'p50' => 120,
						'p75' => 180,
						'p90' => 240,
						'p95' => 300,
					],
				],
				'pageviews_per_session'   => [
					'percentiles' => [
						'p5'  => 1.1,
						'p10' => 1.3,
						'p25' => 1.8,
						'p50' => 2.4,
						'p75' => 3.2,
						'p90' => 4.5,
						'p95' => 5.5,
					],
				],
				'time_per_session'        => [
					'percentiles' => [
						'p5'  => 25,
						'p10' => 45,
						'p25' => 85,
						'p50' => 150,
						'p75' => 220,
						'p90' => 310,
						'p95' => 380,
					],
				],
				'new_visitors_percentage' => [
					'average' => 64.2,
				],
				'devices'                 => [
					'desktop' => 62.5,
					'mobile'  => 33.0,
					'tablet'  => 4.5,
					'other'   => 0.0,
				],
			];

		}

		$is_tour_active = self::is_tour_requested();
		$tour_id        = $is_tour_active ? $this->get_requested_tour_id() : 'dashboard';

		$is_demo_mode = self::is_demo_mode();

		$data['tour'] = [
			'active'             => $is_tour_active,
			'tour_id'            => $tour_id,
			'steps'              => $is_tour_active ? $this->get_tour_steps( $tour_id ) : [],
			'completed_features' => $this->get_completed_features( $user_id ),
			'mock_data_enabled'  => $is_tour_active || $is_demo_mode,
			'demo_mode'          => $is_demo_mode,
			'last_section'       => $this->get_last_section( $user_id ),
			'completed'          => $this->is_tour_completed( $user_id ),
		];

		return $data;
	}

	/**
	 * Get completed feature tour identifiers for a given user.
	 *
	 * @param int $user_id User ID.
	 * @return string[]
	 */
	public function get_completed_features( int $user_id ): array {
		if ( 0 === $user_id ) {
			return [];
		}

		$completed = get_user_meta( $user_id, self::COMPLETED_TOURS_META_KEY, true );
		return is_array( $completed ) ? array_values( array_unique( $completed ) ) : [];
	}

	/**
	 * Mark a feature tour as completed for a user.
	 *
	 * @param string $feature_id Feature identifier.
	 * @param int    $user_id    User ID.
	 * @return string[] Updated completed features list.
	 */
	public function mark_feature_completed( string $feature_id, int $user_id = 0 ): array {
		if ( 0 === $user_id ) {
			$user_id = get_current_user_id();
		}

		if ( 0 === $user_id ) {
			return [];
		}

		$completed = $this->get_completed_features( $user_id );
		if ( ! in_array( $feature_id, $completed, true ) ) {
			$completed[] = $feature_id;
			update_user_meta( $user_id, self::COMPLETED_TOURS_META_KEY, $completed );
		}

		return $completed;
	}

	/**
	 * Check if a tour is currently marked active server-side for a user.
	 *
	 * @param int $user_id User ID.
	 */
	public function is_user_tour_active( int $user_id = 0 ): bool {
		if ( 0 === $user_id ) {
			$user_id = get_current_user_id();
		}

		if ( 0 === $user_id ) {
			return false;
		}

		return (bool) get_user_meta( $user_id, self::TOUR_ACTIVE_META_KEY, true );
	}

	/**
	 * Get stored last section for a user with option fallback.
	 *
	 * @param int $user_id User ID.
	 */
	public function get_last_section( int $user_id = 0 ): string {
		if ( 0 === $user_id ) {
			$user_id = get_current_user_id();
		}
		return (string) ( ( 0 !== $user_id ? get_user_meta( $user_id, self::LAST_SECTION_META_KEY, true ) : '' ) ?: get_option( 'burst_tour_last_section', '' ) );
	}

	/**
	 * Get stored completion status for a user with option fallback.
	 *
	 * @param int $user_id User ID.
	 */
	public function is_tour_completed( int $user_id = 0 ): bool {
		if ( 0 === $user_id ) {
			$user_id = get_current_user_id();
		}
		return (bool) ( ( 0 !== $user_id ? get_user_meta( $user_id, self::TOUR_COMPLETED_META_KEY, true ) : false ) ?: get_option( 'burst_tour_completed', false ) );
	}

	/**
	 * Check if Gutenberg block goal step should be showcased.
	 * Only if Classic Editor, Elementor, and Divi are not active.
	 */
	public function should_showcase_gutenberg_goal(): bool {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			include_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		if ( function_exists( 'is_plugin_active' ) ) {
			if ( is_plugin_active( 'classic-editor/classic-editor.php' ) ||
				is_plugin_active( 'elementor/elementor.php' ) ||
				is_plugin_active( 'divi-builder/divi-builder.php' ) ) {
				return false;
			}
		}

		// Also check active theme for Divi.
		$theme = wp_get_theme();
		if ( 'Divi' === $theme->get( 'Name' ) || 'Divi' === $theme->get( 'Template' ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Intercept REST mutation requests in tour mode so no changes are written to the database.
	 *
	 * Note: The $result parameter and return value are typed as mixed to conform with WordPress core's
	 * `rest_pre_dispatch` filter signature (null, WP_REST_Response, WP_Error, or an array/primitive).
	 *
	 * @param mixed            $result  Response result from prior filters, or null to continue normal dispatch.
	 * @param \WP_REST_Server  $server  Server instance.
	 * @param \WP_REST_Request $request Request instance.
	 * @return mixed WP_REST_Response when intercepted in tour mode, or original $result to continue dispatch.
	 */
	public function intercept_tour_mutations( mixed $result, \WP_REST_Server $server, \WP_REST_Request $request ): mixed {
		$route         = (string) $request->get_route();
		$trimmed_route = ltrim( $route, '/' );

		// Constrain strictly to the burst/v1 namespace.
		if ( 0 !== strpos( $trimmed_route, 'burst/v1/' ) ) {
			return $result;
		}

		// Allow tour management routes and actions to complete normally.
		if ( 0 === strpos( $trimmed_route, 'burst/v1/tour/' ) ||
			0 === strpos( $trimmed_route, 'burst/v1/do_action/tour_' ) ||
			0 === strpos( $trimmed_route, 'burst/v1/get_action/tour_' ) ) {
			return $result;
		}

		$user_id = get_current_user_id();
		if ( 0 === $user_id || ! $this->user_can_manage() ) {
			return $result;
		}

		// Verify tour is active server-side for this user. Demo environments keep intercepting after the tour ends.
		if ( ! $this->is_user_tour_active( $user_id ) && ! self::is_demo_mode() ) {
			return $result;
		}

		$method = strtoupper( $request->get_method() );

		// Intercept non-GET mutations during tour using exact registered route matching.
		if ( 'GET' !== $method ) {
			$sub_route = preg_replace( '#^burst/v1/#', '', $trimmed_route );

			switch ( $sub_route ) {
				case 'fields/set':
				case 'fields/save':
					return new \WP_REST_Response(
						[
							'request_success' => true,
							'message'         => __( 'Settings saved (tour mode)', 'burst-statistics' ),
						],
						200
					);

				case 'goals/add_predefined':
					return new \WP_REST_Response(
						[
							'request_success' => true,
							'goal'            => [
								'id'         => 9998,
								'title'      => __( 'Newsletter signup', 'burst-statistics' ),
								'status'     => 'active',
								'type'       => 'clicks',
								'date_start' => 0,
								'date_end'   => 0,
								'value'      => '18',
							],
						],
						200
					);

				case 'goals/add':
					return new \WP_REST_Response(
						[
							'request_success' => true,
							'goal'            => [
								'id'         => 9999,
								'title'      => __( 'New goal', 'burst-statistics' ),
								'status'     => 'active',
								'type'       => 'clicks',
								'date_start' => 0,
								'date_end'   => 0,
								'value'      => '0',
							],
						],
						200
					);

				case 'goals/delete':
					return new \WP_REST_Response(
						[
							'request_success' => true,
							'deleted'         => true,
						],
						200
					);

				case 'goals/set':
				case 'goals/update':
					return new \WP_REST_Response(
						[
							'request_success' => true,
						],
						200
					);

				case 'do_action/report/create':
				case 'do_action/report/update':
				case 'do_action/report/save':
				case 'do_action/report/send-report-now':
				case 'do_action/report-create':
				case 'do_action/report-update':
				case 'do_action/report-save':
				case 'do_action/report-send-report-now':
					return new \WP_REST_Response(
						[
							'request_success' => true,
							'data'            => [
								'success' => true,
								'report'  => [
									'id'         => 1,
									'name'       => __( 'Weekly traffic & top pages story', 'burst-statistics' ),
									'format'     => 'story',
									'frequency'  => 'weekly',
									'dayOfWeek'  => 1,
									'sendTime'   => '09:00',
									'recipients' => [ 'team@example.com' ],
									'enabled'    => 1,
								],
							],
						],
						200
					);

				case 'do_action/get_share_token':
				case 'share/token':
					$share_token = 'tour_mock_share_token_8x92';
					$site_url    = site_url( '/wp-admin/admin.php?page=burst' );
					return new \WP_REST_Response(
						[
							'request_success' => true,
							'data'            => [
								'share_token' => $share_token,
								'share_url'   => "{$site_url}&share={$share_token}#/statistics",
								'expiration'  => '7d',
								'expires_at'  => time() + 7 * DAY_IN_SECONDS,
								'permissions' => [
									'can_change_date' => true,
									'can_filter'      => true,
								],
								'shared_tabs' => [ 'dashboard', 'statistics', 'engagement', 'sources' ],
							],
						],
						200
					);

				default:
					return new \WP_REST_Response(
						[
							'request_success' => true,
						],
						200
					);
			}
		}

		return $result;
	}

	/**
	 * Get overview tour steps.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function get_overview_steps(): array {
		return [
			[
				'id'        => 'overview_intro',
				'section'   => 'overview',
				'title'     => __( 'Welcome to Burst Statistics! 👋', 'burst-statistics' ),
				'text'      => __( 'Take a quick hands-on tour of Burst. We\'ll explore live traffic, detailed analytics, acquisition channels, AI chat, and automated reporting.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="nav-tab-dashboard"]',
				'placement' => 'bottom',
				'route'     => '/',
			],
			[
				'id'        => 'overview_today',
				'section'   => 'overview',
				'title'     => __( 'Live & today\'s summary ⚡', 'burst-statistics' ),
				'text'      => __( 'Monitor real-time active visitors, today\'s traffic totals, top landing pages, and average reading time at a glance.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="today-block"]',
				'placement' => 'right',
				'align'     => 'left',
				'route'     => '/',
			],
			[
				'id'        => 'overview_goals',
				'section'   => 'overview',
				'title'     => __( 'Conversions at a glance 🎯', 'burst-statistics' ),
				'text'      => __( 'Track live goal completions, conversion rates, and revenue impact directly alongside your traffic metrics.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="goals-block"]',
				'placement' => 'right',
				'route'     => '/',
			],
			[
				'id'        => 'prompt_insights_tab',
				'section'   => 'insights',
				'title'     => __( 'Next: detailed insights 📈', 'burst-statistics' ),
				'text'      => __( 'Click the "Insights" tab in the navigation above to explore metric trends, global filters, and datatables.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="nav-tab-statistics"]',
				'placement' => 'bottom',
				'action'    => 'click_tab',
				'route'     => '/',
			],
		];
	}

	/**
	 * Get insights and graph tour steps.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function get_insights_steps(): array {
		return [
			[
				'id'        => 'insights_graph_explore',
				'section'   => 'insights',
				'title'     => __( 'Customize metric trends 📈', 'burst-statistics' ),
				'text'      => __( 'Select multiple metrics (e.g. Pageviews, Visitors, Sessions, Bounces) and click Apply to customize the graph view.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="insights-metric-selector"]',
				'placement' => 'bottom',
				'action'    => 'change_metrics',
				'delay'     => 1200,
				'route'     => '/statistics',
			],
			[
				'id'        => 'insights_page_filter',
				'section'   => 'insights',
				'title'     => __( 'Filter the entire dashboard 🔍', 'burst-statistics' ),
				'text'      => __( 'Segment your dashboard by Page URL, Referrer, Country, or Device. Pick any dimension and click Apply.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="page-filter"]',
				'placement' => 'bottom',
				'align'     => 'right',
				'action'    => 'apply_filter',
				'delay'     => 1500,
				'route'     => '/statistics',
			],
			[
				'id'        => 'insights_share_links',
				'section'   => 'insights',
				'title'     => __( 'Shareable dashboard links 🔗', 'burst-statistics' ),
				'text'      => __( 'Generate password-free, client-ready links with custom expiration dates and tab permissions.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="share-link-button"]',
				'placement' => 'bottom',
				'action'    => 'generate_share_link',
				'delay'     => 1800,
				'route'     => '/statistics',
			],
			[
				'id'        => 'insights_date_range',
				'section'   => 'insights',
				'title'     => __( 'Date range selector 📅', 'burst-statistics' ),
				'text'      => __( 'Switch timeframes easily. Select "All time" to calculate metrics across your full historical dataset.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="date-range"]',
				'placement' => 'bottom',
				'action'    => 'change_date_range',
				'route'     => '/statistics',
			],
			[
				'id'        => 'insights_date_range_reviewed',
				'section'   => 'insights',
				'title'     => __( 'Historical dataset loaded 📊', 'burst-statistics' ),
				'text'      => __( 'All charts, benchmark badges, and datatables have recalculated to reflect your full dataset.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="insights-graph"]',
				'placement' => 'bottom',
				'route'     => '/statistics',
			],
			[
				'id'        => 'insights_community_comparison',
				'section'   => 'insights',
				'title'     => __( 'Peer benchmarks 🌐', 'burst-statistics' ),
				'text'      => __( 'Hover the benchmark icon to see how your site compares to peers. Opting in to anonymous data sharing in Settings unlocks these community benchmarks.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="community-comparison"]',
				'placement' => 'left',
				'action'    => 'hover_element',
				'route'     => '/statistics',
			],
		];
	}

	/**
	 * Get data table and page analytics tour steps.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function get_datatables_steps(): array {
		return [
			[
				'id'        => 'insights_data_table_filter',
				'section'   => 'datatables',
				'title'     => __( 'Drill down by page 🔍', 'burst-statistics' ),
				'text'      => __( 'Click the filter icon beside any URL to isolate and recalculate dashboard metrics for that single page.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="data-table-click-filter"]',
				'placement' => 'top',
				'action'    => 'click_element',
				'delay'     => 1500,
				'route'     => '/statistics',
			],
			[
				'id'        => 'insights_data_table_filtered_review',
				'section'   => 'datatables',
				'title'     => __( 'Segment view active 🎯', 'burst-statistics' ),
				'text'      => __( 'The dashboard is now filtered to this page. You can add more filters or clear them anytime using the top chips.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="page-filter"]',
				'placement' => 'bottom',
				'route'     => '/statistics',
			],
			[
				'id'        => 'insights_per_page_analytics',
				'section'   => 'datatables',
				'title'     => __( 'Per-page deep dive 📄', 'burst-statistics' ),
				'text'      => __( 'Click the Page Analytics icon to open visitor flow diagrams, scroll depth heatmaps, and revision impact tracking.', 'burst-statistics' ),
				'pro'       => true,
				'keep_open' => 'sheet',
				'anchor'    => '[data-tour="data-table-page-analytics"]',
				'placement' => 'top',
				'action'    => 'click_element',
				'delay'     => 300,
				'route'     => '/statistics',
			],
			[
				'id'        => 'insights_per_page_review',
				'section'   => 'datatables',
				'title'     => __( 'Page analytics & visitor flow 📈', 'burst-statistics' ),
				'text'      => __( 'Explore traffic entry and exit paths, scroll heatmaps, and content performance for this specific URL.', 'burst-statistics' ),
				'pro'       => true,
				'keep_open' => 'sheet',
				'anchor'    => '[data-tour="per-page-content"]',
				'placement' => 'bottom',
				'route'     => '/statistics',
			],
			[
				'id'        => 'insights_data_table_search',
				'section'   => 'datatables',
				'title'     => __( 'Search & column sorting 🔎', 'burst-statistics' ),
				'text'      => __( 'Instantly filter thousands of rows using the search box, or click any column header to sort ascending or descending.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="data-table-search"]',
				'placement' => 'bottom',
				'route'     => '/statistics',
			],
			[
				'id'        => 'insights_data_table_columns_sort',
				'section'   => 'datatables',
				'title'     => __( 'Customize table columns ⚙️', 'burst-statistics' ),
				'text'      => __( 'Select the metrics you want to display — toggle bounce rate, reading time, or visitors, then click Apply.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="data-table-columns"]',
				'placement' => 'bottom',
				'action'    => 'toggle_columns',
				'delay'     => 1500,
				'route'     => '/statistics',
			],
			[
				'id'        => 'insights_data_table_expand',
				'section'   => 'datatables',
				'title'     => __( 'Full-screen view & CSV export 📑', 'burst-statistics' ),
				'text'      => __( 'Expand the datatable for a wide-screen view, or export your filtered data directly to a CSV spreadsheet.', 'burst-statistics' ),
				'pro'       => false,
				'keep_open' => 'sheet',
				'anchor'    => '[data-tour="data-table-expand"]',
				'placement' => 'left',
				'action'    => 'click_element',
				'delay'     => 300,
				'route'     => '/statistics',
			],
			[
				'id'        => 'insights_data_table_expanded_review',
				'section'   => 'datatables',
				'title'     => __( 'Expanded data view 📊', 'burst-statistics' ),
				'text'      => __( 'View all rows with expanded pagination, deep column sorting, and instant CSV export tools.', 'burst-statistics' ),
				'pro'       => false,
				'keep_open' => 'sheet',
				'anchor'    => '[data-tour="sheet-overlay-content"]',
				'placement' => 'bottom',
				'route'     => '/statistics',
			],
		];
	}

	/**
	 * Get traffic sources tour steps.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function get_sources_steps(): array {
		return [
			[
				'id'        => 'prompt_sources_tab',
				'section'   => 'sources',
				'title'     => __( 'Next: traffic sources 🌍', 'burst-statistics' ),
				'text'      => __( 'Click the "Sources" tab above to discover where your visitors originate.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="nav-tab-sources"]',
				'placement' => 'bottom',
				'action'    => 'click_tab',
				'route'     => '/statistics',
			],
			[
				'id'        => 'sources_channels_breakdown',
				'section'   => 'sources',
				'title'     => __( 'Acquisition channels 🌐', 'burst-statistics' ),
				'text'      => __( 'Identify your top acquisition channels across Organic Search, Direct, Social media, and Referrals.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="sources-block"]',
				'placement' => 'right',
				'route'     => '/sources',
			],
			[
				'id'        => 'sources_campaigns_ab',
				'section'   => 'sources',
				'title'     => __( 'Campaigns & UTM tracking 🚀', 'burst-statistics' ),
				'text'      => __( 'Track inbound UTM marketing campaigns and compare conversion performance across campaign variants — Burst automatically detects A/B tests and highlights the winner!', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="campaigns-block"]',
				'placement' => 'top',
				'route'     => '/sources',
			],
			[
				'id'        => 'sources_google_search',
				'section'   => 'sources',
				'title'     => __( 'Google Search Console 🔍', 'burst-statistics' ),
				'text'      => __( 'Preview top search queries, clicks, impressions, and rank positions. Connect your account in Settings > Integrations.', 'burst-statistics' ),
				'pro'       => true,
				'anchor'    => '[data-tour="search-console-block"]',
				'placement' => 'top',
				'route'     => '/sources',
			],
		];
	}

	/**
	 * Get AI assistant tour steps.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function get_ai_chat_steps(): array {
		return [
			[
				'id'        => 'chat_assistant_tour',
				'section'   => 'ai_chat',
				'title'     => __( 'AI analytics assistant 🤖', 'burst-statistics' ),
				'text'      => __( 'Ask questions about your traffic in plain English using your private, on-site conversational assistant.', 'burst-statistics' ),
				'pro'       => false,
				'keep_open' => 'chat',
				'anchor'    => '[data-tour="chat-assistant"]',
				'placement' => 'left',
				'action'    => 'click_element',
				'delay'     => 300,
				'route'     => '/sources',
			],
			[
				'id'        => 'chat_assistant_prompt_select',
				'section'   => 'ai_chat',
				'title'     => __( 'Ask questions or pick prompts 💬', 'burst-statistics' ),
				'text'      => __( 'Click any quick prompt or type your own question to analyze traffic patterns in real time.', 'burst-statistics' ),
				'pro'       => false,
				'keep_open' => 'chat',
				'anchor'    => '[data-tour="chat-prompt-suggestions"]',
				'placement' => 'top',
				'action'    => 'click_element',
				'route'     => '/sources',
			],
			[
				'id'        => 'chat_assistant_response_review',
				'section'   => 'ai_chat',
				'title'     => __( 'Instant AI summaries ⚡', 'burst-statistics' ),
				'text'      => __( 'Burst AI queries your local database to deliver instant summaries and actionable insights without sending personal data off-site.', 'burst-statistics' ),
				'pro'       => false,
				'keep_open' => 'chat',
				'anchor'    => '[data-tour="chat-response-message"]',
				'placement' => 'left',
				'route'     => '/sources',
			],
		];
	}

	/**
	 * Get reading engagement tour steps.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function get_engagement_steps(): array {
		return [
			[
				'id'        => 'prompt_engagement_tab',
				'section'   => 'engagement',
				'title'     => __( 'Next: reading engagement 📖', 'burst-statistics' ),
				'text'      => __( 'Click the "Engagement" tab above to see how visitors interact with your content.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="nav-tab-engagement"]',
				'placement' => 'bottom',
				'action'    => 'click_tab',
				'route'     => '/sources',
			],
			[
				'id'        => 'engagement_reading_block',
				'section'   => 'engagement',
				'title'     => __( 'Reading time & scroll depth 📖', 'burst-statistics' ),
				'text'      => __( 'Rank pages by active reading duration and scroll depth. Toggle the header switch to quickly spot high-performing vs under-performing content.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="engagement-block"]',
				'placement' => 'right',
				'route'     => '/engagement',
			],
		];
	}

	/**
	 * Get automated report wizard tour steps.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function get_reporting_steps(): array {
		return [
			[
				'id'        => 'prompt_reporting_tab',
				'section'   => 'reporting',
				'title'     => __( 'Next: automated reports 📊', 'burst-statistics' ),
				'text'      => __( 'Click the "Reports" tab in the navigation above to explore automated email digests and client reports.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="nav-tab-reporting"]',
				'placement' => 'bottom',
				'action'    => 'click_tab',
				'route'     => '/engagement',
			],
			[
				'id'        => 'reporting_overview_types',
				'section'   => 'reporting',
				'title'     => __( 'Report formats 📑', 'burst-statistics' ),
				'text'      => __( 'Burst provides two flexible reporting formats: • Classic Email: A clean summary delivered directly in the email body. • Story Report: An interactive web report with live charts, filters, and PDF export.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="field-email_reports_mailinglist"]',
				'placement' => 'bottom',
				'route'     => '/reporting/reports',
			],
			[
				'id'        => 'reporting_new_report',
				'section'   => 'reporting',
				'title'     => __( 'Create a report 📋', 'burst-statistics' ),
				'text'      => __( 'Click "New report" to launch the step-by-step report builder.', 'burst-statistics' ),
				'pro'       => true,
				'keep_open' => 'wizard',
				'anchor'    => '[data-tour="new-report-button"]',
				'placement' => 'bottom',
				'action'    => 'click_element',
				'delay'     => 300,
				'route'     => '/reporting/reports',
			],
			[
				'id'        => 'reporting_wizard_format',
				'section'   => 'reporting',
				'title'     => __( 'Select story format 📖', 'burst-statistics' ),
				'text'      => __( 'Select Story Report to build a responsive, interactive web report.', 'burst-statistics' ),
				'pro'       => true,
				'keep_open' => 'wizard',
				'anchor'    => '[data-tour="wizard-format-story"]',
				'placement' => 'right',
				'action'    => 'click_element',
				'delay'     => 300,
				'route'     => '/reporting/reports',
			],
			[
				'id'        => 'reporting_wizard_blocks',
				'section'   => 'reporting',
				'title'     => __( 'Add report content 🖼️', 'burst-statistics' ),
				'text'      => __( 'Add your brand logo, performance charts, and top page tables to your custom report.', 'burst-statistics' ),
				'pro'       => true,
				'keep_open' => 'wizard',
				'anchor'    => '[data-tour="wizard-add-block-btn"]',
				'placement' => 'right',
				'action'    => 'click_element',
				'delay'     => 300,
				'route'     => '/reporting/reports',
			],
			[
				'id'        => 'reporting_wizard_blocks_preview',
				'section'   => 'reporting',
				'title'     => __( 'Live report preview 👁️', 'burst-statistics' ),
				'text'      => __( 'Added blocks appear instantly in the live preview. Reorder sections and preview desktop and mobile layouts.', 'burst-statistics' ),
				'pro'       => true,
				'keep_open' => 'wizard',
				'anchor'    => '[data-tour="wizard-preview"]',
				'placement' => 'left',
				'route'     => '/reporting/reports',
			],
			[
				'id'        => 'reporting_wizard_blocks_continue',
				'section'   => 'reporting',
				'title'     => __( 'Proceed to recipients ➡️', 'burst-statistics' ),
				'text'      => __( 'Click "Save and continue" to set your report recipients.', 'burst-statistics' ),
				'pro'       => true,
				'keep_open' => 'wizard',
				'anchor'    => '[data-tour="wizard-primary-btn"]',
				'placement' => 'top',
				'action'    => 'click_element',
				'delay'     => 300,
				'route'     => '/reporting/reports',
			],
			[
				'id'        => 'reporting_wizard_recipients',
				'section'   => 'reporting',
				'title'     => __( 'Configure recipients ✉️', 'burst-statistics' ),
				'text'      => __( 'Add team members or clients who will receive scheduled report notifications.', 'burst-statistics' ),
				'pro'       => true,
				'keep_open' => 'wizard',
				'anchor'    => '[data-tour="wizard-primary-btn"]',
				'placement' => 'top',
				'action'    => 'click_element',
				'delay'     => 300,
				'route'     => '/reporting/reports',
			],
			[
				'id'        => 'reporting_wizard_schedule',
				'section'   => 'reporting',
				'title'     => __( 'Schedule delivery 🚀', 'burst-statistics' ),
				'text'      => __( 'Choose your automated delivery frequency (weekly, monthly) and click "Schedule and save".', 'burst-statistics' ),
				'pro'       => true,
				'keep_open' => 'wizard',
				'anchor'    => '[data-tour="wizard-primary-btn"]',
				'placement' => 'top',
				'action'    => 'click_element',
				'delay'     => 300,
				'route'     => '/reporting/reports',
			],
			[
				'id'        => 'reporting_scheduled_review',
				'section'   => 'reporting',
				'title'     => __( 'Story report scheduled! 🎉', 'burst-statistics' ),
				'text'      => __( 'Your Story Report is saved and active. Recipients will receive scheduled interactive email digests.', 'burst-statistics' ),
				'pro'       => true,
				'anchor'    => '[data-tour="reports-list-table"]',
				'placement' => 'bottom',
				'route'     => '/reporting/reports',
			],
		];
	}

	/**
	 * Get report customization and branding tour steps.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function get_customization_steps(): array {
		return [
			[
				'id'        => 'reporting_customization_branding',
				'section'   => 'customization',
				'title'     => __( 'White-label customization 🎨', 'burst-statistics' ),
				'text'      => __( 'Click "Customization" in the sidebar to brand client reports with your logo, color palette, and custom styling.', 'burst-statistics' ),
				'pro'       => true,
				'anchor'    => '[data-tour="subnav-customization"]',
				'placement' => 'right',
				'action'    => 'click_tab',
				'route'     => '/reporting/customization',
			],
			[
				'id'        => 'reporting_customization_logo',
				'section'   => 'customization',
				'title'     => __( 'Agency & client logo 🖼️', 'burst-statistics' ),
				'text'      => __( 'Upload your agency or company logo with automatic light and dark mode support.', 'burst-statistics' ),
				'pro'       => true,
				'anchor'    => '[data-tour="image-picker-logo_attachment_id"]',
				'placement' => 'bottom',
				'route'     => '/reporting/customization',
			],
			[
				'id'        => 'reporting_customization_hero',
				'section'   => 'customization',
				'title'     => __( 'Hero banner & overlay 🌄', 'burst-statistics' ),
				'text'      => __( 'Customize header banner images and toggle brand color tint overlays.', 'burst-statistics' ),
				'pro'       => true,
				'anchor'    => '[data-tour="image-picker-hero_background_image_attachment_id"]',
				'placement' => 'bottom',
				'route'     => '/reporting/customization',
			],
			[
				'id'        => 'reporting_customization_color',
				'section'   => 'customization',
				'title'     => __( 'Brand color palette 🎨', 'burst-statistics' ),
				'text'      => __( 'Select your primary brand color to theme chart series, metric badges, and email templates.', 'burst-statistics' ),
				'pro'       => true,
				'anchor'    => '[data-tour="field-brand_color"] [data-tour="color-picker-control"]',
				'placement' => 'bottom',
				'route'     => '/reporting/customization',
			],
			[
				'id'        => 'reporting_customization_css',
				'section'   => 'customization',
				'title'     => __( 'Custom CSS styling 💻', 'burst-statistics' ),
				'text'      => __( 'Apply custom CSS rules to fine-tune typography, spacing, and PDF export formatting.', 'burst-statistics' ),
				'pro'       => true,
				'anchor'    => '[data-tour="field-custom_css"]',
				'placement' => 'bottom',
				'route'     => '/reporting/customization',
			],
		];
	}

	/**
	 * Get conversion goals tour steps.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function get_goals_steps(): array {
		$steps = [
			[
				'id'         => 'prompt_settings_tab',
				'section'    => 'goals',
				'title'      => __( 'Next: settings & goals ⚙️', 'burst-statistics' ),
				'text'       => __( 'Click the "Settings" tab in the navigation above to explore conversion goals, privacy levels, and smart automation.', 'burst-statistics' ),
				'pro'        => false,
				'anchor'     => '[data-tour="nav-tab-settings"]',
				'placement'  => 'bottom',
				'action'     => 'click_tab',
				'target_url' => '/settings/general',
				'route'      => '/reporting/customization',
			],
			[
				'id'        => 'settings_goal_setup',
				'section'   => 'goals',
				'title'     => __( 'Conversion goals 🎯', 'burst-statistics' ),
				'text'      => __( 'Click "Goals" in the sidebar to track meaningful actions like button clicks, form submissions, and purchases.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="subnav-goals"]',
				'placement' => 'right',
				'action'    => 'click_tab',
				'route'     => '/settings/goals',
			],
			[
				'id'        => 'settings_goals_add',
				'section'   => 'goals',
				'title'     => __( 'Add conversion goal 🎯', 'burst-statistics' ),
				'text'      => __( 'Click "+ Add goal" to define custom click, view, or form conversion triggers.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="add-goal-button"]',
				'placement' => 'bottom',
				'action'    => 'click_element',
				'delay'     => 1200,
				'route'     => '/settings/goals',
			],
			[
				'id'        => 'settings_goals_name',
				'section'   => 'goals',
				'title'     => __( 'Goal name 🎯', 'burst-statistics' ),
				'text'      => __( 'Set a recognizable name (e.g. "Checkout Click" or "Contact Form") for easy tracking across reports.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="goal-field-title"]',
				'placement' => 'bottom',
				'route'     => '/settings/goals',
			],
			[
				'id'        => 'settings_goals_type',
				'section'   => 'goals',
				'title'     => __( 'Trigger type ⚡', 'burst-statistics' ),
				'text'      => __( 'Choose the conversion trigger: Clicks (button/link), Views (scrolled into view), or Visits (page URL).', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="goal-field-type"]',
				'placement' => 'bottom',
				'route'     => '/settings/goals',
			],
			[
				'id'        => 'settings_goals_scope',
				'section'   => 'goals',
				'title'     => __( 'Tracking scope 🌐', 'burst-statistics' ),
				'text'      => __( 'Track conversions across the entire site or restrict tracking to a single specific landing page.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="goal-field-page_or_website"]',
				'placement' => 'bottom',
				'route'     => '/settings/goals',
			],
			[
				'id'        => 'settings_goals_selector',
				'section'   => 'goals',
				'title'     => __( 'Target CSS selector 🎯', 'burst-statistics' ),
				'text'      => __( 'Enter the CSS selector or element ID (e.g. .checkout-btn, #buy-now) to track.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="goal-field-selector"]',
				'placement' => 'bottom',
				'route'     => '/settings/goals',
			],
			[
				'id'        => 'settings_goals_metric',
				'section'   => 'goals',
				'title'     => __( 'Conversion baseline 📊', 'burst-statistics' ),
				'text'      => __( 'Select the baseline metric used to calculate conversion rates: Unique Visitors, Sessions, or Pageviews.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="goal-field-conversion_metric"]',
				'placement' => 'bottom',
				'route'     => '/settings/goals',
			],
			[
				'id'        => 'settings_goals_toggle',
				'section'   => 'goals',
				'title'     => __( 'Activate goal 🚀', 'burst-statistics' ),
				'text'      => __( 'Enable this switch to start recording live conversions immediately across your dashboard.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="goal-field-toggle"]',
				'placement' => 'left',
				'route'     => '/settings/goals',
			],
		];

		if ( $this->should_showcase_gutenberg_goal() ) {
			$steps[] = [
				'id'        => 'settings_gutenberg_goal',
				'section'   => 'goals',
				'title'     => __( 'Gutenberg block goals 🧩', 'burst-statistics' ),
				'text'      => __( 'Embed Burst Goal blocks directly in Gutenberg to track page-specific CTAs without code.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="subnav-goals"]',
				'placement' => 'right',
				'route'     => '/settings/goals',
			];
		}

		return $steps;
	}

	/**
	 * Get settings, features and advanced tracking tour steps.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function get_settings_steps(): array {
		return [
			[
				'id'        => 'prompt_general_settings',
				'section'   => 'settings',
				'title'     => __( 'General settings ⚙️', 'burst-statistics' ),
				'text'      => __( 'Click "General" in the sidebar to configure privacy levels and core tracking options.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="subnav-general"]',
				'placement' => 'right',
				'action'    => 'click_tab',
				'route'     => '/settings/general',
			],
			[
				'id'        => 'settings_smart_update',
				'section'   => 'settings',
				'title'     => __( 'Smart features 🕒', 'burst-statistics' ),
				'text'      => __( 'Click "Features" in the sidebar to configure intelligent automation tools.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="subnav-features"]',
				'placement' => 'right',
				'action'    => 'click_tab',
				'route'     => '/settings/features',
			],
			[
				'id'        => 'settings_ghost_mode',
				'section'   => 'settings',
				'title'     => __( 'Advanced tracking 👻', 'burst-statistics' ),
				'text'      => __( 'Click "Advanced" in the sidebar to configure exclusions, IP filters, and stealth tracking.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="subnav-advanced"]',
				'placement' => 'right',
				'action'    => 'click_tab',
				'route'     => '/settings/advanced',
			],
			[
				'id'        => 'settings_advanced_ghost_mode',
				'section'   => 'settings',
				'title'     => __( 'Ghost Mode stealth 👻', 'burst-statistics' ),
				'text'      => __( 'Obfuscates tracking scripts and variables to prevent ad-blockers from blocking legitimate analytics.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '[data-tour="field-ghost_mode"]',
				'placement' => 'right',
				'route'     => '/settings/advanced',
			],
			[
				'id'        => 'reporting_finish',
				'section'   => 'settings',
				'title'     => __( 'You\'re all set! 🎉', 'burst-statistics' ),
				'text'      => __( 'You\'ve completed the Burst Statistics tour! You can revisit this tour anytime from Settings > General.', 'burst-statistics' ),
				'pro'       => false,
				'anchor'    => '',
				'placement' => 'center',
				'route'     => '/settings/advanced',
			],
		];
	}

	/**
	 * Get tour step definitions for a given tour identifier.
	 *
	 * @param string $tour_id Tour identifier.
	 * @return array<int, array<string, mixed>>
	 */
	public function get_tour_steps( string $tour_id = 'dashboard' ): array {
		if ( 'dashboard' !== $tour_id ) {
			/**
			 * Filter custom tour steps array.
			 *
			 * @param array<int, array<string, mixed>> $steps   Tour steps.
			 * @param string                           $tour_id Tour identifier.
			 */
			return apply_filters( 'burst_tour_steps', [], $tour_id );
		}

		$steps = array_merge(
			$this->get_overview_steps(),
			$this->get_insights_steps(),
			$this->get_datatables_steps(),
			$this->get_sources_steps(),
			$this->get_ai_chat_steps(),
			$this->get_engagement_steps(),
			$this->get_reporting_steps(),
			$this->get_customization_steps(),
			$this->get_goals_steps(),
			$this->get_settings_steps()
		);

		$is_pro         = $this->is_pro();
		$filtered_steps = [];

		foreach ( $steps as $step ) {
			if ( ! $is_pro && ! empty( $step['pro'] ) ) {
				continue;
			}
			if ( empty( $step['feature_id'] ) ) {
				$step['feature_id'] = $step['id'];
			}
			$filtered_steps[] = $step;
		}

		/**
		 * Filter the tour steps array.
		 *
		 * @param array<int, array<string, mixed>> $steps   Tour steps.
		 * @param string                           $tour_id Tour identifier.
		 */
		return apply_filters( 'burst_tour_steps', $filtered_steps, $tour_id );
	}

	/**
	 * Get estimated tour duration in minutes based on total step count.
	 *
	 * @param string $tour_id Tour identifier.
	 * @return int Estimated duration in minutes (minimum 1).
	 */
	public static function get_estimated_duration_minutes( string $tour_id = 'dashboard' ): int {
		// Building the steps means translating every step and probing the
		// theme and active plugins; the burst_fields and burst_tasks filters
		// both ask for this on one request, so memoize per tour.
		static $minutes = [];
		if ( ! isset( $minutes[ $tour_id ] ) ) {
			$steps               = ( new self() )->get_tour_steps( $tour_id );
			$minutes[ $tour_id ] = max( 1, (int) round( ( count( $steps ) * 10 ) / 60 ) );
		}
		return $minutes[ $tour_id ];
	}

	/**
	 * Whether an id sent by the tour client names a step of the dashboard
	 * tour (feature ids are step ids, see get_tour_steps()). Stored ids are
	 * validated against this list rather than kept as free text.
	 */
	private function is_known_step_id( string $id ): bool {
		static $ids = null;
		if ( null === $ids ) {
			$ids = array_column( $this->get_tour_steps(), 'id' );
		}
		return in_array( $id, $ids, true );
	}

	/**
	 * Handle tour write actions via burst_do_action filter.
	 *
	 * @param array<string, mixed>      $output Response array.
	 * @param string                    $action Action name.
	 * @param array<string, mixed>|null $data   Action data payload.
	 * @return array<string, mixed>
	 */
	public function handle_do_action( array $output, string $action, ?array $data = null ): array {
		if ( ! $this->user_can_manage() ) {
			return $output;
		}

		$user_id = get_current_user_id();

		switch ( $action ) {
			case 'tour_progress':
				// Section ids are slugs defined by the tour client (tourSections.ts);
				// store a bounded slug, never free text.
				$section_id = isset( $data['section_id'] ) ? substr( sanitize_key( (string) $data['section_id'] ), 0, 64 ) : '';
				$completed  = ! empty( $data['completed'] );

				if ( ! empty( $section_id ) ) {
					if ( 0 !== $user_id ) {
						update_user_meta( $user_id, self::LAST_SECTION_META_KEY, $section_id );
					}
					update_option( 'burst_tour_last_section', $section_id, false );
				}

				if ( $completed ) {
					if ( 0 !== $user_id ) {
						update_user_meta( $user_id, self::TOUR_COMPLETED_META_KEY, true );
						delete_user_meta( $user_id, self::TOUR_ACTIVE_META_KEY );
					}
					update_option( 'burst_tour_completed', true, false );
					do_action( 'burst_tour_completed' );
				}

				return [
					'success'      => true,
					'last_section' => $section_id ?: $this->get_last_section( $user_id ),
					'completed'    => $this->is_tour_completed( $user_id ),
				];

			case 'tour_complete_feature':
				$feature_id = isset( $data['feature_id'] ) ? sanitize_key( (string) $data['feature_id'] ) : '';
				if ( empty( $feature_id ) || ! $this->is_known_step_id( $feature_id ) ) {
					return [
						'success' => false,
						'message' => 'Missing or unknown feature_id parameter',
					];
				}

				$completed = $this->mark_feature_completed( $feature_id );
				return [
					'success'            => true,
					'completed_features' => $completed,
				];

			case 'tour_dismiss':
				if ( 0 !== $user_id ) {
					update_user_meta( $user_id, self::TOUR_DISMISSED_META_KEY, time() );
					update_user_meta( $user_id, self::TOUR_STARTED_META_KEY, time() );
					delete_user_meta( $user_id, self::TOUR_ACTIVE_META_KEY );
				}
				return [ 'success' => true ];

			case 'tour_reset':
				if ( 0 !== $user_id ) {
					delete_user_meta( $user_id, self::COMPLETED_TOURS_META_KEY );
					delete_user_meta( $user_id, self::TOUR_DISMISSED_META_KEY );
					delete_user_meta( $user_id, self::LAST_SECTION_META_KEY );
					delete_user_meta( $user_id, self::TOUR_COMPLETED_META_KEY );
					delete_user_meta( $user_id, self::TOUR_ACTIVE_META_KEY );
				}
				delete_option( 'burst_tour_last_section' );
				delete_option( 'burst_tour_completed' );
				return [ 'success' => true ];

			case 'tour_resume':
				// The client sends this when it (re)opens a tour session: a load
				// with ?tour already set the flag in maybe_localize_tour_data(),
				// a resume from the modal on a load without it has not.
				if ( 0 !== $user_id ) {
					update_user_meta( $user_id, self::TOUR_STARTED_META_KEY, time() );
					update_user_meta( $user_id, self::TOUR_ACTIVE_META_KEY, 1 );
				}
				return [ 'success' => true ];

			case 'tour_start':
				if ( 0 !== $user_id ) {
					$was_completed = $this->is_tour_completed( $user_id );
					update_user_meta( $user_id, self::TOUR_STARTED_META_KEY, time() );
					update_user_meta( $user_id, self::TOUR_ACTIVE_META_KEY, 1 );
					delete_user_meta( $user_id, self::TOUR_DISMISSED_META_KEY );
					delete_user_meta( $user_id, self::TOUR_COMPLETED_META_KEY );
					if ( $was_completed ) {
						delete_user_meta( $user_id, self::LAST_SECTION_META_KEY );
					}
				}
				$was_completed_option = (bool) get_option( 'burst_tour_completed', false );
				delete_option( 'burst_tour_completed' );
				if ( $was_completed_option ) {
					delete_option( 'burst_tour_last_section' );
				}

				return [
					'success'  => true,
					'redirect' => admin_url( 'admin.php?page=burst&tour=dashboard#/' ),
				];

			default:
				return $output;
		}
	}

	/**
	 * Handle tour read actions via burst_get_action filter.
	 *
	 * @param array<string, mixed>      $output Response array.
	 * @param string                    $action Action name.
	 * @param array<string, mixed>|null $data   Action data payload.
	 * @return array<string, mixed>
	 */
	public function handle_get_action( array $output, string $action, ?array $data = null ): array {
		if ( 'tour_steps' !== $action || ! $this->user_can_manage() ) {
			return $output;
		}

		// Read only: the tour state is written by the tour_resume / tour_start
		// actions, never by a GET.
		$tour_id = isset( $data['tour_id'] ) ? sanitize_key( (string) $data['tour_id'] ) : 'dashboard';
		$steps   = $this->get_tour_steps( $tour_id );

		return [
			'success' => true,
			'tour_id' => $tour_id,
			'steps'   => $steps,
		];
	}

	/**
	 * Schedule a 7-day tour reminder cron upon onboarding completion.
	 *
	 * @param int $user_id User ID.
	 */
	public function schedule_tour_reminder( int $user_id = 0 ): void {
		if ( 0 === $user_id ) {
			$user_id = get_current_user_id();
		}

		if ( 0 === $user_id ) {
			return;
		}

		if ( ! wp_next_scheduled( 'burst_tour_reminder_cron', [ $user_id ] ) ) {
			wp_schedule_single_event(
				time() + ( 7 * DAY_IN_SECONDS ),
				'burst_tour_reminder_cron',
				[ $user_id ]
			);
		}
	}

	/**
	 * Send an email reminder to take the interactive tour if it was not started within 7 days.
	 *
	 * @param int $user_id User ID.
	 */
	public function send_tour_reminder_email( int $user_id ): void {
		if ( 0 === $user_id ) {
			return;
		}

		$tour_started   = (bool) get_user_meta( $user_id, self::TOUR_STARTED_META_KEY, true );
		$tour_dismissed = (bool) get_user_meta( $user_id, self::TOUR_DISMISSED_META_KEY, true );

		if ( $tour_started || $tour_dismissed ) {
			return;
		}

		// If no email report was enabled during onboarding, the user opted out of
		// Burst emails — don't send them the tour reminder either.
		if ( ! $this->has_configured_report() ) {
			return;
		}

		$user = get_userdata( $user_id );
		if ( ! $user || empty( $user->user_email ) ) {
			return;
		}

		$mailer           = new Mailer();
		$mailer->to       = [ $user->user_email ];
		$mailer->title    = __( 'Discover what Burst Statistics can do for you!', 'burst-statistics' );
		$mailer->subtitle = sprintf(
			/* translators: %d: estimated tour duration in minutes */
			__( 'Take a %d-minute interactive tour of your new dashboard.', 'burst-statistics' ),
			self::get_estimated_duration_minutes( 'dashboard' )
		);
		$mailer->introduction = sprintf(
			/* translators: %s: user display name */
			__( 'Hi %s,', 'burst-statistics' ),
			esc_html( $user->display_name ?: $user->user_login )
		);

		$tour_url = admin_url( 'admin.php?page=burst&tour=dashboard' );

		$mailer->message = sprintf(
			'<p>%s</p><p style="text-align: center; margin: 30px 0;"><a href="%s" style="background-color: #2A5B8C; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">%s</a></p><p>%s</p>',
			esc_html__( 'You recently configured Burst Statistics, but haven’t explored all its interactive features yet. Take our quick interactive tour to discover filtering, insights graphs, and live metrics.', 'burst-statistics' ),
			esc_url( $tour_url ),
			esc_html__( 'Start Interactive Tour', 'burst-statistics' ),
			esc_html__( 'If you have any questions, our support team is always here to help!', 'burst-statistics' )
		);

		$mailer->send_mail( $user->user_email );
		update_user_meta( $user_id, self::REMINDER_SENT_META_KEY, time() );
	}

	/**
	 * Whether the user enabled an email report (i.e. opted into Burst emails).
	 *
	 * The onboarding "email" step stores the entered address in the
	 * `email_reports_mailinglist` option; an empty list means the user skipped
	 * reports. This drives an either/or nudge: users with a report configured
	 * get the reminder email, users without get the in-dashboard tour notice.
	 */
	private function has_configured_report(): bool {
		$recipients = $this->get_option( 'email_reports_mailinglist', [] );
		return is_array( $recipients ) && ! empty( $recipients );
	}

	/**
	 * Register the link-driven "take the tour" task in the Tasks overview.
	 *
	 * Counterpart to the reminder email: the task is the nudge for users who did
	 * not enable a report during onboarding (see should_show_tour_task()). Its
	 * link starts the tour directly, since the tour is URL-driven.
	 *
	 * @param array<int, array<string, mixed>> $tasks Registered tasks.
	 * @return array<int, array<string, mixed>>
	 */
	public function add_tour_task( array $tasks ): array {
		$tasks[] = [
			'id'                  => 'interactive_tour',
			'mainwp'              => false,
			'drip_order'          => 10,
			'condition'           => [
				'type'     => 'serverside',
				'function' => 'Burst\Admin\Tour\Tour::should_show_tour_task()',
			],
			'msg'                 => sprintf(
				/* translators: %d: estimated tour duration in minutes */
				__( 'Take a %d-minute interactive tour to discover filtering, insights graphs and live metrics.', 'burst-statistics' ),
				self::get_estimated_duration_minutes( 'dashboard' )
			),
			'icon'                => 'new',
			'url'                 => admin_url( 'admin.php?page=burst&tour=dashboard' ),
			'dismissible'         => true,
			'dismiss_permanently' => true,
			'plusone'             => true,
		];
		return $tasks;
	}

	/**
	 * Condition for the tour task. Shown only when the user did not configure a
	 * report during onboarding (so no reminder email is coming) and the tour has
	 * not been completed yet. Static so the Tasks validator can call it.
	 */
	public static function should_show_tour_task(): bool {
		$options    = get_option( 'burst_options_settings', [] );
		$recipients = is_array( $options ) ? ( $options['email_reports_mailinglist'] ?? [] ) : [];
		if ( is_array( $recipients ) && ! empty( $recipients ) ) {
			return false;
		}

		if ( get_option( 'burst_tour_completed', false ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Schedule a Tasks re-validation so the tour task appears promptly after
	 * onboarding (rather than waiting for the daily cron).
	 */
	public function schedule_tour_task_validation(): void {
		( new \Burst\Admin\Tasks() )->schedule_task_validation();
	}

	/**
	 * Append a tour launch button field to plugin settings (under Settings > General).
	 *
	 * @param array<int, array<string, mixed>> $fields Setting field definitions.
	 * @return array<int, array<string, mixed>>
	 */
	public function add_settings_field( array $fields ): array {
		// See add_tour_task(): no tour entry point inside the MainWP dashboard.
		if ( $this->is_mainwp_request() ) {
			return $fields;
		}

		$duration = self::get_estimated_duration_minutes( 'dashboard' );

		$fields[] = [
			'id'          => 'interactive_tour',
			'menu_id'     => 'general',
			'group_id'    => 'general',
			'type'        => 'button',
			'action'      => 'tour_start',
			'url'         => admin_url( 'admin.php?page=burst&tour=dashboard' ),
			'button_text' => __( 'Start Tour', 'burst-statistics' ),
			'label'       => __( 'Interactive Dashboard Tour', 'burst-statistics' ),
			'context'     => sprintf(
				/* translators: %d: estimated tour duration in minutes */
				__( 'Take a %d-minute guided interactive walkthrough to discover Burst Statistics features and workflows.', 'burst-statistics' ),
				$duration
			),
			'comment'     => sprintf(
				/* translators: %d: estimated tour duration in minutes */
				__( 'Take a %d-minute guided interactive walkthrough to discover Burst Statistics features and workflows.', 'burst-statistics' ),
				$duration
			),
			'disabled'    => false,
			'default'     => false,
		];

		return $fields;
	}

	/**
	 * Force setting field to default value during the tour.
	 *
	 * @param array<string, mixed> $field Field definition.
	 * @return array<string, mixed>
	 */
	public function reset_field_in_tour( array $field ): array {
		if ( self::is_tour_requested() && isset( $field['default'] ) ) {
			$field['value'] = $field['default'];
		}
		return $field;
	}
}
