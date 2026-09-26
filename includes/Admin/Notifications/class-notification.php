<?php
/**
 * Notification value object.
 *
 * @package Burst\Admin\Notifications
 */

namespace Burst\Admin\Notifications;

defined( 'ABSPATH' ) || exit;

/**
 * Class Notification
 *
 * Value object representing a notification payload across all delivery channels.
 */
class Notification {

	/**
	 * Notification type identifier (e.g. 'report.story', 'anomaly.spike', 'anomaly.dip', 'health.degraded').
	 */
	public string $type;

	/**
	 * Short headline for the notification (e.g. "Weekly report for example.com").
	 */
	public string $title;

	/**
	 * Plain-text sentence(s) describing the event.
	 */
	public string $body;

	/**
	 * Action URL (e.g. story share URL, dashboard deep link).
	 */
	public string $url;

	/**
	 * Key-value facts for rich display (e.g. [ 'Visitors' => '1 240', 'Average' => '610' ]).
	 *
	 * @var array<string, string>
	 */
	public array $facts;

	/**
	 * Associated report ID (0 when the event is not tied to a specific report).
	 */
	public int $report_id;

	/**
	 * Associated batch queue ID (null when not tied to a report batch).
	 */
	public ?string $queue_id = null;

	/**
	 * Notification constructor.
	 *
	 * @param string|array<string, mixed> $type_or_data Notification type or associative array of parameters.
	 * @param string                      $title        Headline title.
	 * @param string                      $body         Notification body.
	 * @param string                      $url          Action link or deep link.
	 * @param array<string, string>       $facts        Key-value pairs of statistics or metadata.
	 * @param int                         $report_id    Associated report ID (or 0).
	 * @param string|null                 $queue_id     Associated batch queue ID (or null).
	 */
	public function __construct(
		string|array $type_or_data,
		string $title = '',
		string $body = '',
		string $url = '',
		array $facts = [],
		int $report_id = 0,
		?string $queue_id = null
	) {
		if ( is_array( $type_or_data ) ) {
			$this->type      = isset( $type_or_data['type'] ) ? (string) $type_or_data['type'] : '';
			$this->title     = isset( $type_or_data['title'] ) ? (string) $type_or_data['title'] : '';
			$this->body      = isset( $type_or_data['body'] ) ? (string) $type_or_data['body'] : '';
			$this->url       = isset( $type_or_data['url'] ) ? (string) $type_or_data['url'] : '';
			$this->facts     = isset( $type_or_data['facts'] ) && is_array( $type_or_data['facts'] ) ? $type_or_data['facts'] : [];
			$this->report_id = isset( $type_or_data['report_id'] ) ? (int) $type_or_data['report_id'] : 0;
			$this->queue_id  = isset( $type_or_data['queue_id'] ) ? (string) $type_or_data['queue_id'] : null;
			return;
		}

		$this->type      = $type_or_data;
		$this->title     = $title;
		$this->body      = $body;
		$this->url       = $url;
		$this->facts     = $facts;
		$this->report_id = $report_id;
		$this->queue_id  = $queue_id;
	}

	/**
	 * Convert notification payload to an associative array.
	 *
	 * @return array{type: string, title: string, body: string, url: string, facts: array<string, string>, report_id: int, queue_id: ?string}
	 */
	public function to_array(): array {
		return [
			'type'      => $this->type,
			'title'     => $this->title,
			'body'      => $this->body,
			'url'       => $this->url,
			'facts'     => $this->facts,
			'report_id' => $this->report_id,
			'queue_id'  => $this->queue_id,
		];
	}
}
