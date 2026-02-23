<?php
namespace Burst\Admin\Reports;

use Burst\Admin\Reports\DomainTypes\Report_Content_Block;
use Burst\Admin\Reports\DomainTypes\Report_Date_Range;
use Burst\Admin\Reports\DomainTypes\Report_Day_Of_Week;
use Burst\Admin\Reports\DomainTypes\Report_Format;
use Burst\Admin\Reports\DomainTypes\Report_Frequency;
use Burst\Admin\Reports\DomainTypes\Report_Week_Of_Month;
use Burst\Admin\Statistics\Query_Data;
use Burst\Traits\Helper;
use Burst\Traits\Sanitize;

defined( 'ABSPATH' ) || exit;

class Report {
	use Helper;
	use Sanitize;

	/**
	 * Max length of report name column.
	 */
	protected const NAME_MAX_LENGTH = 255;

	/**
	 * Report ID.
	 */
	public ?int $id = null;

	/**
	 * Report name.
	 */
	public string $name = '';

	/**
	 * Report format.
	 */
	public string $format = '';

	/**
	 * Report frequency.
	 */
	public string $frequency = '';

	/**
	 * Day of month for monthly reports.
	 */
	public ?int $week_of_month = null;

	/**
	 * Day of week for weekly reports.
	 */
	public ?string $day_of_week = null;

	/**
	 * Time to send the report.
	 */
	public string $send_time = '';

	/**
	 * Fixed date to calculate date range back from.
	 */
	public string $fixed_end_date = '';

	/**
	 * Timestamp of last edit.
	 */
	public int $last_edit = 0;

	/**
	 * Whether the report is enabled.
	 */
	public bool $enabled = true;

	/**
	 * Whether the report is scheduled for automatic sending.
	 */
	public bool $scheduled = false;

	/**
	 * Report content settings.
	 */
	public array $content = [];

	/**
	 * Report email recipients.
	 */
	public array $recipients = [];

	/**
	 * Next scheduled send timestamp.
	 */
	public ?int $next_send_timestamp = null;

	/**
	 * The report date range.
	 */
	public string $date_range = '';

	/**
	 * Set report ID.
	 *
	 * @param int $id ID.
	 * @return Report Return report to allow method chaining.
	 */
	public function set_id( int $id ): Report {
		$this->id = $id;

		return $this;
	}

	/**
	 * Set report name.
	 *
	 * @param string $name Name.
	 * @return Report Return report to allow method chaining.
	 */
	public function set_name( string $name ): Report {
		$this->name = $name;

		return $this;
	}

	/**
	 * Set report format.
	 *
	 * @param string $format Format.
	 * @return Report Return report to allow method chaining.
	 */
	public function set_format( string $format ): Report {
		$this->format = $format;

		return $this;
	}

	/**
	 * Set report frequency.
	 *
	 * @param string $frequency Frequency.
	 * @return Report Return report to allow method chaining.
	 */
	public function set_frequency( string $frequency ): Report {
		$this->frequency = $frequency;

		return $this;
	}

	/**
	 * Set fixed end date.
	 *
	 * @param string $fixed_end_date The date to calculate date range back from.
	 * @return Report Return report to allow method chaining.
	 */
	public function set_fixed_end_date( string $fixed_end_date ): Report {
		$this->fixed_end_date = $fixed_end_date;

		return $this;
	}

	/**
	 * Set fixed end date to yesterday.
	 */
	public function set_fixed_end_date_to_yesterday(): Report {
		$yesterday            = gmdate( 'Y-m-d', strtotime( 'yesterday' ) );
		$this->fixed_end_date = $yesterday;
		$this->save();
		return $this;
	}

	/**
	 * Set day of month.
	 *
	 * @param int|null $week_of_month Day of month.
	 * @return Report Return report to allow method chaining.
	 */
	public function set_week_of_month( ?int $week_of_month ): Report {
		$this->week_of_month = $week_of_month;

		return $this;
	}

	/**
	 * Set day of week.
	 *
	 * @param string|null $day_of_week Day of week.
	 * @return Report Return report to allow method chaining.
	 */
	public function set_day_of_week( ?string $day_of_week ): Report {
		$this->day_of_week = $day_of_week;

		return $this;
	}

