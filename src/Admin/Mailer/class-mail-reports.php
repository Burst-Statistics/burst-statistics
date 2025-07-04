<?php
namespace Burst\Admin\Mailer;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class to send an e-mail
 */

if ( ! class_exists( 'mail_reports' ) ) {
	class Mail_Reports {
		use Helper;
		use Admin_Helper;

		/**
		 * Constructor
		 */
		public function init(): void {
			add_action( 'burst_every_hour', [ $this, 'maybe_send_report' ] );
			add_filter( 'burst_do_action', [ $this, 'send_test_report_action' ], 10, 3 );
		}

		/**
		 * User can send a report by clicking the button in the settings page.
		 *
		 * @return array<string, mixed> The modified output array.
		 */
		public function send_test_report_action( array $output, string $action, array $data ): array {
			// phpcs warning fixed.
			unset( $data );
			if ( ! $this->user_can_manage() ) {
				return $output;
			}

			if ( $action === 'send_email_report' ) {
				$this->send_test_report();
				$output = [
					'success' => true,
					'message' => __( 'E-mail report sent.', 'burst-statistics' ),
				];
			}

			return $output;
		}

		/**
		 * Send a test email.
		 */
		public function send_test_report(): void {
			if ( ! $this->user_can_manage() ) {
				return;
			}
			$mailinglist = $this->get_option( 'email_reports_mailinglist' );
			$monthly     = [];
			$weekly      = [];
			foreach ( $mailinglist as $mailing ) {
				if ( isset( $mailing['email'] ) ) {
					if ( $mailing['frequency'] === 'monthly' ) {
						$monthly[] = $mailing['email'];
					}
					if ( $mailing['frequency'] === 'weekly' ) {
						$weekly[] = $mailing['email'];
					}
				}
			}
			if ( count( $weekly ) > 0 ) {
				$this->send_report( $weekly, 'weekly' );
			}
			if ( count( $monthly ) > 0 ) {
				$this->send_report( $monthly, 'monthly' );
			}
		}

		/**
		 * Check if we need to send a report.
		 */
		public function maybe_send_report(): void {

			$last_report_sent = get_option( 'burst_last_report_sent' );
			if ( $last_report_sent && time() - $last_report_sent < DAY_IN_SECONDS ) {
				return;
			}

			$mailinglist  = $this->get_option( 'email_reports_mailinglist' );
			$mailinglist  = is_array( $mailinglist ) ? $mailinglist : [];
			$monthly_list = [];
			$weekly_list  = [];
			foreach ( $mailinglist as $mailing ) {
				if ( $mailing['frequency'] === 'monthly' ) {
					$monthly_list[] = $mailing['email'];
				} else {
					$weekly_list[] = $mailing['email'];

				}
			}

			// check if it is 08:00 and before 20:00, so you will receive the email in the morning.
			if ( gmdate( 'H' ) >= 8 && gmdate( 'H' ) < 20 ) {

				// check if it is the first day of the week.
				// 1 = Monday, 0 = Sunday.
				$first_day_of_week = (int) get_option( 'start_of_week' );
				if ( (int) gmdate( 'N' ) === $first_day_of_week ) {
					$this->send_report( $weekly_list, 'weekly' );
				}

				// check if it is the first day of the month.
				if ( (int) gmdate( 'd' ) === 1 ) {
					$this->send_report( $monthly_list, 'monthly' );
				}
			}
		}

		/**
		 * Send the report to the mailing list.
		 */
		private function send_report( array $mailinglist, string $frequency = 'weekly' ): void {
			$mailer     = new Mailer();
			$mailer->to = $mailinglist;

			if ( $frequency === 'monthly' ) {
				// translators: %s is the domain name (e.g., example.com).
				$mailer->subject = sprintf( _x( 'Your monthly insights for %s are here!', 'domain name', 'burst-statistics' ), $mailer->pretty_domain );
				// translators: %s is the domain name (e.g., example.com), HTML tags included for styling.
				$mailer->title = sprintf( _x( 'Your monthly insights for %s are here!', 'domain name', 'burst-statistics' ), '<br /><span style="font-size: 30px; font-weight: 700">' . $mailer->pretty_domain . '</span><br />' );
				// start date - end date.
				$mailer->message = '';

				// last month first and last day.
				$first_day_of_current_month = gmdate( 'Y-m-01' );
				$start                      = gmdate( 'Y-m-01', strtotime( '-1 month', strtotime( $first_day_of_current_month ) ) );
				$end                        = gmdate( 'Y-m-t', strtotime( $start ) );

				// second to last month first and last day.
				$compare_first_day_of_previous_month = strtotime( '-2 months', strtotime( $first_day_of_current_month ) );
				$compare_start                       = gmdate( 'Y-m-01', $compare_first_day_of_previous_month );
				$compare_end                         = gmdate( 'Y-m-t', $compare_first_day_of_previous_month );

				// convert to correct unix.
				$date_start = \Burst\burst_loader()->admin->statistics::convert_date_to_unix( $start . ' 00:00:00' );
				$date_end   = \Burst\burst_loader()->admin->statistics::convert_date_to_unix( $end . ' 23:59:59' );

				$compare_date_start = \Burst\burst_loader()->admin->statistics::convert_date_to_unix( $compare_start . ' 00:00:00' );
				$compare_date_end   = \Burst\burst_loader()->admin->statistics::convert_date_to_unix( $compare_end . ' 23:59:59' );

				$wp_date_format = get_option( 'date_format' );
				// translators: 1: start date, 2: end date.
				$mailer->message = sprintf( __( 'This report covers the period from %s to %s.', 'burst-statistics' ), date_i18n( $wp_date_format, $date_start ), date_i18n( $wp_date_format, $date_end ) );
			} else {
				// translators: %s is the domain name (e.g., example.com).
				$mailer->subject = sprintf( _x( 'Your weekly insights for %s are here!', 'domain name', 'burst-statistics' ), $mailer->pretty_domain );
				// translators: %s is the domain name (e.g., example.com), HTML tags included for styling.
				$mailer->title = sprintf( _x( 'Your weekly insights for %s are here!', 'domain name', 'burst-statistics' ), '<br /><span style="font-size: 30px; font-weight: 700">' . $mailer->pretty_domain . '</span><br />' );

				// 0 = Sunday, 1 = Monday, etc.
				$week_start = (int) get_option( 'start_of_week' );

				$weekdays = [ 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday' ];

				// last week first and last day based on wp start of the week.
				// Monday june 30th => previous monday is 24th.
				// Tuesday july 1st => previous monday should also be june 24th.
				// So we first get the week_start.
				$today           = strtotime( 'today' );
				$this_week_start = strtotime( 'last ' . $weekdays[ $week_start ], $today + DAY_IN_SECONDS );

				// Last week.
				$start = gmdate( 'Y-m-d', $this_week_start - WEEK_IN_SECONDS );
				$end   = gmdate( 'Y-m-d', $this_week_start - 1 );

				// Week before last.
				$compare_start = gmdate( 'Y-m-d', $this_week_start - 2 * WEEK_IN_SECONDS );
				$compare_end   = gmdate( 'Y-m-d', $this_week_start - WEEK_IN_SECONDS - 1 );

				// convert to correct unix.
				$date_start = \Burst\burst_loader()->admin->statistics::convert_date_to_unix( $start . ' 00:00:00' );
				$date_end   = \Burst\burst_loader()->admin->statistics::convert_date_to_unix( $end . ' 23:59:59' );

				$compare_date_start = \Burst\burst_loader()->admin->statistics::convert_date_to_unix( $compare_start . ' 00:00:00' );
				$compare_date_end   = \Burst\burst_loader()->admin->statistics::convert_date_to_unix( $compare_end . ' 23:59:59' );

				$wp_date_format  = get_option( 'date_format' );
				$mailer->message = date_i18n( $wp_date_format, $date_start ) . ' - ' . date_i18n( $wp_date_format, $date_end );
			}

			$compare = $this->get_compare_data( $date_start, $date_end, $compare_date_start, $compare_date_end );
			update_option( 'burst_last_report_sent', time(), false );

			$blocks   = [];
			$blocks[] = [
				'title'    => __( 'Compare', 'burst-statistics' ),
				'subtitle' => $frequency === 'weekly' ? __( 'vs. previous week', 'burst-statistics' ) : __( 'vs. previous month', 'burst-statistics' ),
				'table'    => self::format_array_as_table( $compare ),
				'url'      => $this->admin_url( 'burst#/statistics' ),
			];

			$custom_blocks = $this->get_blocks();
			foreach ( $custom_blocks as $index => $block ) {
					$results                 = $this->get_top_results( $date_start, $date_end, $block['type'] );
					$completed_block         = [
						'title' => $block['title'],
						'table' => self::format_array_as_table( $results ),
						'url'   => $this->admin_url( 'burst' . $block['url'] ),
					];
					$custom_blocks[ $index ] = $completed_block;
			}

			$blocks = array_merge( $blocks, $custom_blocks );
			$blocks = apply_filters( 'burst_mail_reports_blocks', $blocks, $date_start, $date_end );

			$mailer->blocks = $blocks;
			$attachment_id  = $this->get_option( 'logo_attachment_id' );
			if ( (int) $attachment_id > 0 ) {
				$mailer->logo = wp_get_attachment_url( $attachment_id );
			}
			$mailer->send_mail_queue();
		}

		/**
		 * Get blocks for the email report.
		 *
		 * @return array<int, array<string, mixed>> List of blocks for the email report.
		 */
		public function get_blocks(): array {
			$blocks = require BURST_PATH . 'src/Admin/Mailer/config/blocks.php';
			return apply_filters( 'burst_email_blocks', $blocks );
		}

		/**
		 * Get top results for the email report.
		 *
		 * @return array<int, array<int, string>> List of results
		 */
		public function get_top_results( int $start_date, int $end_date, string $type ): array {
			global $wpdb;
			$metrics     = [
				$type,
				'pageviews',
			];
			$sql         = \Burst\burst_loader()->admin->statistics->get_sql_table(
				$start_date,
				$end_date,
				$metrics,
				[],
				$type,
				'pageviews DESC',
				apply_filters( 'burst_mail_report_limit', 5 ),
			);
			$raw_results = $wpdb->get_results( $sql, ARRAY_A );

			switch ( $type ) {
				case 'page_url':
					$header = __( 'Page', 'burst-statistics' );
					break;
				case 'source':
					$header = __( 'Campaign', 'burst-statistics' );
					break;
				default:
					$header = __( 'Referrers', 'burst-statistics' );
					break;
			}

			$results = [
				'header' => [ $header, __( 'Pageviews', 'burst-statistics' ) ],
			];

			foreach ( $raw_results as $row ) {
				if ( $type !== 'referrer' || $row[ $type ] !== 'Direct' ) {
					$results[] = [ $row[ $type ], $row['pageviews'] ];
				}
			}

			return $results;
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
	}
}
