<?php

namespace Burst\Admin\Reports;

use Burst\Admin\Mailer\Mailer;
use Burst\Admin\Reports\DomainTypes\Report_Content_Block;
use Burst\Admin\Reports\DomainTypes\Report_Date_Range;
use Burst\Admin\Reports\DomainTypes\Report_Day_Of_Week;
use Burst\Admin\Reports\DomainTypes\Report_Format;
use Burst\Admin\Reports\DomainTypes\Report_Frequency;
use Burst\Admin\Reports\DomainTypes\Report_Log_Status;
use Burst\Admin\Reports\DomainTypes\Report_Week_Of_Month;
use Burst\Admin\Statistics\Statistics_Query;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;

use function Burst\burst_loader;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class to send an e-mail
 */
if ( ! class_exists( 'Burst\Admin\Reports\Reports' ) ) {
	class Reports {
		use Helper;
		use Admin_Helper;
		use Database_Helper;

		/**
		 * Constructor
		 */
		public function init(): void {
			add_action( 'burst_install_tables', [ $this, 'install_reports_table' ] );
			add_action( 'rest_api_init', [ $this, 'register_rest_routes' ] );
			add_action( 'burst_every_hour', [ $this, 'maybe_send_report' ] );
			add_action( 'burst_send_email_batch', [ $this, 'handle_email_batch' ], 10, 3 );
			add_filter( 'burst_all_tables', [ $this, 'burst_add_reports_table' ] );
			add_filter( 'burst_do_action', [ $this, 'do_action_handler' ], 10, 3 );
			add_filter( 'burst_get_action', [ $this, 'get_action_handler' ], 10, 3 );
			add_action( 'burst_create_report_from_onboarding', [ $this, 'create_report_from_onboarding' ] );
			add_filter( 'burst_allowed_field_types', [ $this, 'allowed_field_types' ] );
		}

		/**
		 * Add 'wysiwyg' to the list of allowed field types
		 *
		 * @param array<int, string> $field_types The existing list of field types.
		 * @return array<int, string> The modified list of field types.
		 */
		public function allowed_field_types( array $field_types ): array {
			$field_types[] = 'wysiwyg';
			$field_types[] = 'color_picker';
			return $field_types;
		}

		/**
		 * Create a report from onboarding data
		 *
		 * @param string $email The recipient email.
		 */
		public function create_report_from_onboarding( string $email ): void {
			$data = [
				'name'            => __( 'Weekly Summary', 'burst-statistics' ),
				'format'          => Report_Format::default(),
				'frequency'       => Report_Frequency::default(),
				'dayOfWeek'       => Report_Day_Of_Week::MONDAY,
				'sendTime'        => '09:00',
				'content'         => Report_Content_Block::default(),
				'recipients'      => [ $email ],
				'enabled'         => 1,
				'reportDateRange' => Report_Date_Range::LAST_WEEK,
				'scheduled'       => 1,
			];

			$this->create_report( $data );
		}

		/**
		 * Get all enabled and scheduled reports
		 *
		 * @param string $output The output format.
		 * @return array|object The list of enabled scheduled reports.
		 */
		public function get_enabled_scheduled_reports( string $output = ARRAY_A ): array|object {
			global $wpdb;

			return $wpdb->get_results(
				"SELECT * FROM {$wpdb->prefix}burst_reports WHERE enabled=1 AND scheduled=1",
				$output
			);
		}

		/**
		 * Handle email batch sending
		 */
		public function handle_email_batch( int $report_id, string $queue_id, ?int $batch_id ): void {
			self::error_log( "Report email: cron burst_send_email_batch fired for report $report_id, queue $queue_id, batch " . ( $batch_id ?? 'null' ) . '.' );

			$report = new Report( $report_id );

			if ( empty( $report->id ) ) {
				self::error_log( "Report email: report $report_id not found, aborting batch send." );
				return;
			}

			self::error_log( 'Report email: report loaded with ' . count( $report->recipients ) . ' recipient(s), frequency ' . $report->frequency . ', format ' . $report->format . '.' );

			$mailer = new Mailer();
			$mailer->set_to( $report->recipients )
				->set_report_id( $report->id )
				->set_queue_id( $queue_id )
				->set_batch_id( $batch_id );

			self::error_log( "Report email: building report content for report $report_id." );
			$story_url = $this->build_report( $mailer, $report->frequency, $report->content, $report->format );

			if ( 1 === $batch_id && 'both' === $report->channels && $report->format === Report_Format::STORY ) {
				$story_url = $mailer->get_read_more_button_url() ?: ( $story_url ?: $this->get_story_url( $report->id ) );
				$facts     = [
					__( 'Frequency', 'burst-statistics' )  => ucfirst( $report->frequency ),
					__( 'Date Range', 'burst-statistics' ) => $report->date_range,
				];

				$notification = new \Burst\Admin\Notifications\Notification(
					'report.story',
					$this->get_title_string( $report->scheduled, $report->frequency, $mailer->pretty_domain ),
					sprintf(
						// translators: %s is the website domain name.
						__( 'A new analytics report is available for %s.', 'burst-statistics' ),
						$mailer->pretty_domain
					),
					$story_url,
					$facts,
					$report->id,
					$queue_id
				);

				do_action( 'burst_notification', $notification );
			}

			self::error_log( "Report email: handing off to mailer queue for report $report_id, batch " . ( $batch_id ?? 'null' ) . '.' );
			$mailer->send_mail_queue();
		}

		/**
		 * Add reports table to the list of Burst tables
		 *
		 * @param array<int, string> $tables The existing list of tables.
		 * @return array<int, string> The modified list of tables.
		 */
		public function burst_add_reports_table( array $tables ): array {
			$tables[] = 'burst_reports';
			return $tables;
		}

		/**
		 * The set of actions that require manage-level access.
		 */
		private const MANAGE_ACTIONS = [
			'report-create',
			'report-delete',
			'report-update',
			'report-send-report-now',
		];

		/**
		 * Handle report actions
		 *
		 * @param array<string, mixed> $output The output array.
		 * @param string               $action The action to perform.
		 * @param array<string, mixed> $data   The data for the action.
		 * @return array<string, mixed> The modified output array.
		 */
		public function do_action_handler( array $output, string $action, array $data ): array {
			// Write actions require manage-level access; view-only users are blocked here.
			if ( in_array( $action, self::MANAGE_ACTIONS, true ) && ! $this->user_can_manage() ) {
				return [
					'success' => false,
					'message' => 'You do not have permission to perform this action.',
				];
			}

			return match ( $action ) {
				'report-create'          => $this->create_report( $data ),
				'report-delete'          => $this->delete_report( $data ),
				'report-update'          => $this->update_report( $data ),
				'report-send-report-now' => $this->send_report_now_action( $data ),
				'report-preview'         => $this->get_report_preview( $data ),
				default                  => $output,
			};
		}

		/**
		 * Handle get actions for reports
		 *
		 * @param array<string, mixed>      $output The output array.
		 * @param string                    $action The action to perform.
		 * @param array<string, mixed>|null $data   The data for the action.
		 * @return array<string, mixed> The modified output array.
		 */
		public function get_action_handler( array $output, string $action, ?array $data ): array {
			if ( $action === 'story-report-data' ) {
				return $this->get_story_report_data( $data );
			}
			return $output;
		}

		/**
		 * Send a report immediately action
		 *
		 * @param array<string, mixed> $data The data for the action.
		 * @return array<string, mixed> The output array.
		 */
		public function send_report_now_action( array $data ): array {
			if ( empty( $data['id'] ) ) {
				return [
					'success' => false,
					'message' => 'Report ID is required.',
				];
			}

			$report = new Report( (int) $data['id'] );

			if ( empty( $report->id ) ) {
				return [
					'success' => false,
					'message' => 'Report not found.',
				];
			}

			$report->set_next_send_timestamp( time() );

			// Use a dedicated test queue ID so a manual send never collides with
			// (and thereby suppresses) the automatic send scheduled for the same
			// day, and vice versa.
			return $this->send_report_instance( $report, $this->get_test_queue_id() );
		}


		/**
		 * Delete an existing report
		 *
		 * @param array<string, mixed> $data The data for the report deletion.
		 * @return array<string, mixed> The output array.
		 */
		private function delete_report( array $data ): array {
			if ( ! isset( $data['id'] ) ) {
				return [
					'success' => false,
					'message' => 'Report ID is required for deletion.',
				];
			}

			$report = new Report( (int) $data['id'] );

			if ( empty( $report->id ) ) {
				return [
					'success' => false,
					'message' => 'Report not found.',
				];
			}

			if ( ! $report->delete() ) {
				return [
					'success' => false,
					'message' => 'Failed to delete report.',
				];
			}

			return [
				'success' => true,
				'message' => __( 'Report deleted successfully.', 'burst-statistics' ),
			];
		}

		/**
		 * Update an existing report
		 *
		 * @param array<string, mixed> $data The data for the report update.
		 * @return array<string, mixed> The output array.
		 */
		private function update_report( array $data ): array {
			if ( ! isset( $data['id'] ) ) {
				return [
					'success' => false,
					'message' => 'Report ID is required for update.',
				];
			}

			$report = new Report( (int) $data['id'] );

			if ( empty( $report->id ) ) {
				return [
					'success' => false,
					'message' => 'Report not found.',
				];
			}

			$map = [
				'name'            => 'name',
				'format'          => 'format',
				'frequency'       => 'frequency',
				'fixedEndDate'    => 'fixed_end_date',
				'dayOfWeek'       => 'day_of_week',
				'weekOfMonth'     => 'week_of_month',
				'sendTime'        => 'send_time',
				'content'         => 'content',
				'recipients'      => 'recipients',
				'channels'        => 'channels',
				'enabled'         => 'enabled',
				'scheduled'       => 'scheduled',
				'reportDateRange' => 'date_range',
			];

			// Capture original content before overwriting (used for AI summary regeneration check).
			$original_content = $report->content;

			foreach ( $map as $request_key => $property ) {
				if ( array_key_exists( $request_key, $data ) ) {
					if ( 'channels' === $request_key ) {
						$report->set_channels( (string) $data['channels'] );
					} else {
						$report->{$property} = $data[ $request_key ];
					}

					if ( $request_key === 'frequency' ) {
						if ( $data[ $request_key ] === Report_Frequency::DAILY ) {
							$report->day_of_week   = Report_Day_Of_Week::default();
							$report->week_of_month = Report_Week_Of_Month::default();
						} elseif ( $data[ $request_key ] === Report_Frequency::WEEKLY ) {
							$report->week_of_month = Report_Week_Of_Month::default();
						}
					}
				}
			}

			// For scheduled reports, anchor fixed_end_date to "yesterday" at save
			// time so the shared story link reflects a recent window until the
			// next email send refreshes it again via build_report().
			if ( $report->scheduled ) {
				$report->fixed_end_date = gmdate( 'Y-m-d', strtotime( 'yesterday' ) );
			}

			if ( ! $report->save() ) {
				return [
					'success' => false,
					'message' => 'Failed to update report.',
				];
			}

			// Generate and persist AI summary when the block is newly added or empty.
			$had_ai_block_before = self::has_ai_summary_block( $original_content );
			$has_ai_block_now    = self::has_ai_summary_block( $report->content );
			if (
				$has_ai_block_now &&
				Report_AI_Summary::is_available() &&
				( ! $had_ai_block_before || '' === $report->ai_summary )
			) {
				$rendered_blocks = $this->render_report_blocks( $report );
				$summary         = (string) apply_filters( 'burst_report_ai_summary', '', $report, $rendered_blocks, null );
				if ( '' !== $summary ) {
					self::persist_ai_summary( $report->id, $summary, $report->ai_summary_period );
				}
			}

			return [
				'success' => true,
				'report'  => $report->to_array(),
			];
		}

		/**
		 * Create a new report
		 *
		 * @param array<string, mixed> $data The data for the new report.
		 * @return array<string, mixed> The output array.
		 */
		private function create_report( array $data ): array {
			$required_fields = [
				'name',
				'format',
				'frequency',
				'sendTime',
				'content',
				'recipients',
				'enabled',
				'scheduled',
			];

			$missing_fields = [];

			foreach ( $required_fields as $field ) {
				if ( ! array_key_exists( $field, $data ) ) {
					$missing_fields[] = $field;
				}
			}

			if ( ! empty( $missing_fields ) ) {
				return [
					'success' => false,
					'message' => sprintf(
						// translators: %s is a list of required fields.
						'The following fields are required: %s.',
						implode( ', ', $missing_fields )
					),
				];
			}

			$report      = new Report();
			$day_of_week = Report_Day_Of_Week::default();
			if ( Report_Frequency::WEEKLY === $data['frequency'] || Report_Frequency::MONTHLY === $data['frequency'] ) {
				$day_of_week = ! empty( $data['dayOfWeek'] ) ? $data['dayOfWeek'] : Report_Day_Of_Week::MONDAY;
			}

			$week_of_month = Report_Week_Of_Month::default();
			if ( Report_Frequency::MONTHLY === $data['frequency'] ) {
				$week_of_month = ! empty( $data['weekOfMonth'] ) ? $data['weekOfMonth'] : Report_Week_Of_Month::FIRST;
			}

			$report->set_name( $data['name'] )
					->set_format( $data['format'] )
					->set_frequency( $data['frequency'] )
					->set_day_of_week( $day_of_week )
					->set_week_of_month( $week_of_month )
					->set_send_time( $data['sendTime'] )
					->set_content( $data['content'] )
					->set_date_range( $data['reportDateRange'] )
					->set_recipients( $data['recipients'] )
					->set_channels( $data['channels'] ?? burst_get_option( 'default_report_channels', 'email' ) )
					->set_enabled( $data['enabled'] )
					->set_scheduled( $data['scheduled'] );

			// For scheduled reports, anchor fixed_end_date to "yesterday" at save
			// time so the shared story link reflects a recent window until the
			// next email send refreshes it again via build_report().
			if ( $report->scheduled ) {
				$report->set_fixed_end_date( gmdate( 'Y-m-d', strtotime( 'yesterday' ) ) );
			}

			if ( ! $report->save() ) {
				return [
					'success' => false,
					'message' => 'Failed to create report.',
				];
			}

			// Generate and persist AI summary for new reports that include the ai_summary block.
			if (
				null !== $report->id &&
				self::has_ai_summary_block( $report->content ) &&
				Report_AI_Summary::is_available()
			) {
				$rendered_blocks = $this->render_report_blocks( $report );
				$summary         = (string) apply_filters( 'burst_report_ai_summary', '', $report, $rendered_blocks, null );
				if ( '' !== $summary ) {
					self::persist_ai_summary( $report->id, $summary, '' );
				}
			}

			return [
				'success' => true,
				'report'  => $report->to_array(),
			];
		}

		/**
		 * Register REST API routes
		 */
		public function register_rest_routes(): void {
			register_rest_route(
				'burst/v1',
				'/reports',
				[
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => [ $this, 'get_reports' ],
					'permission_callback' => function () {
						return $this->user_can_manage();
					},
				]
			);

			register_rest_route(
				'burst/v1',
				'do_action/report/(?P<action>[a-z\_\-]+)',
				[
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => [ $this, 'do_action' ],
					'permission_callback' => function () {
						return $this->has_admin_access();
					},
				]
			);
		}

		/**
		 * Handle report actions
		 *
		 * @param \WP_REST_Request $request The REST request object.
		 * @return \WP_REST_Response The REST response object.
		 */
		public function do_action( \WP_REST_Request $request ): \WP_REST_Response {
			$action = sanitize_title( $request->get_param( 'action' ) );
			$action = sprintf( 'report-%s', $action );

			$request->set_param( 'action', $action );

			return burst_loader()->admin->app->do_action( $request );
		}

		/**
		 * Get the report data
		 *
		 * @param array $data The REST request object.
		 * @return array The response.
		 */
		public function get_story_report_data( array $data ): array {
			if ( empty( $data['token'] ) || ! self::validate_share_token( $data['token'] ) ) {
				return [];
			}

			$share       = burst_loader()->admin->share;
			$token       = $data['token'];
			$report      = null;
			$share_links = $share->tokens->get_share_links( 'report', $token );

			if ( ! empty( $share_links ) ) {
				// Get first share link.
				$share_links = array_values( $share_links );
				$share_link  = $share_links[0];
				$report_id   = $share_link['report_id'];
				$report      = new Report( $report_id, true );
			}

			if ( ob_get_length() ) {
				ob_clean();
			}

			// Resolve the logo URL server-side so it's available without wp.media in the story view.
			$logo_attachment_id = (int) burst_get_option( 'logo_attachment_id', 0 );
			$logo_url           = '';
			if ( $logo_attachment_id > 0 ) {
				$image_src = wp_get_attachment_image_src( $logo_attachment_id, 'medium' )
					?: wp_get_attachment_image_src( $logo_attachment_id, 'large' )
					?: wp_get_attachment_image_src( $logo_attachment_id, 'full' );
				if ( $image_src ) {
					$logo_url = $image_src[0];
				}
			}

			// Same pattern for the dark mode logo.
			$logo_attachment_id_dark = (int) burst_get_option( 'logo_attachment_id_dark', 0 );
			$logo_url_dark           = '';
			if ( $logo_attachment_id_dark > 0 ) {
				$image_src = wp_get_attachment_image_src( $logo_attachment_id_dark, 'medium' )
					?: wp_get_attachment_image_src( $logo_attachment_id_dark, 'large' )
					?: wp_get_attachment_image_src( $logo_attachment_id_dark, 'full' );
				if ( $image_src ) {
					$logo_url_dark = $image_src[0];
				}
			}

			// Same pattern for the hero background image (used in the right column of HeroBlock).
			$hero_bg_attachment_id = (int) burst_get_option( 'hero_background_image_attachment_id', 0 );
			$hero_bg_url           = '';
			if ( $hero_bg_attachment_id > 0 ) {
				$image_src = wp_get_attachment_image_src( $hero_bg_attachment_id, 'large' )
					?: wp_get_attachment_image_src( $hero_bg_attachment_id, 'full' )
					?: wp_get_attachment_image_src( $hero_bg_attachment_id, 'medium' );
				if ( $image_src ) {
					$hero_bg_url = $image_src[0];
				}
			}

			// Same pattern for the dark mode hero background image.
			$hero_bg_attachment_id_dark = (int) burst_get_option( 'hero_background_image_attachment_id_dark', 0 );
			$hero_bg_url_dark           = '';
			if ( $hero_bg_attachment_id_dark > 0 ) {
				$image_src = wp_get_attachment_image_src( $hero_bg_attachment_id_dark, 'large' )
					?: wp_get_attachment_image_src( $hero_bg_attachment_id_dark, 'full' )
					?: wp_get_attachment_image_src( $hero_bg_attachment_id_dark, 'medium' );
				if ( $image_src ) {
					$hero_bg_url_dark = $image_src[0];
				}
			}

			$brand_color                = sanitize_hex_color( (string) burst_get_option( 'brand_color', '#2B8133' ) ) ?: '#2B8133';
			$hero_color_overlay_enabled = (bool) burst_get_option( 'hero_color_overlay_enabled', true );
			$report_array               = ! empty( $report ) ? $report->to_array() : null;

			if ( ! empty( $report ) && ! empty( $report->content ) && ! empty( $report->ai_summary ) ) {
				// Inject the stored AI summary text into the content block for rendering.
				if ( ! empty( $report_array['content'] ) ) {
					foreach ( $report_array['content'] as &$b ) {
						if ( is_array( $b ) && isset( $b['id'] ) && Report_Content_Block::AI_SUMMARY === $b['id'] ) {
							$b['content'] = $report->ai_summary;
						}
					}
					unset( $b );
				}
			}

			// Custom CSS is sanitized on save (the 'css' field type), but re-read raw here so the
			// publicly shared story view stays in sync with the stored value.
			$custom_css = (string) burst_get_option( 'custom_css', '' );

			return [
				'request_success'                => true,
				'report'                         => $report_array,
				'logo_url'                       => $logo_url,
				'logo_url_dark'                  => $logo_url_dark,
				'hero_background_image_url'      => $hero_bg_url,
				'hero_background_image_url_dark' => $hero_bg_url_dark,
				'brand_color'                    => $brand_color,
				'hero_color_overlay_enabled'     => $hero_color_overlay_enabled,
				'custom_css'                     => $custom_css,
			];
		}


		/**
		 * Get the report preview html
		 *
		 * @param array $data The REST request object.
		 * @return array The response.
		 */
		public function get_report_preview( array $data ): array {
			$blocks = $data['blocks'];
			if ( is_array( $blocks ) ) {
				$report = new Report();
				$blocks = $report->sanitize_content( $blocks );
			} else {
				$blocks = Report_Content_Block::default();
			}

			$frequency    = Report_Frequency::from_string( $data['frequency'] );
			$preview_html = $this->get_report_template( $blocks, $frequency );

			if ( ob_get_length() ) {
				ob_clean();
			}

			return [
				'request_success' => true,
				'preview_html'    => $preview_html,
			];
		}

		/**
		 * Get all reports
		 *
		 * @param \WP_REST_Request $request The REST request object.
		 * @return \WP_REST_Response The REST response containing the list of reports.
		 */
		public function get_reports( \WP_REST_Request $request ): \WP_REST_Response {
			if ( ! $this->user_can_manage() ) {
				return new \WP_REST_Response(
					[
						'success' => false,
						'message' => 'You do not have permission to manage reports.',
					]
				);
			}

			$nonce = $request->get_param( 'nonce' );
			if ( ! $this->verify_nonce( $nonce, 'burst_nonce' ) ) {
				return new \WP_REST_Response(
					[
						'success' => false,
						'message' => burst_loader()->admin->app->nonce_expired_feedback,
					]
				);
			}

			global $wpdb;

			$ids = $wpdb->get_col(
				"SELECT ID FROM {$wpdb->prefix}burst_reports ORDER BY last_edit DESC"
			);

			$reports = [];

			foreach ( $ids as $id ) {
				$report = new Report( (int) $id );
				if ( empty( $report->id ) ) {
					continue;
				}

				$reports[] = $report->to_array();
			}

			return new \WP_REST_Response(
				[
					'request_success' => true,
					'data'            => [
						'reports' => $reports,
					],
				],
				200
			);
		}


		/**
		 * Install reports table
		 */
		public function install_reports_table(): void {
			global $wpdb;

			$charset_collate = $wpdb->get_charset_collate();

			$sql = "CREATE TABLE {$wpdb->prefix}burst_reports (
				`ID` int unsigned NOT NULL AUTO_INCREMENT,
				`name` varchar(255) NOT NULL,
				`date_range` varchar(32) NOT NULL,
				`format` varchar(32) NOT NULL,
				`frequency` varchar(16) NOT NULL,
				`fixed_end_date` date DEFAULT NULL,
				`day_of_week` varchar(9) DEFAULT NULL,
				`week_of_month` int DEFAULT NULL,
				`send_time` varchar(5) NOT NULL,
				`last_edit` int unsigned NOT NULL,
				`enabled` tinyint(1) NOT NULL DEFAULT 1,
				`scheduled` tinyint(1) NOT NULL DEFAULT 0,
				`content` longtext NOT NULL,
				`recipients` longtext NOT NULL,
				`channels` varchar(32) NOT NULL DEFAULT 'email',
				`ai_summary` longtext DEFAULT NULL,
				`ai_summary_period` varchar(255) DEFAULT NULL,
				PRIMARY KEY (`ID`)
			) {$charset_collate};";

			require_once ABSPATH . 'wp-admin/includes/upgrade.php';
			dbDelta( $sql );

			if ( ! empty( $wpdb->last_error ) ) {
				self::error_log( 'Error creating burst_reports table: ' . $wpdb->last_error );
			}

			// Add indexes. ID is already the PRIMARY KEY, so it is not indexed again here.
			$indexes = [
				'burst_reports' => [
					[ 'enabled' ],
					[ 'frequency' ],
					[ 'day_of_week' ],
				],
			];

			foreach ( $indexes as $table => $table_indexes ) {
				foreach ( $table_indexes as $index ) {
					$this->add_index( 'burst_reports', $index );
				}
			}
		}

		/**
		 * Get Queue ID from next send timestamp.
		 *
		 * @param int $next_send_timestamp The next send timestamp.
		 * @return string The generated Queue ID.
		 */
		public function get_queue_id_from_timestamp( int $next_send_timestamp ): string {
			return gmdate( 'Y-m-d', $next_send_timestamp );
		}

		/**
		 * Build a unique queue ID for a manual ("send now") send.
		 *
		 * Manual sends use a `test-{Y-m-d}-{timestamp}` queue ID so they never
		 * collide with the date-based queue ID of the automatic send for the same
		 * day. A collision would make either send skip the other via the
		 * per-queue de-duplication in the mailer. The date portion is still
		 * recoverable for log grouping via extract_date_from_queue_id().
		 *
		 * @return string The generated test queue ID.
		 */
		public function get_test_queue_id(): string {
			$now = time();
			return 'test-' . gmdate( 'Y-m-d', $now ) . '-' . $now;
		}

		/**
		 * Send a report instance.
		 *
		 * @param Report      $report   The report object.
		 * @param string|null $queue_id Explicit queue ID; when null it is derived from the report's send timestamp.
		 * @return array The result of the send operation.
		 */
		private function send_report_instance( Report $report, ?string $queue_id = null ): array {
			self::error_log( "Report email: send_report_instance called for report $report->id." );

			if ( empty( $report->recipients ) ) {
				self::error_log( "Report email: report $report->id has no recipients, aborting." );
				return [
					'success' => false,
					'message' => __( 'No recipients specified for the report.', 'burst-statistics' ),
				];
			}

			$report_id = $report->id;
			$queue_id  = $queue_id ?? $this->get_queue_id_from_timestamp( $report->next_send_timestamp );
			$batch_id  = 1;

			self::error_log( "Report email: prepared queue $queue_id for report $report_id (" . count( $report->recipients ) . ' recipient(s)).' );

			if ( ! wp_next_scheduled( 'burst_send_email_batch', [ $report_id, $queue_id, $batch_id ] ) ) {
				if ( ! Report_Logs::instance()->parent_processing_exists(
					$report_id,
					$queue_id
				) ) {
					Report_Logs::instance()->insert_log(
						$report_id,
						$queue_id,
						null,
						Report_Log_Status::PROCESSING,
						Report_Log_Status::get_log_message( Report_Log_Status::PROCESSING )
					);
				}

				self::error_log( "Report email: scheduling first batch for queue $queue_id (report $report_id) in 5 minutes." );
				wp_schedule_single_event(
					time() + 5 * MINUTE_IN_SECONDS,
					'burst_send_email_batch',
					[ $report_id, $queue_id, $batch_id ]
				);
			} else {
				self::error_log( "Report email: first batch for queue $queue_id (report $report_id) is already scheduled, not rescheduling." );
			}
			return [
				'success' => true,
				'message' => __( 'Sending of report scheduled.', 'burst-statistics' ),
			];
		}

		/**
		 * Check if we need to send a report.
		 */
		public function maybe_send_report(): void {
			if ( ! $this->table_exists( 'burst_reports' ) ) {
				self::error_log( 'Report email: maybe_send_report aborted, burst_reports table does not exist.' );
				return;
			}

			global $wpdb;

			$ids = $wpdb->get_col(
				"SELECT ID FROM {$wpdb->prefix}burst_reports WHERE enabled = 1 AND scheduled = 1"
			);

			self::error_log( 'Report email: maybe_send_report found ' . count( $ids ) . ' enabled & scheduled report(s) to evaluate.' );

			foreach ( $ids as $id ) {
				$report = new Report( (int) $id );

				// The most recent scheduled occurrence at or before now (or null
				// when the report has no usable schedule).
				$due = $report->next_send_timestamp;
				if ( empty( $due ) ) {
					self::error_log( "Report email: report $id has no due send moment, skipping." );
					continue;
				}

				$now = time();

				// Catch-up window: a missed occurrence may still be sent for some
				// time after its target (e.g. when cron only runs sporadically on
				// low-traffic sites, so no tick lands between the target time and
				// local midnight), but very stale occurrences are not resurrected.
				$catch_up_window = (int) apply_filters( 'burst_report_catch_up_window', DAY_IN_SECONDS, $report );
				if ( $now - $due > $catch_up_window ) {
					self::error_log( "Report email: report $id due moment $due is older than the catch-up window ($catch_up_window s), skipping." );
					continue;
				}

				// De-duplicate per occurrence: once this occurrence's batch has
				// been queued/sent, it is logged and must not be sent again. This
				// is what makes the catch-up window safe to keep re-evaluating.
				$queue_id = $this->get_queue_id_from_timestamp( $due );
				if ( Report_Logs::instance()->queue_exists( $report->id, $queue_id, 1 ) ) {
					self::error_log( "Report email: report $id occurrence $queue_id already sent, skipping." );
					continue;
				}

				// Guard against two parallel cron processes entering at once,
				// before the first one has had a chance to write its log entry.
				$transient_key = 'burst_report_sent_' . $report->id;
				if ( get_transient( $transient_key ) ) {
					self::error_log( "Report email: report $id already handled in this run (transient set), skipping." );
					continue;
				}
				set_transient( $transient_key, $due, 5 * MINUTE_IN_SECONDS );

				$this->send_report_instance( $report );
			}
		}

		/**
		 * Get the report template HTML.
		 *
		 * @param array<string, mixed> $blocks    The blocks to include in the report.
		 * @param string               $frequency The frequency of the report.
		 * @return string The rendered report HTML.
		 */
		public function get_report_template( array $blocks, string $frequency ): string {
			$mailer = new Mailer();
			$this->build_report( $mailer, $frequency, $blocks, 'classic' );

			return $mailer->render();
		}

		/**
		 * Get blocks for the email report.
		 *
		 * @return array<int, array<string, mixed>> List of blocks for the email report.
		 */
		public function get_blocks(): array {
			$blocks = require BURST_PATH . 'includes/Admin/Mailer/config/blocks.php';
			return apply_filters( 'burst_email_blocks', $blocks );
		}

		/**
		 * Get top results for the email report.
		 *
		 * @return array<int, array<int, string>> List of results
		 */
		public function get_top_results( int $start_date, int $end_date, Statistics_Query $qd ): array {
			$results = [];
			$qd->limit( (int) apply_filters( 'burst_mail_report_limit', 5 ) );
			$qd->date_range( $start_date, $end_date );
			$raw_results = $qd->fetch( ARRAY_A );

			$raw_results = apply_filters( 'burst_mail_report_results', $raw_results, $qd, $start_date, $end_date );

			// filter out rows where one of the columns === 'Direct.
			$raw_results = array_filter(
				$raw_results,
				function ( $row ) {
					return ! in_array( 'Direct / unknown', $row, true );
				}
			);

			$raw_results = array_map(
				function ( $row ) {
					foreach ( $row as $key => &$value ) {
						if ( strpos( $key, '_rate' ) !== false && is_numeric( $value ) ) {
							$value = round( (float) $value, 1 ) . '%';
						}
					}
					return $row;
				},
				$raw_results
			);

			return $results + array_map(
				function ( $row ) {
					if ( count( $row ) <= 2 ) {
						return $row;
					}
					$all_but_last = array_filter( array_slice( $row, 0, -1 ), fn( $v ) => $v !== null && $v !== '' );
					$last         = end( $row );
					return [ implode( '-', $all_but_last ), $last ];
				},
				$raw_results
			);
		}

		/**
		 * Get compare data for the email report.
		 *
		 * @return array<int, array{0: string, 1: array{raw: string}}> List of compare rows grouped by type.
		 */
		private function get_compare_data( int $date_start, int $date_end, int $compare_date_start, int $compare_date_end, array $filters = [] ): array {
			$args = [
				'date_start'         => $date_start,
				'date_end'           => $date_end,
				'compare_date_start' => $compare_date_start,
				'compare_date_end'   => $compare_date_end,
				'filters'            => $filters,
			];

			$stats        = isset( \Burst\burst_loader()->admin, \Burst\burst_loader()->admin->statistics )
				? \Burst\burst_loader()->admin->statistics
				: new \Burst\Admin\Statistics\Statistics();
			$compare_data = $stats->get_compare_data( $args );
			// For current bounced sessions percentage calculation.
			if ( ( (int) $compare_data['current']['sessions'] + (int) $compare_data['current']['bounced_sessions'] ) > 0 ) {
				$compare_data['current']['bounced_sessions'] = round(
					$compare_data['current']['bounced_sessions'] /
					( $compare_data['current']['sessions'] + $compare_data['current']['bounced_sessions'] ) * 100,
					1
				);
			} else {
				// Handle the case where the division would be by zero, for example, set to 0 or another default value.
				// or another appropriate value or handling.
				$compare_data['current']['bounced_sessions'] = 0;
			}

			// For previous bounced sessions percentage calculation.
			if ( ( (int) $compare_data['previous']['sessions'] + (int) $compare_data['previous']['bounced_sessions'] ) > 0 ) {
				$compare_data['previous']['bounced_sessions'] = round(
					$compare_data['previous']['bounced_sessions'] /
					( $compare_data['previous']['sessions'] + $compare_data['previous']['bounced_sessions'] ) * 100,
					1
				);
			} else {
				// Similarly, handle the case where the division would be by zero.
				// or another appropriate value or handling.
				$compare_data['previous']['bounced_sessions'] = 0;
			}

			$types   = [ 'pageviews', 'sessions', 'visitors', 'bounced_sessions' ];
			$compare = [];
			foreach ( $types as $type ) {
				$compare[] = $this->get_compare_row( $type, $compare_data );
			}
			return $compare;
		}

		/**
		 * Get a compare row for the email report.
		 *
		 * @param string $type The metric type (e.g., 'pageviews', 'sessions').
		 * @param array  $compare_data The current and previous data for comparison.
		 * @return array{0: string, 1: array{raw: string}} The title (untrusted text) and the pre-rendered, trusted uplift HTML.
		 */
		private function get_compare_row( string $type, array $compare_data ): array {
			$data = [
				'pageviews'        => [
					'title' => __( 'Pageviews', 'burst-statistics' ),
				],
				'sessions'         => [
					'title' => __( 'Sessions', 'burst-statistics' ),
				],
				'visitors'         => [
					'title' => __( 'Visitors', 'burst-statistics' ),
				],
				'bounced_sessions' => [
					'title' => __( 'Bounce rate', 'burst-statistics' ),
				],
			];

			$current  = $compare_data['current'][ $type ];
			$previous = $compare_data['previous'][ $type ];
			$stats    = isset( \Burst\burst_loader()->admin, \Burst\burst_loader()->admin->statistics )
				? \Burst\burst_loader()->admin->statistics
				: new \Burst\Admin\Statistics\Statistics();
			$uplift   = $stats->calculate_uplift( $current, $previous );

			$color = $uplift >= 0 ? '#2e8a37' : '#d7263d';
			if ( $type === 'bounced_sessions' ) {
				$color = $uplift > 0 ? '#d7263d' : '#2e8a37';
				// add % after bounce rate.
				$current = $current . '%';
			}
			$uplift = $uplift > 0 ? '+' . $uplift : $uplift;
			return [
				$data[ $type ]['title'],
				// Pre-rendered, plugin-generated HTML: a fixed colour palette plus
				// numeric values that are already escaped here. Wrapped as 'raw' so
				// format_array_as_table() emits it verbatim instead of escaping the
				// markup into visible tags.
				[
					'raw' => '<span style="font-size: 13px; color: ' . esc_attr( $color ) . '">' . esc_html( $uplift ) . '%</span>&nbsp;<span>' . esc_html( $current ) . '</span>',
				],
			];
		}
		/**
		 * Format an array as an HTML table.
		 *
		 * @param array $input_array The array to format.
		 * @return string The formatted HTML table.
		 */
		public static function format_array_as_table( array $input_array ): string {
			$html = '';
			if ( isset( $input_array['header'] ) ) {
				$row       = $input_array['header'];
				$html     .= '<tr style="line-height: 32px">';
				$first_row = true;
				foreach ( $row as $column ) {
					if ( $first_row ) {
						$html .= '<th style="text-align: left; font-size: 14px; font-weight: 400">' . self::render_table_cell( $column ) . '</th>';
					} else {
						$html .= '<th style="text-align: right; font-size: 14px; font-weight: 400">' . self::render_table_cell( $column ) . '</th>';
					}
					$first_row = false;
				}
				$html .= '</tr>';
				unset( $input_array['header'] );
			}
			foreach ( $input_array as $row ) {
				$html     .= '<tr style="line-height: 32px">';
				$first_row = true;
				foreach ( $row as $column ) {
					if ( $first_row ) {
						// max 45 characters add ...
						if ( $column === null ) {
							$column = __( 'Direct / unknown', 'burst-statistics' );
						}
						if ( ! is_numeric( $column ) ) {
							if ( strlen( $column ) > 35 ) {
								$column = substr( $column, 0, 35 ) . '...';
							}
						}
						$html .= '<td style="width: fit-content; text-align: left;">' . self::render_table_cell( $column ) . '</td>';
					} else {
						$html .= '<td style="width: fit-content; text-align: right;">' . self::render_table_cell( $column ) . '</td>';
					}
					$first_row = false;
				}
				$html .= '</tr>';

			}

			return $html;
		}

		/**
		 * Render a single report-table cell.
		 *
		 * Untrusted values (page titles, referrers, campaign values that originate
		 * from visitors) are escaped. Cells wrapped as `[ 'raw' => $html ]` are
		 * trusted, plugin-generated HTML (e.g. the compare block's colour-coded
		 * uplift indicator) and are emitted verbatim; the mailer still runs
		 * wp_kses_post() over the whole table as a final backstop.
		 *
		 * @param string|array $column Cell value: a string of untrusted text, or a
		 *                             `[ 'raw' => string ]` wrapper of trusted HTML.
		 * @return string The escaped or trusted cell inner HTML.
		 */
		private static function render_table_cell( string|array $column ): string {
			if ( is_array( $column ) ) {
				return isset( $column['raw'] ) ? (string) $column['raw'] : '';
			}
			return esc_html( $column );
		}

		/**
		 * Get the report title string.
		 */
		private function get_title_string( bool $scheduled, string $frequency, string $domain ): string {
			if ( ! $scheduled ) {
				// translators: %s is the domain name.
				$title_string = _x( 'Your analytics insights for %s are here!', 'domain name', 'burst-statistics' );
			} else {
				$title_string = match ( $frequency ) {
					Report_Frequency::DAILY =>
						// translators: %s is the domain name.
					_x( 'Your daily insights for %s are here!', 'domain name', 'burst-statistics' ),
					Report_Frequency::MONTHLY =>
						// translators: %s is the domain name.
					_x( 'Your monthly insights for %s are here!', 'domain name', 'burst-statistics' ),
					default =>
						// translators: %s is the domain name.
					_x( 'Your weekly insights for %s are here!', 'domain name', 'burst-statistics' ),
				};
			}
			return sprintf( $title_string, $domain );
		}
		/**
		 * Persist the AI summary and its period (queue_id) directly to the report row.
		 *
		 * Uses a targeted UPDATE so that `last_edit`, `content`, and `recipients`
		 * are never touched — mirroring the contract of Report::save().
		 *
		 * @param int    $report_id  The report ID.
		 * @param string $summary    The AI-generated summary text.
		 * @param string $period     The queue_id this summary was generated for.
		 */
		private static function persist_ai_summary( int $report_id, string $summary, string $period ): void {
			global $wpdb;
			$wpdb->update(
				$wpdb->prefix . 'burst_reports',
				[
					'ai_summary'        => $summary,
					'ai_summary_period' => $period,
				],
				[ 'ID' => $report_id ],
				[ '%s', '%s' ],
				[ '%d' ]
			);
		}

		/**
		 * Check whether a content array contains the ai_summary block.
		 *
		 * @param array $content The report content array.
		 * @return bool True when the ai_summary block is present.
		 */
		private static function has_ai_summary_block( array $content ): bool {
			foreach ( $content as $block ) {
				if ( is_array( $block ) && isset( $block['id'] ) && Report_Content_Block::AI_SUMMARY === $block['id'] ) {
					return true;
				}
			}
			return false;
		}

		/**
		 * Render structured block data for a report with resolved dates and filters.
		 *
		 * @param Report     $report  The report instance.
		 * @param array|null $content Optional content blocks array; defaults to $report->content.
		 * @return array<string, array<string, mixed>> Rendered blocks keyed by block id.
		 */
		public function render_report_blocks( Report $report, ?array $content = null ): array {
			$raw_content = $content ?? $report->content;
			if ( empty( $raw_content ) ) {
				$raw_content = Report_Content_Block::default();
			}

			$rendered_blocks  = [];
			$available_blocks = $this->get_blocks();
			$aliases          = [
				'compare_story' => Report_Content_Block::COMPARE,
				'pages'         => Report_Content_Block::MOST_VISITED_PAGES,
				'referrers'     => Report_Content_Block::TOP_REFERRERS,
				'locations'     => Report_Content_Block::COUNTRIES,
				'world'         => Report_Content_Block::COUNTRIES,
				'campaigns'     => Report_Content_Block::TOP_CAMPAIGNS,
			];

			$skip_blocks = [
				Report_Content_Block::LOGO,
				Report_Content_Block::HERO,
				Report_Content_Block::TEXT,
				Report_Content_Block::FOOTER,
			];

			foreach ( $raw_content as $item ) {
				$block = is_array( $item ) ? $item : [
					'id'                 => (string) $item,
					'filters'            => [],
					'content'            => '',
					'date_range'         => '',
					'fixed_end_date'     => '',
					'date_range_enabled' => false,
				];

				$block_id = isset( $block['id'] ) ? (string) $block['id'] : '';
				if ( '' === $block_id || in_array( $block_id, $skip_blocks, true ) ) {
					continue;
				}

				if ( Report_Content_Block::AI_SUMMARY === $block_id ) {
					$summary = $report->ai_summary;
					if ( '' !== $summary ) {
						$rendered_blocks[ $block_id ] = [
							'id'       => $block_id,
							'title'    => __( 'Summary', 'burst-statistics' ),
							'subtitle' => '',
							'table'    => '<tr><td style="font-weight: 400; font-size: 14px; line-height: 1.6; color: #475569; padding: 12px 0;">' . wp_kses_post( $summary ) . '</td></tr>',
							'url'      => $this->admin_url( 'burst#/reporting' ),
						];
					}
					continue;
				}

				$canonical_id = $aliases[ $block_id ] ?? $block_id;
				$dates        = Report_Date_Range::resolve_block_dates( $block, $report );
				$filters      = ! empty( $block['filters'] ) && is_array( $block['filters'] ) ? $block['filters'] : [];

				// Check if an extension/pro filter handles this block.
				$custom_block = apply_filters( 'burst_render_report_block', null, $block_id, $block, $dates, $report );
				if ( is_array( $custom_block ) ) {
					$rendered_blocks[ $block_id ] = $custom_block;
					continue;
				}

				if ( Report_Content_Block::COMPARE === $canonical_id ) {
					$stats = isset( burst_loader()->admin, burst_loader()->admin->statistics )
						? burst_loader()->admin->statistics
						: new \Burst\Admin\Statistics\Statistics();

					$diff          = $dates['end'] - $dates['start'];
					$compare_start = $dates['start'] - $diff;
					$compare_end   = $dates['end'] - $diff;

					$compare_args = [
						'date_start'         => $dates['start'],
						'date_end'           => $dates['end'],
						'compare_date_start' => $compare_start,
						'compare_date_end'   => $compare_end,
						'filters'            => $filters,
					];
					$compare_raw  = $stats->get_compare_data( $compare_args );
					$table_rows   = $this->get_compare_data( $dates['start'], $dates['end'], $compare_start, $compare_end, $filters );

					$subtitle = $report->frequency === Report_Frequency::WEEKLY
						? __( 'vs. previous week', 'burst-statistics' )
						: __( 'vs. previous month', 'burst-statistics' );

					$rendered_blocks[ $block_id ] = [
						'id'            => $block_id,
						'title'         => __( 'Compare', 'burst-statistics' ),
						'subtitle'      => $subtitle,
						'table'         => self::format_array_as_table( $table_rows ),
						'url'           => $this->admin_url( 'burst#/statistics' ),
						'period'        => $dates,
						'filters'       => $filters,
						'data'          => $compare_raw,
						'rows'          => $table_rows,
						'comment_text'  => $block['comment_text'] ?? '',
						'comment_title' => $block['comment_title'] ?? '',
					];
					continue;
				}

				// Standard query blocks (most_visited_pages, top_referrers, countries, top_campaigns, devices, etc.).
				$block_def = $available_blocks[ $canonical_id ] ?? null;

				if ( null === $block_def && Report_Content_Block::DEVICES === $canonical_id ) {
					$block_def = [
						'title'      => __( 'Devices', 'burst-statistics' ),
						'query_args' => [
							'select'   => [ 'device', 'pageviews' ],
							'group_by' => 'device',
							'order_by' => 'pageviews DESC',
						],
						'url'        => '#/sources',
						'header'     => [ __( 'Device', 'burst-statistics' ), __( 'Pageviews', 'burst-statistics' ) ],
					];
				}

				if ( null === $block_def ) {
					continue;
				}

				$query_data_args = $block_def['query_args'] ?? $block_def;
				$query_id        = sprintf( 'report_block_%s', sanitize_key( $canonical_id ) );
				$qd              = Statistics_Query::create( $query_id )->apply_args( $query_data_args );

				if ( ! empty( $filters ) ) {
					$qd->filters( $filters );
				}

				$raw_results = $this->get_top_results( $dates['start'], $dates['end'], $qd );
				$table_data  = $raw_results;
				if ( isset( $block_def['header'] ) && is_array( $block_def['header'] ) ) {
					array_unshift( $table_data, $block_def['header'] );
				}

				$url = isset( $block_def['url'] ) ? (string) $block_def['url'] : '#/statistics';

				$rendered_blocks[ $block_id ] = [
					'id'            => $block_id,
					'title'         => $block_def['title'] ?? ucfirst( str_replace( '_', ' ', $block_id ) ),
					'subtitle'      => '',
					'table'         => self::format_array_as_table( $table_data ),
					'url'           => $this->admin_url( 'burst' . $url ),
					'period'        => $dates,
					'filters'       => $filters,
					'rows'          => $raw_results,
					'comment_text'  => $block['comment_text'] ?? '',
					'comment_title' => $block['comment_title'] ?? '',
				];
			}

			return $rendered_blocks;
		}

		/**
		 * Build the report data into the Mailer instance.
		 *
		 * @param Mailer                   $mailer    Mailer instance.
		 * @param string                   $frequency Frequency ('weekly', 'monthly', etc).
		 * @param array<int|string, mixed> $content   Report content blocks.
		 * @param string                   $format    Format ('classic' or 'story').
		 * @return string|null Story URL if generated, null otherwise.
		 */
		private function build_report( Mailer $mailer, string $frequency, array $content, string $format ): ?string {
			$date_range = new Date_Range( $frequency );
			// report_id is 0 when unset; Report::__construct() treats 0 as "no id".
			$report    = new Report( $mailer->report_id );
			$scheduled = $report->scheduled;
			// not scheduled reports should have a fixed end date already.
			if ( $scheduled ) {
				$report->set_fixed_end_date_to_yesterday();
			}

			// Render the report blocks with resolved dates and filters.
			$rendered_blocks = $this->render_report_blocks( $report, $content );

			$title_string = $this->get_title_string( $scheduled, $frequency, $mailer->pretty_domain );
			$mailer->set_subject( $title_string );
			$mailer->set_title( $title_string );

			$mailer->set_message(
				sprintf(
					// translators: %1$s is the start date, %2$s is the end date.
					__( 'This report covers the period from %1$s to %2$s.', 'burst-statistics' ),
					$date_range->start_nice,
					$date_range->end_nice
				)
			);
			$story_url = null;
			// The ai_summary block is the only switch: classic renders it as a block, story adds it to the email as a card.
			$is_classic_with_ai = 'classic' === $format && in_array( Report_Content_Block::AI_SUMMARY, $this->flatten_content_array_for_classic( $content ), true );
			$has_ai_block       = self::has_ai_summary_block( $content ) || $is_classic_with_ai;

			if ( $has_ai_block ) {
				$queue_id   = $mailer->queue_id;
				$is_test    = '' !== $queue_id && str_starts_with( $queue_id, 'test-' );
				$report_id  = $mailer->report_id;
				$need_regen = ! $is_test && $report_id > 0 && '' !== $queue_id && $queue_id !== $report->ai_summary_period;

				if ( $need_regen ) {
					$summary = (string) apply_filters( 'burst_report_ai_summary', '', $report, $rendered_blocks, $date_range );
					if ( '' !== $summary ) {
						self::persist_ai_summary( $report_id, $summary, $queue_id );
						$report->ai_summary        = $summary;
						$report->ai_summary_period = $queue_id;
					}
				} else {
					$summary = $report->ai_summary;
					if ( '' === $summary ) {
						$summary = (string) apply_filters( 'burst_report_ai_summary', '', $report, $rendered_blocks, $date_range );
						if ( '' !== $summary && ! $is_test && $report_id > 0 && '' !== $queue_id ) {
							self::persist_ai_summary( $report_id, $summary, $queue_id );
							$report->ai_summary        = $summary;
							$report->ai_summary_period = $queue_id;
						}
					}
				}

				if ( '' !== $summary && ! $is_classic_with_ai ) {
					$mailer->set_ai_summary( $summary );
				}

				// If classic format has ai_summary block, ensure it's in rendered_blocks.
				if ( '' !== $summary && $is_classic_with_ai ) {
					$rendered_blocks[ Report_Content_Block::AI_SUMMARY ] = [
						'id'       => Report_Content_Block::AI_SUMMARY,
						'title'    => __( 'Summary', 'burst-statistics' ),
						'subtitle' => '',
						'table'    => '<tr><td style="font-weight: 400; font-size: 14px; line-height: 1.6; color: #475569; padding: 12px 0;">' . wp_kses_post( $summary ) . '</td></tr>',
						'url'      => $this->admin_url( 'burst#/reporting' ),
					];
				}
			}

			if ( $format === 'classic' ) {
				$this->build_classic_report( $mailer, $content, $frequency, $date_range, $report, $rendered_blocks );
			} else {
				$story_url = $this->get_story_url( $mailer->report_id );
				$mailer->set_read_more_button_url( $story_url )
				->set_read_more_button_text( __( 'View story', 'burst-statistics' ) )
				->set_read_more_header( '' )
				// translators: %s is the website's domain name (e.g., example.com).
				->set_read_more_teaser( sprintf( __( 'A new report is available for %s.', 'burst-statistics' ), $mailer->pretty_domain ) )
				// Story reports need the "view report" button regardless of footer customization.
				->set_force_read_more( true );
			}

			return $story_url;
		}

		/**
		 * Build classic report content.
		 *
		 * @param Mailer                    $mailer          Mailer instance.
		 * @param array                     $content         Content array.
		 * @param string                    $frequency       Report frequency.
		 * @param Date_Range                $date_range      Date range.
		 * @param Report|null               $report          Report instance.
		 * @param array<string, mixed>|null $rendered_blocks Optional pre-rendered blocks.
		 */
		private function build_classic_report( Mailer $mailer, array $content, string $frequency, Date_Range $date_range, ?Report $report = null, ?array $rendered_blocks = null ): void {
			if ( null === $report ) {
				$report = new Report( $mailer->report_id );
			}

			$blocks = $rendered_blocks ?? $this->render_report_blocks( $report, $content );

			$blocks = apply_filters(
				'burst_mail_reports_blocks',
				$blocks,
				$date_range->start,
				$date_range->end,
			);

			// Order blocks according to $content order so user placement is respected.
			$ordered_blocks = [];
			foreach ( $content as $item ) {
				$key = is_array( $item ) && isset( $item['id'] ) ? (string) $item['id'] : (string) $item;
				if ( isset( $blocks[ $key ] ) ) {
					$ordered_blocks[ $key ] = $blocks[ $key ];
				}
			}
			// Append any blocks added by filters that were not in $content.
			foreach ( $blocks as $key => $block ) {
				if ( ! isset( $ordered_blocks[ $key ] ) ) {
					$ordered_blocks[ $key ] = $block;
				}
			}
			$blocks = $ordered_blocks;

			// The summary introduces the report, so it leads the classic layout regardless of the order the blocks were picked in.
			if ( isset( $blocks[ Report_Content_Block::AI_SUMMARY ] ) ) {
				$blocks = [ Report_Content_Block::AI_SUMMARY => $blocks[ Report_Content_Block::AI_SUMMARY ] ] + $blocks;
			}

			$logo_attachment_id = (int) burst_get_option( 'logo_attachment_id', 0 );

			if ( $logo_attachment_id > 0 ) {
				$image_src = wp_get_attachment_image_src( $logo_attachment_id, 'medium' )
					?: wp_get_attachment_image_src( $logo_attachment_id, 'large' )
						?: wp_get_attachment_image_src( $logo_attachment_id, 'full' );

				if ( $image_src ) {
					$mailer->set_logo( $image_src[0] );
					// Dark mode fallback, overridden below when a dark mode logo is set.
					$mailer->set_logo_dark( $image_src[0] );
				}
			}

			$logo_attachment_id_dark = (int) burst_get_option( 'logo_attachment_id_dark', 0 );

			if ( $logo_attachment_id_dark > 0 ) {
				$image_src = wp_get_attachment_image_src( $logo_attachment_id_dark, 'medium' )
					?: wp_get_attachment_image_src( $logo_attachment_id_dark, 'large' )
						?: wp_get_attachment_image_src( $logo_attachment_id_dark, 'full' );

				if ( $image_src ) {
					$mailer->set_logo_dark( $image_src[0] );
				}
			}

			$mailer->set_blocks( $blocks );
		}

		/**
		 * Get the story url.
		 *
		 * @param int $report_id The report id.
		 * @return string The story url.
		 */
		public function get_story_url( int $report_id ): string {
			if ( ! isset( burst_loader()->admin, burst_loader()->admin->share ) ) {
				return '';
			}

			$share       = burst_loader()->admin->share;
			$share_links = $share->tokens->get_share_links( 'report', '', $report_id );

			if ( ! empty( $share_links ) ) {
				$share_links = array_values( $share_links );
				$share_link  = $share_links[0];
				$token       = $share_link['token'];
				// During cron, site_url() may return http:// while the site runs on https://.
				// Normalize to the same scheme as BURST_URL to ensure the link is correct.
				// Story links are now first-class path routes on /burst-dashboard/story/.
				$burst_scheme = wp_parse_url( BURST_URL, PHP_URL_SCHEME );
				return set_url_scheme( site_url( '/burst-dashboard/story/?burst_share_token=' . $token ), $burst_scheme );
			}
			return '';
		}

		/**
		 * Get a flattened array of string content ids for classic reports.
		 *
		 * @param array $content the content array.
		 * @return array<string> flattened content ids.
		 */
		private function flatten_content_array_for_classic( array $content ): array {
			$flattened = [];
			foreach ( $content as $key => $value ) {
				if ( is_array( $value ) && isset( $value['id'] ) ) {
					$flattened[] = (string) $value['id'];
				} elseif ( is_string( $value ) ) {
					$flattened[] = $value;
				}
			}
			return $flattened;
		}
	}
}
