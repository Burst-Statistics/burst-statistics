<?php
namespace Burst\Admin\Mailer;

use Burst\Admin\Reports\Report_Logs;
use Burst\Admin\Reports\DomainTypes\Report_Log_Status;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class to send an e-mail
 */
class Mailer {
	use Helper;
	use Admin_Helper;

	/**
	 * Report ID.
	 */
	public int $report_id = 0;

	/**
	 * Queue ID.
	 */
	public string $queue_id;

	/**
	 * Batch ID.
	 */
	public ?int $batch_id = null;

	/**
	 * Batch size.
	 */
	public int $batch_size = 10;

	/**
	 * Logo URL
	 */
	public string $logo;

	/**
	 * Recipient e-mail addresses
	 */
	public array $to = [];

	/**
	 * Pretty domain name (e.g., example.com)
	 */
	public string $pretty_domain;

	/**
	 * Domain name
	 */
	public string $domain;

	/**
	 * Email title
	 */
	public string $title;

	/**
	 * Email subtitle
	 */
	public string $subtitle;

	/**
	 * Email message body
	 */
	public string $message;

	/**
	 * Email subject
	 */
	public string $subject;

	/**
	 * Read more section
	 */
	public string $read_more;

	/**
	 * Button text
	 */
	public string $button_text;

	/**
	 * Sent by text
	 */
	public string $sent_by_text;

	/**
	 * Email blocks
	 */
	public array $blocks = [];

	/**
	 * Template filenames
	 */
	public string $template_filename;

	/**
	 * Block template filename
	 */
	public string $block_template_filename;

	/**
	 * Read more template filename
	 */
	public string $read_more_template_filename;

	/**
	 * Sent count.
	 */
	private int $sent_count = 0;

	/**
	 * Failed count.
	 */
	private int $failed_count = 0;

	/**
	 * Failed emails grouped by reason
	 *
	 * @var array<string, array<int, string>>
	 */
	private array $errors = [];

	/**
	 * The read more url.
	 */
	private string $read_more_button_url;
	/**
	 * The read more url.
	 */
	private ?string $read_more_button_text = null;
	/**
	 * The read more url.
	 */
	private ?string $read_more_header = null;

	/**
	 * The read more url.
	 */
	private ?string $read_more_teaser = null;

