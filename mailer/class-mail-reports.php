<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class to send an e-mail
 */

if ( ! class_exists( 'burst_mail_reports' ) ) {
	class burst_mail_reports {

		public function __construct() {
			add_action( 'burst_every_hour', [ $this, 'maybe_send_report' ] );
			add_action( 'admin_init', [ $this, 'test_report' ] );
		}

		public function test_report() {
			if ( ! isset( $_GET['burst_test_report'] ) ) {
				return;
			}
			$frequency   = $_GET['burst_test_report'] === 'monthly' ? 'monthly' : 'weekly';
			$mailinglist = burst_get_option( 'email_reports_mailinglist' );
			$emails      = array();
			foreach ( $mailinglist as $mailing ) {
				if ( isset( $mailing['email'] ) ) {
					$emails[] = $mailing['email'];
				}
			}
			$this->send_report( $emails, $frequency );
		}

		/**
		 * @return void
		 */
		public function maybe_send_report(): void {

			$last_report_sent = get_option( 'burst_last_report_sent' );
			if ( $last_report_sent && time() - $last_report_sent < DAY_IN_SECONDS ) {
				return;
			}

			$mailinglist  = burst_get_option( 'email_reports_mailinglist' );
			$mailinglist  = is_array( $mailinglist ) ? $mailinglist : array();
			$monthly_list = array();
			$weekly_list  = array();
			foreach ( $mailinglist as $mailing ) {
				if ( $mailing['frequency'] === 'monthly' ) {
					$monthly_list[] = $mailing['email'];
				} else {
					$weekly_list[] = $mailing['email'];

				}
			}

			// check if it is 08:00 and before 20:00, so you will receive the email in the morning
			if ( date( 'H' ) >= 8 && date( 'H' ) < 20 ) {

				// check if it is the first day of the week
				$first_day_of_week = (int) get_option( 'start_of_week' ); // 1 = Monday, 0 = Sunday
				if ( (int) date( 'N' ) === $first_day_of_week ) {
					$this->send_report( $weekly_list, 'weekly' );
				}

				// check if it is the first day of the month
				if ( (int) date( 'd' ) === 1 ) {
					$this->send_report( $monthly_list, 'monthly' );
				}
			}
		}

		/**
		 * @param array  $mailinglist
		 * @param string $frequency
		 *
		 * @return void
		 */
		private function send_report( $mailinglist, $frequency = 'weekly' ) {
			global $wpdb;
			require_once burst_path . 'mailer/class-mailer.php';
			$mailer     = new burst_mailer();
			$mailer->to = $mailinglist;

			if ( $frequency === 'monthly' ) {
				$mailer->subject = sprintf( _x( 'Your monthly insights for %s are here!', 'domain name', 'burst-statistics' ), $mailer->pretty_domain );
				$mailer->title   = sprintf( _x( 'Your monthly insights for %s are here!', 'domain name', 'burst-statistics' ), '<br /><span style="font-size: 30px; font-weight: 700">' . $mailer->pretty_domain . '</span><br />' );
				$mailer->message = ''; // start date - end date

				// last month first and last day
				$start = date( 'Y-m-01', strtotime( 'last month' ) );
				$end   = date( 'Y-m-t', strtotime( 'last month' ) );

				// second to last month first and last day
				$compare_start = date( 'Y-m-01', strtotime( '2 months ago' ) );
				$compare_end   = date( 'Y-m-t', strtotime( '2 months ago' ) );

				// convert to correct unix
				$date_start = BURST()->statistics->convert_date_to_unix( $start . ' 00:00:00' );
				$date_end   = BURST()->statistics->convert_date_to_unix( $end . ' 23:59:59' );

				$compare_date_start = BURST()->statistics->convert_date_to_unix( $compare_start . ' 00:00:00' );
				$compare_date_end   = BURST()->statistics->convert_date_to_unix( $compare_end . ' 23:59:59' );

				$wp_date_format  = get_option( 'date_format' );
				$mailer->message = sprintf( __( 'This report covers the period from %s to %s.', 'burst-statistics' ), date_i18n( $wp_date_format, $date_start ), date_i18n( $wp_date_format, $date_end ) );
			} else {
				$mailer->subject = sprintf( _x( 'Your weekly insights for %s are here!', 'domain name', 'burst-statistics' ), $mailer->pretty_domain );
				$mailer->title   = sprintf( _x( 'Your weekly insights for %s are here!', 'domain name', 'burst-statistics' ), '<br /><span style="font-size: 30px; font-weight: 700">' . $mailer->pretty_domain . '</span><br />' );

				$week_start = (int) get_option( 'start_of_week' ); // 0 = Sunday, 1 = Monday, etc.

				$weekdays = array( 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday' );

				// last week first and last day based on wp start of the week
				$start = date( 'Y-m-d', strtotime( 'last ' . $weekdays[ $week_start ] ) );
				$end   = date( 'Y-m-d', strtotime( 'last ' . $weekdays[ $week_start ] . ' +6 days' ) );
				// if end is in the future we need to adjust both start and end to substract 7 days
				if ( strtotime( $end ) > time() ) {
					$start = date( 'Y-m-d', strtotime( 'last ' . $weekdays[ $week_start ] . ' -7 days' ) );
					$end   = date( 'Y-m-d', strtotime( 'last ' . $weekdays[ $week_start ] . ' -1 days' ) );
				}

				// second to last week first and last day based on wp start of the week
				$compare_start = date( 'Y-m-d', strtotime( 'last ' . $weekdays[ $week_start ] . ' -14 days' ) );
				$compare_end   = date( 'Y-m-d', strtotime( 'last ' . $weekdays[ $week_start ] . ' -8 days' ) );

				// convert to correct unix
				$date_start = BURST()->statistics->convert_date_to_unix( $start . ' 00:00:00' );
				$date_end   = BURST()->statistics->convert_date_to_unix( $end . ' 23:59:59' );

				$compare_date_start = BURST()->statistics->convert_date_to_unix( $compare_start . ' 00:00:00' );
				$compare_date_end   = BURST()->statistics->convert_date_to_unix( $compare_end . ' 23:59:59' );

				$wp_date_format  = get_option( 'date_format' );
				$mailer->message = date_i18n( $wp_date_format, $date_start ) . ' - ' . date_i18n( $wp_date_format, $date_end );
			}

			$args = array(
				'date_start'         => $date_start,
				'date_end'           => $date_end,
				'compare_date_start' => $compare_date_start,
				'compare_date_end'   => $compare_date_end,
			);

			$compare_data = BURST()->statistics->get_compare_data( $args );
			// For current bounced sessions percentage calculation
			if ( ( $compare_data['current']['sessions'] + $compare_data['current']['bounced_sessions'] ) > 0 ) {
				$compare_data['current']['bounced_sessions'] = round(
					$compare_data['current']['bounced_sessions'] /
					( $compare_data['current']['sessions'] + $compare_data['current']['bounced_sessions'] ) * 100,
					1
				);
			} else {
				// Handle the case where the division would be by zero, for example, set to 0 or another default value
				$compare_data['current']['bounced_sessions'] = 0; // or another appropriate value or handling
			}

			// For previous bounced sessions percentage calculation
			if ( ( $compare_data['previous']['sessions'] + $compare_data['previous']['bounced_sessions'] ) > 0 ) {
				$compare_data['previous']['bounced_sessions'] = round(
					$compare_data['previous']['bounced_sessions'] /
					( $compare_data['previous']['sessions'] + $compare_data['previous']['bounced_sessions'] ) * 100,
					1
				);
			} else {
				// Similarly, handle the case where the division would be by zero
				$compare_data['previous']['bounced_sessions'] = 0; // or another appropriate value or handling
			}

			$types   = array( 'pageviews', 'sessions', 'visitors', 'bounced_sessions' );
			$compare = array();
			foreach ( $types as $type ) {
				$compare[] = $this->get_compare_row( $type, $compare_data );
			}

			$sql     = BURST()->statistics->get_sql_table(
				$args['date_start'],
				$args['date_end'],
				array(
					'page_url',
					'pageviews',
				),
				[],
				'page_url',
				'pageviews DESC'
			);
			$results = $wpdb->get_results( $sql, ARRAY_A );

			// max five urls
			$results = array_slice( $results, 0, 5 );

			$urls = array(
				'header' => array( __( 'Page', 'burst-statistics' ), __( 'Pageviews', 'burst-statistics' ) ),
			);

			foreach ( $results as $index => $row ) {
				$urls[] = array( $row['page_url'], $row['pageviews'] );
			}
			$refferers_sql  = BURST()->statistics->get_sql_table(
				$args['date_start'],
				$args['date_end'],
				array(
					'referrer',
					'pageviews',
				),
				[],
				'referrer',
				'pageviews DESC'
			);
			$refferers_data = $wpdb->get_results( $refferers_sql, ARRAY_A );

			// max five referrers
			$refferers_data = array_slice( $refferers_data, 0, 5 );

			$referrers = array(
				'header' => array( __( 'Referrers', 'burst-statistics' ), __( 'Pageviews', 'burst-statistics' ) ),
			);

			foreach ( $refferers_data as $index => $row ) {
				if ( $row['referrer'] !== 'Direct' ) {
					$referrers[] = array( $row['referrer'], $row['pageviews'] );
				}
			}

			update_option( 'burst_last_report_sent', time(), false );
			$blocks = array(
				[
					'title'    => __( 'Compare', 'burst-statistics' ),
					'subtitle' => $frequency === 'weekly' ? __( 'vs. previous week', 'burst-statistics' ) : __( 'vs. previous month', 'burst-statistics' ),
					'table'    => $this->format_array_as_table( $compare ),
					'url'      => burst_admin_url( 'burst#statistics' ),
				],
				[
					'title' => __( "Most visited pages", "burst-statistics" ),
					'table' => $this->format_array_as_table( $urls ),
					'url'   => burst_admin_url( 'burst#statistics' ),
				],
				[
					'title' => __( "Top referrers", "burst-statistics" ),
					'table' => $this->format_array_as_table( $referrers ),
					'url'   => burst_admin_url( 'burst#statistics' ),
				],
			);
			$blocks = apply_filters( 'burst_mail_reports_blocks', $blocks, $args['date_start'], $args['date_end'] );

			$mailer->blocks = $blocks;
			$attachment_id  = burst_get_option( 'logo_attachment_id' );
			if ( (int) $attachment_id > 0 ) {
				$mailer->logo = wp_get_attachment_url( $attachment_id );
			}
			$mailer->send_mail_queue();
		}

		private function get_compare_row( $type, $compare_data ) {
			$data = array(
				'pageviews'        => array(
					'title' => __( 'Pageviews', 'burst-statistics' ),
				),
				'sessions'         => array(
					'title' => __( 'Sessions', 'burst-statistics' ),
				),
				'visitors'         => array(
					'title' => __( 'Visitors', 'burst-statistics' ),
				),
				'bounced_sessions' => array(
					'title' => __( 'Bounce rate', 'burst-statistics' ),
				),
			);

			$current  = $compare_data['current'][ $type ];
			$previous = $compare_data['previous'][ $type ];
			$uplift   = BURST()->statistics->calculate_uplift( $current, $previous );

			$color = $uplift >= 0 ? '#2e8a37' : '#d7263d';
			if ( $type === 'bounced_sessions' ) {
				$color = $uplift > 0 ? '#d7263d' : '#2e8a37';
				// add % after bounce rate
				$current = $current . '%';
			}
			$uplift = $uplift > 0 ? '+' . $uplift : $uplift;
			return array(
				$data[ $type ]['title'],
				'<span style="font-size: 13px; color: ' . esc_attr( $color ) . '">' . esc_html( $uplift ) . '%</span>&nbsp;' . '<span>' . esc_html( $current ) . '</span>',
			);
		}

		/**
		 * @param array $array
		 * @param array $header
		 *
		 * @return string
		 */
		public function format_array_as_table( array $array ): string {
			$html = '';
			if ( isset( $array['header'] ) ) {
				$row       = $array['header'];
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
				unset( $array['header'] );
			}
			foreach ( $array as $row ) {
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
