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
use Burst\Admin\Share\Share;
use Burst\Admin\Statistics\Query_Data;
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
			add_action( 'burst_create_report_from_onboarding', [ $this, 'create_report_from_onboarding' ] );
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
			$report = new Report( $report_id );
			$mailer = new Mailer();
			$mailer->set_to( $report->recipients )
				->set_report_id( $report->id )
				->set_queue_id( $queue_id )
				->set_batch_id( $batch_id );

			$this->build_report( $mailer, $report->frequency, $report->content, $report->format );

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
		 * Handle report actions
		 *
		 * @param array<string, mixed> $output The output array.
		 * @param string               $action The action to perform.
		 * @param array<string, mixed> $data   The data for the action.
		 * @return array<string, mixed> The modified output array.
		 */
		public function do_action_handler( array $output, string $action, array $data ): array {
			return match ( $action ) {
				'report-create'           => $this->create_report( $data ),
				'report-delete'           => $this->delete_report( $data ),
				'report-update'           => $this->update_report( $data ),
				'report-send-test-report' => $this->send_test_report_action( $data ),
				'report-send-report-now'  => $this->send_report_now_action( $data ),
				'report-preview'          => $this->get_report_preview( $data ),
				'report-data'             => $this->get_report_data( $data ),
				default                   => $output,
			};
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
			return $this->send_report_instance( $report );
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
				'enabled'         => 'enabled',
				'scheduled'       => 'scheduled',
				'reportDateRange' => 'date_range',
			];

			foreach ( $map as $request_key => $property ) {
				if ( array_key_exists( $request_key, $data ) ) {
					$report->{$property} = $data[ $request_key ];

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

			if ( ! $report->save() ) {
				return [
					'success' => false,
					'message' => 'Failed to update report.',
				];
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
					->set_enabled( $data['enabled'] )
					->set_scheduled( $data['scheduled'] );

			if ( ! $report->save() ) {
				return [
					'success' => false,
					'message' => 'Failed to create report.',
				];
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
		public function get_report_data( array $data ): array {
			$token       = $data['token'];
			$share       = new Share();
			$report      = null;
			$share_links = $share::get_share_links( $token );
			if ( ! empty( $share_links ) ) {
				// get first share link.
				$share_links = array_values( $share_links );
				$share_link  = $share_links[0];
				$report_id   = $share_link['report_id'];
				$report      = new Report( $report_id );
			}

			if ( ob_get_length() ) {
				ob_clean();
			}

			return [
				'request_success' => true,
				'report'          => $report?->to_array(),
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
				`date_range` varchar(255) NOT NULL,
				`format` varchar(32) NOT NULL,
				`frequency` varchar(16) NOT NULL,
				`fixed_end_date` varchar(16) NOT NULL,
				`day_of_week` varchar(16) DEFAULT NULL,
				`week_of_month` int DEFAULT NULL,
				`send_time` varchar(16) NOT NULL,
				`last_edit` int unsigned NOT NULL,
				`enabled` tinyint(1) NOT NULL DEFAULT 1,
				`scheduled` tinyint(1) NOT NULL DEFAULT 0,
				`content` longtext NOT NULL,
				`recipients` longtext NOT NULL,
				PRIMARY KEY (`ID`)
			) {$charset_collate};";

			require_once ABSPATH . 'wp-admin/includes/upgrade.php';
			dbDelta( $sql );

			if ( ! empty( $wpdb->last_error ) ) {
				self::error_log( 'Error creating burst_reports table: ' . $wpdb->last_error );
			}

			// Add indexes.
			$indexes = [
				'burst_reports' => [
					[ 'ID' ],
					[ 'enabled' ],
					[ 'frequency' ],
					[ 'day_of_week' ],
				],
			];

			foreach ( $indexes as $table => $table_indexes ) {
				$table_name = $wpdb->prefix . $table;
				foreach ( $table_indexes as $index ) {
					$this->add_index( $table_name, $index );
				}
			}
		}

		/**
		 * User can send a report by clicking the button in the settings page.
		 *
		 * @return array<string, mixed> The modified output array.
		 */
		public function send_test_report_action( ?array $data ): array {
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

			// For test reports, set the send timestamp to now.
			$report->set_next_send_timestamp( time() );
			return $this->send_report_instance( $report, true );
		}

		/**
		 * Get Queue ID from next send timestamp.
		 *
		 * @param int  $next_send_timestamp The next send timestamp.
		 * @param bool $is_test             Whether it's a test report.
		 * @return string The generated Queue ID.
		 */
		public function get_queue_id_from_timestamp( int $next_send_timestamp, bool $is_test = false ): string {
			$queue_id = gmdate( 'Y-m-d', $next_send_timestamp );

			if ( $is_test ) {
				$queue_id = sprintf(
					'test-%s-%s',
					$queue_id,
					time()
				);
			}

			return $queue_id;
		}

		/**
		 * Send a report instance.
		 *
		 * @param Report $report The report object.
		 * @return array The result of the send operation.
		 */
		private function send_report_instance( Report $report, bool $is_test = false ): array {
			if ( empty( $report->recipients ) ) {
				return [
					'success' => false,
					'message' => __( 'No recipients specified for the report.', 'burst-statistics' ),
				];
			}

			$report_id = $report->id;
			$queue_id  = $this->get_queue_id_from_timestamp( $report->next_send_timestamp, $is_test );
			$batch_id  = 1;

			// Do not schedule test reports on cron, but send immediately.
			if ( $is_test ) {
				$this->handle_email_batch( $report_id, $queue_id, $batch_id );
				return [
					'success' => true,
					'message' => __( 'Report sent.', 'burst-statistics' ),
				];
			} else {
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

					wp_schedule_single_event(
						time() + 5 * MINUTE_IN_SECONDS,
						'burst_send_email_batch',
						[ $report_id, $queue_id, $batch_id ]
					);
				}
				return [
					'success' => true,
					'message' => __( 'Sending of report scheduled.', 'burst-statistics' ),
				];
			}
		}

		/**
		 * Check if we need to send a report.
		 */
		public function maybe_send_report(): void {
			global $wpdb;

			$ids = $wpdb->get_col(
				"SELECT ID FROM {$wpdb->prefix}burst_reports WHERE enabled = 1 AND scheduled = 1"
			);

			foreach ( $ids as $id ) {
				$report = new Report( (int) $id );

				if ( empty( $report->next_send_timestamp ) ) {
					continue;
				}

				$now = time();

				if ( $now < $report->next_send_timestamp || $now > $report->next_send_timestamp + DAY_IN_SECONDS ) {
					continue;
				}

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
		public function get_top_results( int $start_date, int $end_date, Query_Data $qd ): array {
			$results        = [];
			$qd->limit      = apply_filters( 'burst_mail_report_limit', 5 );
			$qd->date_start = $start_date;
			$qd->date_end   = $end_date;
			$raw_results    = \Burst\burst_loader()->admin->statistics->get_results( $qd, ARRAY_A );

			$raw_results = apply_filters( 'burst_mail_report_results', $raw_results, $qd, $start_date, $end_date );

			// filter out rows where one of the columns === 'Direct.
			$raw_results = array_filter(
				$raw_results,
				function ( $row ) {
					return ! in_array( 'Direct', $row, true );
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
		 * @return array<int, array<int, string>> List of compare rows grouped by type.
		 */
		private function get_compare_data( int $date_start, int $date_end, int $compare_date_start, int $compare_date_end ): array {
			$args = [
				'date_start'         => $date_start,
				'date_end'           => $date_end,
				'compare_date_start' => $compare_date_start,
				'compare_date_end'   => $compare_date_end,
			];

			$compare_data = \Burst\burst_loader()->admin->statistics->get_compare_data( $args );
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
		 * @return array{0: string, 1: string} An array with the title and formatted HTML string.
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
			$uplift   = \Burst\burst_loader()->admin->statistics->calculate_uplift( $current, $previous );

			$color = $uplift >= 0 ? '#2e8a37' : '#d7263d';
			if ( $type === 'bounced_sessions' ) {
				$color = $uplift > 0 ? '#d7263d' : '#2e8a37';
				// add % after bounce rate.
				$current = $current . '%';
			}
			$uplift = $uplift > 0 ? '+' . $uplift : $uplift;
			return [
				$data[ $type ]['title'],
				'<span style="font-size: 13px; color: ' . esc_attr( $color ) . '">' . esc_html( $uplift ) . '%</span>&nbsp;<span>' . esc_html( $current ) . '</span>',
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
						$html .= '<th style="text-align: left; font-size: 14px; font-weight: 400">' . $column . '</th>';
					} else {
						$html .= '<th style="text-align: right; font-size: 14px; font-weight: 400">' . $column . '</th>';
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
							$column = __( 'Direct', 'burst-statistics' );
						}
						if ( ! is_numeric( $column ) ) {
							if ( strlen( $column ) > 35 ) {
								$column = substr( $column, 0, 35 ) . '...';
							}
						}
						$html .= '<td style="width: fit-content; text-align: left;">' . $column . '</td>';
					} else {
						$html .= '<td style="width: fit-content; text-align: right;">' . $column . '</td>';
					}
					$first_row = false;
				}
				$html .= '</tr>';

			}

			return $html;
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
		 * Build the report data into the Mailer instance.
		 */
		private function build_report( Mailer $mailer, string $frequency, array $content, string $format ): void {
			$date_range = new Date_Range( $frequency );
			$report_id  = $mailer->report_id ?? null;
			$report     = new Report( $report_id );
			$scheduled  = $report->scheduled;
			// not scheduled reports should have a fixed end date already.
			if ( $scheduled ) {
				$report->set_fixed_end_date_to_yesterday();
			}

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

			if ( $format === 'classic' ) {
				$this->build_classic_report( $mailer, $content, $frequency, $date_range );
			} else {
				$mailer->set_read_more_button_url( $this->get_story_url( $mailer->report_id ) )
				->set_read_more_button_text( __( 'View story', 'burst-statistics' ) )
				->set_read_more_header( '' )
					// translators: %s is the website's domain name (e.g., example.com).
					->set_read_more_teaser( sprintf( __( 'A new report is available for %s.', 'burst-statistics' ), $mailer->pretty_domain ) );
			}
		}

		/**
		 * Build classic report content.
		 */
		private function build_classic_report( Mailer $mailer, array $content, string $frequency, Date_Range $date_range ): void {
			$blocks = [];

			$content = $this->flatten_content_array_for_classic( $content );
			if ( in_array( Report_Content_Block::COMPARE, $content, true ) ) {

				$blocks[ Report_Content_Block::COMPARE ] = [
					'title'    => __( 'Compare', 'burst-statistics' ),
					'subtitle' => $frequency === Report_Frequency::WEEKLY
						? __( 'vs. previous week', 'burst-statistics' )
						: __( 'vs. previous month', 'burst-statistics' ),
					'table'    => self::format_array_as_table(
						$this->get_compare_data(
							$date_range->start,
							$date_range->end,
							$date_range->compare_start,
							$date_range->compare_end
						)
					),
					'url'      => $this->admin_url( 'burst#/statistics' ),
				];
			}

			foreach ( $this->get_blocks() as $key => $block ) {
				if ( ! in_array( $key, $content, true ) ) {
					continue;
				}

				if ( isset( $block['query_args'] ) ) {
					$query_data_args = $block['query_args'];
				} else {
					self::error_log( 'Query args should be passed into query_args key for block: ' . $key );
					$query_data_args = $block;
				}

				$qd      = new Query_Data( $query_data_args );
				$results = $this->get_top_results( $date_range->start, $date_range->end, $qd );
				// prepend header row to results.
				array_unshift( $results, $block['header'] );

				$blocks[ $key ] = [
					'title' => $block['title'],
					'table' => self::format_array_as_table( $results ),
					'url'   => $this->admin_url( 'burst' . $block['url'] ),
				];
			}

			$blocks = apply_filters(
				'burst_mail_reports_blocks',
				$blocks,
				$date_range->start,
				$date_range->end,
			);

			foreach ( $blocks as $key => $block ) {
				if ( ! in_array( $key, $content, true ) ) {
					unset( $blocks[ $key ] );
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
			$share       = new Share();
			$share_links = $share::get_share_links( '', $report_id );
			if ( ! empty( $share_links ) ) {
				$share_links = array_values( $share_links );
				$share_link  = $share_links[0];
				$token       = $share_link['token'];
				return site_url( '/burst-dashboard/?burst_share_token=' . $token . '#/story' );
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
				$flattened[] = $value['id'];
			}
			return $flattened;
		}
	}
}