	/**
	 * Set report ID.
	 *
	 * @param int $report_id Report ID.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_report_id( int $report_id ): Mailer {
		$this->report_id = $report_id;

		return $this;
	}

	/**
	 * Set queue ID.
	 *
	 * @param string $queue_id Queue ID.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_queue_id( string $queue_id ): Mailer {
		$this->queue_id = $queue_id;

		return $this;
	}

	/**
	 * Set batch ID.
	 *
	 * @param int|null $batch_id Batch ID.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_batch_id( ?int $batch_id ): Mailer {
		$this->batch_id = $batch_id;

		return $this;
	}

	/**
	 * Set batch size.
	 *
	 * @param int $batch_size Batch size.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_batch_size( int $batch_size ): Mailer {
		$this->batch_size = $batch_size;

		return $this;
	}

	/**
	 * Set logo URL.
	 *
	 * @param string $logo Logo URL.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_logo( string $logo ): Mailer {
		$this->logo = $logo;

		return $this;
	}

	/**
	 * Set recipient e-mail addresses.
	 *
	 * @param array $to Recipient e-mail addresses.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_to( array $to ): Mailer {
		$this->to = $to;

		return $this;
	}

	/**
	 * Set pretty domain.
	 *
	 * @param string $pretty_domain Pretty domain.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_pretty_domain( string $pretty_domain ): Mailer {
		$this->pretty_domain = $pretty_domain;

		return $this;
	}

	/**
	 * Set domain.
	 *
	 * @param string $domain Domain.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_domain( string $domain ): Mailer {
		$this->domain = $domain;

		return $this;
	}

	/**
	 * Set title.
	 *
	 * @param string $title Title.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_title( string $title ): Mailer {
		$this->title = $title;

		return $this;
	}

	/**
	 * Set subtitle.
	 *
	 * @param string $subtitle Subtitle.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_subtitle( string $subtitle ): Mailer {
		$this->subtitle = $subtitle;

		return $this;
	}

	/**
	 * Set message.
	 *
	 * @param string $message Message.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_message( string $message ): Mailer {
		$this->message = $message;

		return $this;
	}

	/**
	 * Set subject.
	 *
	 * @param string $subject Subject.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_subject( string $subject ): Mailer {
		$this->subject = $subject;

		return $this;
	}

	/**
	 * Set read more section.
	 *
	 * @param string $read_more Read more section.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_read_more( string $read_more ): Mailer {
		$this->read_more = $read_more;

		return $this;
	}

	/**
	 * Set button text.
	 *
	 * @param string $button_text Button text.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_button_text( string $button_text ): Mailer {
		$this->button_text = $button_text;

		return $this;
	}

	/**
	 * Set sent by text.
	 *
	 * @param string $sent_by_text Sent by text.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_sent_by_text( string $sent_by_text ): Mailer {
		$this->sent_by_text = $sent_by_text;

		return $this;
	}

	/**
	 * Set blocks.
	 *
	 * @param array $blocks Blocks.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_blocks( array $blocks ): Mailer {
		$this->blocks = $blocks;

		return $this;
	}

	/**
	 * Set template filename.
	 *
	 * @param string $template_filename Template filename.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_template_filename( string $template_filename ): Mailer {
		$this->template_filename = $template_filename;

		return $this;
	}

	/**
	 * Set block template filename.
	 *
	 * @param string $block_template_filename Block template filename.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_block_template_filename( string $block_template_filename ): Mailer {
		$this->block_template_filename = $block_template_filename;

		return $this;
	}

	/**
	 * Set read more template filename.
	 *
	 * @param string $read_more_template_filename Read more template filename.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	public function set_read_more_template_filename( string $read_more_template_filename ): Mailer {
		$this->read_more_template_filename = $read_more_template_filename;

		return $this;
	}

	/**
	 * Set sent count.
	 *
	 * @param int $sent_count Sent count.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	private function set_sent_count( int $sent_count ): Mailer {
		$this->sent_count = $sent_count;

		return $this;
	}

	/**
	 * Set failed count.
	 *
	 * @param int $failed_count Failed count.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	private function set_failed_count( int $failed_count ): Mailer {
		$this->failed_count = $failed_count;

		return $this;
	}

	/**
	 * Set errors.
	 *
	 * @param array $errors Errors.
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	private function set_errors( array $errors ): Mailer {
		foreach ( $errors as $type => $values ) {
			if ( ! isset( $this->errors[ $type ] ) ) {
				$this->errors[ $type ] = [];
			}

			$this->errors[ $type ] = array_merge(
				$this->errors[ $type ],
				(array) $values
			);
		}

		return $this;
	}

	/**
	 * Clear errors.
	 *
	 * @return Mailer Returns the Mailer instance for method chaining.
	 */
	private function clear_errors(): Mailer {
		$this->errors = [];

		return $this;
	}

	/**
	 * Constructor
	 */
	public function __construct() {
		$mail_templates_path = BURST_PATH . 'includes/Admin/Mailer/templates/';

		$this->set_pretty_domain( preg_replace( '/^https?:\/\//', '', home_url() ) )
			->set_domain( '<a class="burst-intro-url" href="' . home_url() . '">' . $this->pretty_domain . '</a>' )
			->set_logo( BURST_URL . '/assets/img/burst-email-logo.png' )
			->set_sent_by_text(
				// translators: %s is the website's domain name (e.g., example.com).
				sprintf( __( 'This e-mail is sent from your own WordPress website, which is: %s.', 'burst-statistics' ), $this->pretty_domain ) .
								'<br />' . __( "If you don't want to receive these e-mails in your inbox, please go to the Burst settings page on your website and remove your email from the recipients in the report settings or contact the administrator of your website.", 'burst-statistics' )
			)
			// translators: %s is the website's domain name (e.g., example.com).
			->set_subject( sprintf( _x( 'Your weekly insights for %s are here!', 'domain name', 'burst-statistics' ), $this->pretty_domain ) )
			->set_button_text( __( 'See full report', 'burst-statistics' ) )
			// translators: %s is the website's domain name (e.g., example.com), used in HTML context.
			->set_title( sprintf( _x( 'Your weekly insights for %s are here!', 'domain name', 'burst-statistics' ), '<br /><span style="font-size: 30px; font-weight: 700">' . $this->pretty_domain . '</span><br />' ) )
			->set_block_template_filename( apply_filters( 'burst_email_block_template', $mail_templates_path . 'block.html' ) )
			->set_read_more_template_filename( apply_filters( 'burst_email_readmore_template', $mail_templates_path . 'read-more.html' ) )
			->set_template_filename( apply_filters( 'burst_email_template', $mail_templates_path . 'email.html' ) )
			->set_message( '' )
			// set a default, can be overridden if story format.
			->set_read_more_button_url( $this->admin_url( 'burst#/statistics' ) )
			->set_read_more_button_text( __( 'Explore your insights', 'burst-statistics' ) )
			->set_read_more_header( __( 'Find out more', 'burst-statistics' ) )
			// translators: %s is the website's domain name (e.g., example.com).
			->set_read_more_teaser( sprintf( __( 'Dive deeper into your analytics and uncover new opportunities for %s.', 'burst-statistics' ), $this->pretty_domain ) );
	}

