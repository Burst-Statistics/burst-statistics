<?php
/**
 * Tracking health diagnostic email.
 *
 * @package Burst\Admin\Diagnostics
 */

namespace Burst\Admin\Diagnostics;

use Burst\Admin\Mailer\Mailer;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || exit;

/**
 * Class Tracking_Health_Email
 *
 * Sends one diagnostic email when the tracking health detector reports a
 * high-confidence drop: detector status, collector findings, captured browser
 * errors and a false-alarm note. Throttled to at most one email per week.
 */
class Tracking_Health_Email {
	use Helper;
	use Admin_Helper;

	/**
	 * Minimum detector confidence before an email is sent. Filterable via
	 * `burst_tracking_health_email_confidence`.
	 *
	 * @var float
	 */
	private const DEFAULT_MIN_CONFIDENCE = 0.5;

	/**
	 * Option holding the timestamp of the last sent diagnostic email.
	 *
	 * @var string
	 */
	private const LAST_EMAIL_OPTION = 'burst_tracking_health_last_email';

	/**
	 * Register hooks.
	 */
	public function init(): void {
		add_action( 'burst_tracking_diagnostics_collected', [ $this, 'maybe_send' ], 10, 2 );
	}

	/**
	 * Send the diagnostic email when allowed: setting enabled, detector
	 * confidence high enough and no diagnostic email sent in the past week.
	 *
	 * @param array $diagnostics   Collector results keyed by collector id.
	 * @param array $health_result The result fired by Tracking_Health.
	 */
	public function maybe_send( array $diagnostics, array $health_result ): void {
		if ( ! $this->get_option_bool( 'enable_diagnostic_email', true ) ) {
			return;
		}

		$min_confidence = (float) apply_filters( 'burst_tracking_health_email_confidence', self::DEFAULT_MIN_CONFIDENCE );
		if ( (float) ( $health_result['confidence'] ?? 0 ) < $min_confidence ) {
			return;
		}

		$last_sent = (int) get_option( self::LAST_EMAIL_OPTION, 0 );
		if ( $last_sent > 0 && ( time() - $last_sent ) < WEEK_IN_SECONDS ) {
			return;
		}

		if ( $this->send( $diagnostics, $health_result ) ) {
			update_option( self::LAST_EMAIL_OPTION, time(), false );
		}
	}

	/**
	 * Compose and send the diagnostic email.
	 *
	 * @param array $diagnostics   Collector results keyed by collector id.
	 * @param array $health_result The result fired by Tracking_Health.
	 * @return bool True when at least one recipient received the email.
	 */
	private function send( array $diagnostics, array $health_result ): bool {
		/**
		 * Filter the diagnostic email recipients. Defaults to the site admin
		 * email: this is a technical alert, not a statistics report.
		 *
		 * @param string[] $recipients Recipient email addresses.
		 */
		$recipients = apply_filters( 'burst_tracking_health_email_recipients', [ get_option( 'admin_email' ) ] );
		$recipients = array_filter( (array) $recipients, 'is_email' );
		if ( empty( $recipients ) ) {
			return false;
		}

		$mailer = new Mailer();
		// translators: %s is the website's domain name (e.g., example.com).
		$mailer->set_subject( sprintf( __( 'Possible tracking issue on %s', 'burst-statistics' ), $mailer->pretty_domain ) )
			// translators: %s is the website's domain name (e.g., example.com), used in HTML context.
			->set_title( sprintf( _x( 'Possible tracking issue on %s', 'domain name', 'burst-statistics' ), '<br /><span style="font-size: 30px; font-weight: 700;">' . $mailer->pretty_domain . '</span><br />' ) )
			->set_message( $this->get_intro_message( $mailer->pretty_domain ) )
			->set_blocks(
				[
					$this->get_status_block( $health_result ),
					$this->get_diagnostics_block( $diagnostics ),
					$this->get_browser_errors_block(),
				]
			)
			->set_read_more_button_url( $this->admin_url( 'burst#/' ) )
			->set_read_more_button_text( __( 'Open Burst dashboard', 'burst-statistics' ) )
			->set_read_more_header( __( 'Check your dashboard', 'burst-statistics' ) )
			->set_read_more_teaser( __( 'The dashboard shows live tracking status and any browser errors collected after this email was sent.', 'burst-statistics' ) )
			// The dashboard link must survive a custom email footer, which
			// otherwise suppresses the read more section.
			->set_force_read_more( true );

		$sent = false;
		foreach ( $recipients as $email ) {
			if ( $mailer->send_mail( $email ) ) {
				$sent = true;
			}
		}

		return $sent;
	}

	/**
	 * The introduction: what was detected and when it may be a false alarm.
	 *
	 * @param string $domain Pretty domain name.
	 */
	private function get_intro_message( string $domain ): string {
		// translators: %s is the website's domain name (e.g., example.com).
		return sprintf( __( 'Burst detected that visitor tracking on %s may have stopped working: yesterday recorded far fewer hits than normal. The findings below may help you identify the cause.', 'burst-statistics' ), $domain )
			. '<br /><br />'
			. __( 'This could be a false alarm if you recently installed a consent or cookie banner, excluded more user roles or IP addresses from tracking, put the site in maintenance mode, or your site simply had an unusually quiet day.', 'burst-statistics' );
	}