	/**
	 * Set send time.
	 *
	 * @param string $send_time Send time.
	 * @return Report Return report to allow method chaining.
	 */
	public function set_send_time( string $send_time ): Report {
		$this->send_time = $send_time;

		return $this;
	}

	/**
	 * Set last edit timestamp.
	 *
	 * @param int $last_edit Last edit timestamp.
	 * @return Report Return report to allow method chaining.
	 */
	public function set_last_edit( int $last_edit ): Report {
		$this->last_edit = $last_edit;

		return $this;
	}

	/**
	 * Set enabled status.
	 *
	 * @param bool $enabled Enabled status.
	 * @return Report Return report to allow method chaining.
	 */
	public function set_enabled( bool $enabled ): Report {
		$this->enabled = $enabled;

		return $this;
	}

	/**
	 * Set scheduled status.
	 *
	 * @param bool $scheduled Scheduled status.
	 * @return Report Return report to allow method chaining.
	 */
	public function set_scheduled( bool $scheduled ): Report {
		$this->scheduled = $scheduled;

		return $this;
	}

	/**
	 * Set content.
	 *
	 * @param array $content Content.
	 * @return Report Return report to allow method chaining.
	 */
	public function set_content( array $content ): Report {
		$this->content = $content;

		return $this;
	}

	/**
	 * Set date range.
	 *
	 * @param string $date_range Date range.
	 * @return Report Return report to allow method chaining.
	 */
	public function set_date_range( string $date_range ): Report {
		$this->date_range = $date_range;
		return $this;
	}

	/**
	 * Set recipients.
	 *
	 * @param array $recipients Recipients.
	 * @return Report Return report to allow method chaining.
	 */
	public function set_recipients( array $recipients ): Report {
		$this->recipients = $recipients;

		return $this;
	}

	/**
	 * Set next send timestamp.
	 *
	 * @param int|null $next_send_timestamp Next send timestamp.
	 * @return Report Return report to allow method chaining.
	 */
	public function set_next_send_timestamp( ?int $next_send_timestamp ): Report {
		$this->next_send_timestamp = $next_send_timestamp;

		return $this;
	}

	/**
	 * Constructor
	 */
	public function __construct( ?int $id = null ) {
		if ( ! empty( $id ) ) {
			$this->load( $id );
		}
	}