	/**
	 * Set the read more url.
	 */
	public function set_read_more_button_url( string $url ): Mailer {
		$this->read_more_button_url = $url;
		return $this;
	}

	/**
	 * Set the read more url.
	 */
	public function set_read_more_button_text( string $text ): Mailer {
		$this->read_more_button_text = $text;
		return $this;
	}

	/**
	 * Set the read more url.
	 */
	public function set_read_more_header( string $text ): Mailer {
		$this->read_more_header = $text;
		return $this;
	}

	/**
	 * Set the read more url.
	 */
	public function set_read_more_teaser( string $text ): Mailer {
		$this->read_more_teaser = $text;
		return $this;
	}

	/**
	 * Configure the read more section
	 */
	private function set_read_more_section(): Mailer {
		$this->set_read_more(
			str_replace(
				[
					'{title}',
					'{message}',
					'{read_more_url}',
					'{read_more_text}',
				],
				[
					$this->read_more_header,
					// translators: %s is the website's domain name (e.g., example.com).
					$this->read_more_teaser,
					$this->read_more_button_url,
					$this->read_more_button_text,
				],
                file_get_contents( $this->read_more_template_filename ) // phpcs:ignore
			)
		);

		return $this;
	}

	/**
	 * Should schedule batch sending
	 *
	 * @return bool True if batch sending should be scheduled, false otherwise.
	 */
	public function should_schedule_batch_sending(): bool {
		if ( $this->batch_id === null ) {
			return false;
		}

		$offset           = $this->batch_id * $this->batch_size;
		$total_recipients = count( $this->to );

		return $offset < $total_recipients;
	}

	/**
	 * Move to the next batch
	 */
	public function move_to_next_batch(): void {
		if ( $this->batch_id === null ) {
			$this->set_batch_id( 1 );
		}

		$this->set_batch_id( ++$this->batch_id )
			->set_sent_count( 0 )
			->set_failed_count( 0 )
			->clear_errors();
	}

	/**
	 * Send an e-mail to all recipients
	 */
	public function send_mail_queue(): void {
		if ( Report_Logs::instance()->queue_exists( $this->report_id, $this->queue_id, $this->batch_id ) ) {
			self::error_log( "Batch $this->batch_id for queue $this->queue_id already processed. Skipping." );
			return;
		}

		$offset = ( $this->batch_id - 1 ) * $this->batch_size;

		foreach ( array_slice( $this->to, $offset, $this->batch_size ) as $email ) {
			$this->send_mail( $email );
		}

		$total = $this->sent_count + $this->failed_count;

		if ( $total > 0 ) {
			if ( $this->sent_count === $total ) {
				$status  = Report_Log_Status::SENDING_SUCCESSFUL;
				$message = Report_Log_Status::get_log_message( Report_Log_Status::SENDING_SUCCESSFUL );
			} elseif ( $this->failed_count === $total ) {
				$status  = Report_Log_Status::SENDING_FAILED;
				$message = $this->format_error_message();
			} else {
				$status  = Report_Log_Status::PARTLY_SENT;
				$message = sprintf(
					// translators: 1: number of failed emails, 2: total number of emails, 3: error message.
					__( '%1$d out of %2$d emails failed sending with reason(s): %3$s.', 'burst-statistics' ),
					$this->failed_count,
					$total,
					$this->format_error_message()
				);
			}

			Report_Logs::instance()->insert_log(
				$this->report_id,
				$this->queue_id,
				$this->batch_id,
				$status,
				$message
			);
		}

		if ( $this->should_schedule_batch_sending() ) {
			$this->move_to_next_batch();

			if ( ! wp_next_scheduled( 'burst_send_email_batch', [ $this->report_id, $this->queue_id, $this->batch_id ] ) ) {
				wp_schedule_single_event(
					time() + 5 * MINUTE_IN_SECONDS,
					'burst_send_email_batch',
					[ $this->report_id, $this->queue_id, $this->batch_id ]
				);
			}
		} else {
			Report_Logs::instance()->finalize_queue_status(
				$this->report_id,
				$this->queue_id
			);

			Report_Logs::instance()->clean_old_logs();
		}
	}