	/**
	 * Block summarizing the detector result.
	 *
	 * @param array $health_result The result fired by Tracking_Health.
	 * @return array{title: string, subtitle: string, table: string}
	 */
	private function get_status_block( array $health_result ): array {
		$status_labels = [
			'down'    => __( 'No hits recorded', 'burst-statistics' ),
			'suspect' => __( 'Hits far below normal', 'burst-statistics' ),
		];
		$status        = (string) ( $health_result['status'] ?? '' );

		$last_hit       = $this->get_last_hit_time();
		$last_hit_label = $last_hit > 0
			? $this->format_time( $last_hit )
			: __( 'No hits found', 'burst-statistics' );

		$rows  = $this->get_row( __( 'Status', 'burst-statistics' ), $status_labels[ $status ] ?? $status );
		$rows .= $this->get_row( __( 'Hits yesterday', 'burst-statistics' ), (string) (int) ( $health_result['hits'] ?? 0 ) );
		$rows .= $this->get_row( __( 'Normal for this weekday', 'burst-statistics' ), (string) round( (float) ( $health_result['baseline'] ?? 0 ) ) );
		$rows .= $this->get_row( __( 'Last recorded hit', 'burst-statistics' ), $last_hit_label );
		if ( ! empty( $health_result['incident_since'] ) ) {
			$rows .= $this->get_row( __( 'Issue detected since', 'burst-statistics' ), (string) $health_result['incident_since'] );
		}

		return [
			'title'    => __( 'Tracking status', 'burst-statistics' ),
			'subtitle' => __( 'What the daily check found', 'burst-statistics' ),
			'table'    => $rows,
		];
	}

	/**
	 * Block listing each diagnostic collector finding.
	 *
	 * @param array $diagnostics Collector results keyed by collector id.
	 * @return array{title: string, subtitle: string, table: string}
	 */
	private function get_diagnostics_block( array $diagnostics ): array {
		$markers = [
			'ok'       => '✓',
			'warning'  => '!',
			'critical' => '✕',
			'skipped'  => '—',
		];

		$rows = '';
		foreach ( $diagnostics as $result ) {
			if ( ! is_array( $result ) || empty( $result['label'] ) ) {
				continue;
			}
			$marker = $markers[ $result['status'] ?? '' ] ?? '—';
			$rows  .= '<tr style="line-height: 24px"><td style="text-align: left;">' . esc_html( $marker . ' ' . $result['label'] ) . '</td></tr>';
			$rows  .= '<tr><td style="text-align: left; font-weight: 400; font-size: 14px; color: #696969; padding-bottom: 8px;">' . esc_html( (string) ( $result['summary'] ?? '' ) ) . '</td></tr>';
		}

		if ( '' === $rows ) {
			$rows = '<tr><td style="text-align: left; font-weight: 400;">' . esc_html__( 'No diagnostic results available.', 'burst-statistics' ) . '</td></tr>';
		}

		return [
			'title'    => __( 'Diagnostics', 'burst-statistics' ),
			'subtitle' => __( 'Checks that may explain the drop, including recent changes on your site', 'burst-statistics' ),
			'table'    => $rows,
		];
	}

	/**
	 * Block listing browser errors captured by the auto debug window.
	 *
	 * The debug window is armed at the same moment this email is composed, so
	 * on the first alert this block usually announces that collection started.
	 *
	 * @return array{title: string, subtitle: string, table: string}
	 */
	private function get_browser_errors_block(): array {
		$errors = \Burst\burst_loader()->frontend->get_debug_window_errors();

		if ( empty( $errors ) ) {
			return [
				'title'    => __( 'Browser errors', 'burst-statistics' ),
				'subtitle' => __( 'Error collection has just been enabled', 'burst-statistics' ),
				'table'    => '<tr><td style="text-align: left; font-weight: 400;">' . esc_html__( 'No browser errors captured yet. Burst now collects tracking errors from visitors for the next 24 hours; check the dashboard later for results.', 'burst-statistics' ) . '</td></tr>',
			];
		}

		$rows = '';
		foreach ( $errors as $error ) {
			if ( ! is_array( $error ) ) {
				continue;
			}
			$rows .= '<tr style="line-height: 24px"><td style="text-align: left;">' . esc_html( $this->format_time( (int) ( $error['time'] ?? 0 ) ) . ' — ' . (string) ( $error['error'] ?? '' ) ) . '</td></tr>';
			$rows .= '<tr><td style="text-align: left; font-weight: 400; font-size: 14px; color: #696969; padding-bottom: 8px;">' . esc_html( (string) ( $error['url'] ?? '' ) ) . '</td></tr>';
		}

		return [
			'title'    => __( 'Browser errors', 'burst-statistics' ),
			'subtitle' => __( 'Tracking errors reported by visitor browsers', 'burst-statistics' ),
			'table'    => $rows,
		];
	}

	/**
	 * A label/value table row for the email blocks.
	 */
	private function get_row( string $label, string $value ): string {
		return '<tr style="line-height: 28px"><td style="text-align: left; font-weight: 400;">' . esc_html( $label ) . '</td><td style="text-align: right;">' . esc_html( $value ) . '</td></tr>';
	}

	/**
	 * Timestamp of the most recently recorded hit, 0 when none exist.
	 */
	private function get_last_hit_time(): int {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- single aggregate on a plugin table, no user input.
		return (int) $wpdb->get_var( "SELECT MAX(time) FROM {$wpdb->prefix}burst_statistics" );
	}

	/**
	 * Format a timestamp in the site date/time format and timezone.
	 */
	private function format_time( int $timestamp ): string {
		return (string) wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $timestamp );
	}
}