	/**
	 * Load report by ID
	 */
	public function load( int $id ): bool {
		global $wpdb;

		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}burst_reports WHERE ID = %d", $id ),
			ARRAY_A
		);

		if ( ! $row ) {
			return false;
		}

		$this->set_id( absint( $row['ID'] ) )
			->set_name( (string) $row['name'] )
			->set_format( (string) $row['format'] )
			->set_frequency( (string) $row['frequency'] )
			->set_fixed_end_date( (string) $row['fixed_end_date'] )
			->set_week_of_month( Report_Week_Of_Month::from_int( $row['week_of_month'] ) )
			->set_day_of_week( Report_Day_Of_Week::from_string( $row['day_of_week'] ) )
			->set_send_time( (string) $row['send_time'] )
			->set_last_edit( absint( $row['last_edit'] ) )
			->set_enabled( (bool) $row['enabled'] )
			->set_scheduled( (bool) $row['scheduled'] )
			->set_date_range( Report_Date_range::from_string( $row['date_range'] ) )
			->set_content( json_decode( $row['content'], true ) ?: [] )
			->set_recipients( json_decode( $row['recipients'], true ) ?: [] )
			->set_next_send_timestamp( $this->get_next_send_timestamp() );

		return true;
	}

	/**
	 * Generate a unique report name.
	 *
	 * @param string $base_name Base name to start from.
	 * @return string Unique name.
	 */
	protected function get_unique_name( string $base_name ): string {
		global $wpdb;

		$name = $base_name;
		$i    = 1;

		while (
			$wpdb->get_var(
				$wpdb->prepare(
					"SELECT COUNT(*) FROM {$wpdb->prefix}burst_reports WHERE name = %s",
					$name
				)
			)
		) {
			$suffix = ' ' . $i;
			$max    = self::NAME_MAX_LENGTH - mb_strlen( $suffix );
			$name   = mb_substr( $base_name, 0, $max ) . $suffix;
			++$i;
		}

		return $name;
	}

	/**
	 * Create report
	 */
	public function create(): bool {
		global $wpdb;

		$this->sanitize();
		$this->name = $this->get_unique_name( $this->name );

		$inserted = $wpdb->insert(
			$wpdb->prefix . 'burst_reports',
			$this->to_db_array(),
			$this->get_formats()
		);

		if ( false === $inserted ) {
			return false;
		}

		$this->load( $wpdb->insert_id );
		return true;
	}


	/**
	 * Update report
	 */
	public function save(): bool {
		global $wpdb;

		if ( empty( $this->id ) ) {
			return $this->create();
		}
		$this->sanitize();

		return false !== $wpdb->update(
			$wpdb->prefix . 'burst_reports',
			$this->to_db_array(),
			[ 'ID' => $this->id ],
			$this->get_formats(),
			[ '%d' ]
		);
	}

	/**
	 * Delete report
	 */
	public function delete(): bool {
		global $wpdb;

		if ( empty( $this->id ) ) {
			return false;
		}

		$table = $wpdb->prefix . 'burst_reports';

		return false !== $wpdb->delete(
			$table,
			[ 'ID' => $this->id ],
			[ '%d' ]
		);
	}

	/**
	 * Sanitize properties
	 */
	protected function sanitize(): void {
		$this->name           = $this->sanitize_name( $this->name );
		$this->format         = $this->sanitize_format( $this->format );
		$this->frequency      = $this->sanitize_frequency( $this->frequency );
		$this->day_of_week    = $this->sanitize_day_of_week( $this->day_of_week );
		$this->week_of_month  = $this->sanitize_week_of_month( $this->week_of_month );
		$this->send_time      = $this->sanitize_send_time( $this->send_time );
		$this->fixed_end_date = $this->sanitize_date_string( $this->fixed_end_date );
		$this->enabled        = rest_sanitize_boolean( $this->enabled );
		$this->scheduled      = rest_sanitize_boolean( $this->scheduled );
		$this->last_edit      = time();

		$this->content    = $this->sanitize_content( $this->content );
		$this->recipients = $this->sanitize_recipients( $this->recipients );
		$this->date_range = Report_Date_range::from_string( $this->date_range );
	}

	/**
	 * Sanitize date string in yyyy-MM-dd format.
	 */
	protected function sanitize_date_string( string $date_string ): string {
		// Check if the string matches yyyy-MM-dd format (e.g., 2025-01-13).
		if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date_string ) ) {
			// Additionally validate it's a real date.
			$date_parts = explode( '-', $date_string );
			if ( checkdate( (int) $date_parts[1], (int) $date_parts[2], (int) $date_parts[0] ) ) {
				return $date_string;
			}
		}

		// Return empty string if invalid.
		return '';
	}

	/**
	 * Sanitize report name.
	 *
	 * @param string $name Report name.
	 * @return string Sanitized name.
	 */
	private function sanitize_name( string $name ): string {
		$name = sanitize_text_field( $name );

		if ( '' === $name ) {
			$name = __( 'Untitled report', 'burst-statistics' );
		}

		return mb_substr( $name, 0, self::NAME_MAX_LENGTH );
	}

	/**
	 * Sanitize report frequency.
	 *
	 * @param string $frequency Report frequency.
	 * @return string Sanitized frequency.
	 */
	private function sanitize_frequency( string $frequency ): string {
		return Report_Frequency::from_string( $frequency );
	}

	/**
	 * Sanitize report format.
	 *
	 * @param string $format Report format.
	 * @return string Sanitized format.
	 */
	private function sanitize_format( string $format ): string {
		return Report_Format::from_string( $format );
	}

	/**
	 * Sanitize day of week.
	 *
	 * @param string|null $day Day of week.
	 * @return string|null Sanitized day of week.
	 */
	private function sanitize_day_of_week( ?string $day ): ?string {
		return Report_Day_Of_Week::from_string( $day );
	}

	/**
	 * Sanitize day of month.
	 *
	 * @param int|null $day Day of month.
	 * @return int|null Sanitized day of month.
	 */
	private function sanitize_week_of_month( ?int $day ): ?int {
		return Report_Week_Of_Month::from_int( $day );
	}

	/**
	 * Sanitize send time.
	 *
	 * @param string $time Send time.
	 * @return string Sanitized send time.
	 */
	private function sanitize_send_time( string $time ): string {
		$time = sanitize_text_field( $time );

		if ( preg_match( '/^(?:[01]\d|2[0-3]):[0-5]\d$/', $time ) ) {
			return $time;
		}

		return '09:00';
	}



	/**
	 * Convert to array for DB storage
	 */
	protected function to_db_array(): array {
		return [
			'name'           => $this->name,
			'format'         => $this->format,
			'frequency'      => $this->frequency,
			'fixed_end_date' => $this->fixed_end_date,
			'week_of_month'  => $this->week_of_month,
			'day_of_week'    => $this->day_of_week,
			'send_time'      => $this->send_time,
			'last_edit'      => $this->last_edit,
			'enabled'        => $this->enabled ? 1 : 0,
			'scheduled'      => $this->scheduled ? 1 : 0,
			'content'        => wp_json_encode( $this->content ),
			'recipients'     => wp_json_encode( $this->recipients ),
			'date_range'     => $this->date_range,
		];
	}


	/**
	 * Sanitize content array (recursive)
	 */
	public function sanitize_content( array $content ): array {
		$sanitized = [];

		foreach ( $content as $block ) {
			// Validate block structure.
			if ( ! is_array( $block ) || ! isset( $block['id'] ) ) {
				continue;
			}

			// Validate block ID.
			$valid_block_ids = Report_Content_Block::all_block_ids();
			if ( ! in_array( $block['id'], $valid_block_ids, true ) ) {
				continue;
			}
			$filters = isset( $block['filters'] ) ? $block['filters'] : [];
			// let Query_Data handle filter sanitizing.
			$qd = new Query_Data( [ 'filters' => $filters ] );

			// Sanitize block properties.
			$sanitized[] = [
				// already sanitized above.
				'id'                 => $block['id'],
				'filters'            => $qd->filters,
				'content'            => isset( $block['content'] ) ? sanitize_textarea_field( $block['content'] ) : '',
				'date_range'         => isset( $block['date_range'] ) ? Report_Date_Range::from_string( $block['date_range'] ) : '',
				'comment_title'      => isset( $block['comment_title'] ) ? sanitize_text_field( $block['comment_title'] ) : '',
				'comment_text'       => isset( $block['comment_text'] ) ? sanitize_textarea_field( $block['comment_text'] ) : '',
				'date_range_enabled' => isset( $block['date_range_enabled'] ) && (bool) $block['date_range_enabled'],
				'fixed_end_date'     => isset( $block['fixed_end_date'] ) ? $this->sanitize_date_string( $block['fixed_end_date'] ) : '',
			];
		}

		return $sanitized;
	}

	/**
	 * Sanitize email recipients
	 */
	protected function sanitize_recipients( array $recipients ): array {
		$sanitized = [];

		foreach ( $recipients as $email ) {
			$email = sanitize_email( trim( $email ) );

			if ( is_email( $email ) ) {
				$sanitized[] = $email;
			}
		}

		return array_values( array_unique( $sanitized ) );
	}

	/**
	 * WPDB formats.
	 */
	protected function get_formats(): array {
		return [
			// name.
			'%s',
			// format.
			'%s',
			// frequency.
			'%s',
			// fixed_end_date.
			'%s',
			// week_of_month.
			'%d',
			// day_of_week.
			'%s',
			// send_time.
			'%s',
			// last_edit.
			'%d',
			// enabled.
			'%d',
			// scheduled.
			'%d',
			// content.
			'%s',
			// recipients.
			'%s',
			// date_range.
			'%s',
		];
	}

	/**
	 * Convert to array (API safe).
	 */
	public function to_array(): array {
		$last_send_status = Report_Logs::instance()->get_report_status( $this->id );
		return [
			'id'              => $this->id,
			'name'            => $this->name,
			'format'          => $this->format,
			'frequency'       => $this->frequency,
			'fixedEndDate'    => $this->fixed_end_date,
			'weekOfMonth'     => $this->week_of_month,
			'dayOfWeek'       => $this->day_of_week,
			'sendTime'        => $this->send_time,
			'lastEdit'        => $this->last_edit,
			'enabled'         => $this->enabled,
			'scheduled'       => $this->scheduled,
			'content'         => $this->content,
			'reportDateRange' => $this->date_range,
			'recipients'      => $this->recipients,
			'lastSendStatus'  => $last_send_status['status'],
			'lastSendMessage' => $last_send_status['message'],
		];
	}

	/**
	 * Get the scheduled send timestamp for a report if it matches today's schedule.
	 *
	 * @return int|null The scheduled send timestamp or null if it doesn't match today's schedule.
	 */
	private function get_next_send_timestamp(): ?int {
		$today = time();

		if ( ! $this->matches_schedule( $today ) ) {
			return null;
		}

		$date = wp_date( 'Y-m-d', $today );

		try {
			$dt = new \DateTime(
				"{$date} {$this->send_time}",
				wp_timezone()
			);
		} catch ( \Exception $e ) {
			self::error_log( 'Error getting scheduled timestamp:  ' . $e->getMessage() );
			return null;
		}

		$dt->setTimezone( new \DateTimeZone( 'UTC' ) );
		$ts = $dt->getTimestamp();

		return ! empty( $ts ) ? $ts : null;
	}

	/**
	 * Check if the report matches the schedule for the given timestamp.
	 *
	 * @param int $timestamp The timestamp to check against.
	 * @return bool True if it matches the schedule, false otherwise.
	 */
	private function matches_schedule( int $timestamp ): bool {
		return match ( $this->frequency ) {
			Report_Frequency::DAILY   => true,
			// Checks if the current day matches the report's day_of_week.
			Report_Frequency::WEEKLY  => strtolower( gmdate( 'l', $timestamp ) ) === strtolower( $this->day_of_week ),
			Report_Frequency::MONTHLY => $this->matches_monthly_schedule( $timestamp ),
			default   => false,
		};
	}

	/**
	 * Check if the report matches the monthly schedule for the given timestamp.
	 *
	 * @param int $timestamp The timestamp to check against.
	 * @return bool True if it matches the monthly schedule, false otherwise.
	 */
	private function matches_monthly_schedule( int $timestamp ): bool {
		// Checks if the current day matches the report's current day_of_week.
		$weekday = strtolower( gmdate( 'l', $timestamp ) );
		if ( $weekday !== strtolower( $this->day_of_week ) ) {
			return false;
		}

		$year  = (int) gmdate( 'Y', $timestamp );
		$month = (int) gmdate( 'm', $timestamp );

		$weekday_timestamps = [];

		// Gets days of the current month that match the report's day_of_week.
		$days_in_month = (int) gmdate( 't', gmmktime( 0, 0, 0, $month, 1, $year ) );

		for ( $day = 1; $day <= $days_in_month; $day++ ) {
			$ts = gmmktime( 0, 0, 0, $month, $day, $year );
			if ( strtolower( gmdate( 'l', $ts ) ) === $weekday ) {
				// Create list of timestamps for the weekdays in the month.
				$weekday_timestamps[] = $ts;
			}
		}

		if ( empty( $weekday_timestamps ) ) {
			return false;
		}

		$ordinal = (int) $this->week_of_month;

		// -1 indicates the last occurrence of the weekday in the month.
		if ( $ordinal === Report_Week_Of_Month::LAST ) {
			return end( $weekday_timestamps ) === gmmktime( 0, 0, 0, $month, (int) gmdate( 'j', $timestamp ), $year );
		}

		// Check if the current date matches the nth occurrence of the weekday in the month.
		$index = $ordinal - 1;
		return isset( $weekday_timestamps[ $index ] ) && $weekday_timestamps[ $index ] === gmmktime( 0, 0, 0, $month, (int) gmdate( 'j', $timestamp ), $year );
	}
}