	/**
	 * Send an e-mail with the correct login URL
	 */
	public function send_mail( string $email ): bool {
		if ( ! is_email( $email ) ) {
			$this->set_failed_count( ++$this->failed_count )
				->set_errors(
					[
						'invalid_email' => [ $email ],
					]
				);
			return false;
		}

		if ( ! $this->check_email_domain( $email ) ) {
			$this->set_failed_count( ++$this->failed_count )
				->set_errors(
					[
						'invalid_domain' => [ $email ],
					]
				);
			return false;
		}

		add_action( 'wp_mail_failed', [ $this, 'log_mailer_errors' ] );

		$sent = wp_mail(
			$email,
			sanitize_text_field( $this->subject ),
			$this->render(),
			[ 'Content-Type: text/html; charset=UTF-8' ]
		);

		remove_action( 'wp_mail_failed', [ $this, 'log_mailer_errors' ] );

		if ( $sent ) {
			$this->set_sent_count( ++$this->sent_count );
		} else {
			$this->set_failed_count( ++$this->failed_count );
		}

		return $sent;
	}

	/**
	 * Log mailer errors.
	 *
	 * @param \WP_Error $error Error object.
	 */
	public function log_mailer_errors( \WP_Error $error ): void {
		$this->set_errors(
			[
				'mailer_error' => [ $error->get_error_message() ],
			]
		);
	}

	/**
	 * Format error message for logging.
	 *
	 * @return string Formatted error message.
	 */
	private function format_error_message(): string {
		$messages = [];

		if ( ! empty( $this->errors['invalid_email'] ) ) {
			$messages[] = sprintf(
				// translators: %s is a list of invalid email addresses.
				__( 'Invalid email address: %s', 'burst-statistics' ),
				implode( ', ', array_unique( $this->errors['invalid_email'] ) )
			);
		}

		if ( ! empty( $this->errors['invalid_domain'] ) ) {
			$messages[] = sprintf(
				// translators: %s is a list of invalid email domains.
				__( 'Invalid email domain: %s', 'burst-statistics' ),
				implode( ', ', array_unique( $this->errors['invalid_domain'] ) )
			);
		}

		if ( ! empty( $this->errors['mailer_error'] ) ) {
			$messages[] = implode( '; ', array_unique( $this->errors['mailer_error'] ) );
		}

		return implode( ' | ', $messages );
	}


	/**
	 * Render the email HTML without sending it.
	 *
	 * @return string Rendered email HTML
	 */
	public function render(): string {
		$this->set_read_more_section();
        $template   = file_get_contents( $this->template_filename ); // phpcs:ignore
		$block_html = '';

		if ( count( $this->blocks ) > 0 ) {
            $block_template = file_get_contents( $this->block_template_filename ); // phpcs:ignore
			foreach ( $this->blocks as $block ) {
				// Make sure all values are set.
				$block = wp_parse_args(
					$block,
					[
						'title'    => '',
						'subtitle' => '',
						'table'    => '',
						'url'      => '',
					]
				);

				$block_html .= str_replace(
					[ '{title}', '{subtitle}', '{table}', '{url}', '{learn-more}' ],
					[
						esc_html( $block['title'] ),
						esc_html( $block['subtitle'] ),
						wp_kses_post( $block['table'] ),
						esc_url_raw( $block['url'] ),
						esc_html( $this->button_text ),
					],
					$block_template
				);
			}
		}

		return str_replace(
			[
				'{base}',
				'{title}',
				'{logo}',
				'{message}',
				'{blocks}',
				'{read_more}',
				'{sent_by_text}',
				'{domain}',
			],
			[
				'<base href="' . esc_url( home_url( '/' ) ) . '">',
				wp_kses_post( $this->title ),
				esc_url_raw( $this->logo ),
				wp_kses_post( $this->message ),
				wp_kses_post( $block_html ),
				wp_kses_post( $this->read_more ),
				wp_kses_post( $this->sent_by_text ),
				home_url(),
			],
			$template
		);
	}

	/**
	 * Check if the email domain exists via DNS lookup
	 *
	 * @param string $email Email address to check.
	 * @return bool True if domain exists, false otherwise.
	 */
	public function check_email_domain( string $email ): bool {
		$parts = explode( '@', $email );

		if ( count( $parts ) !== 2 ) {
			return false;
		}

		$domain = $parts[1];

		if ( checkdnsrr( $domain, 'MX' ) ) {
			return true;
		}

		if ( checkdnsrr( $domain, 'A' ) ) {
			return true;
		}

		self::error_log( "$domain does not respond on check" );
		return false;
	}
}
