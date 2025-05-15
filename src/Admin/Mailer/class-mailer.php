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

if ( ! class_exists( 'mailer' ) ) {
	class Mailer {
		use Helper;
		use Admin_Helper;

		public $logo;
		public $to;
		public $pretty_domain;
		public $domain;
		public $title;
		public $subtitle;
		public $headers;
		public $message;
		public $subject;
		public $read_more;
		public $button_text;
		public $change_text;
		public $sent_to_text;
		public $what_now_text;
		public $sent_by_text;
		public $blocks;
		public $error = '';
		public $template_filename;
		public $block_template_filename;
		public $read_more_template_filename;
		/**
		 * Constructor
		 */
		public function __construct() {
			$this->pretty_domain = preg_replace( '/^https?:\/\//', '', site_url() );
			$this->domain        = '<a class="burst-intro-url" href="' . site_url() . '">' . $this->pretty_domain . '</a>';
			$this->logo          = BURST_URL . '/assets/img/burst-email-logo.png';
			$this->sent_by_text  = __( 'This e-mail is sent from your own WordPress website, which is:', 'burst-statistics' ) . ' ' . $this->pretty_domain . '.<br />' .
									__( "If you don't want to receive these e-mails in your inbox, please go to the Burst settings page on your website and disable the email report setting or contact the administrator of your website.", 'burst-statistics' );
			// translators: %s is the website's domain name (e.g., example.com).
			$this->subject     = sprintf( _x( 'Your weekly insights for %s are here!', 'domain name', 'burst-statistics' ), $this->pretty_domain );
			$this->button_text = __( 'See full report', 'burst-statistics' );
			// translators: %s is the website's domain name (e.g., example.com), used in HTML context.
			$this->title                       = sprintf( _x( 'Your weekly insights for %s are here!', 'domain name', 'burst-statistics' ), '<br /><span style="font-size: 30px; font-weight: 700">' . $this->pretty_domain . '</span><br />' );
			$this->what_now_text               = __( 'Learn more', 'burst-statistics' );
			$this->sent_to_text                = __( 'This email was sent to', 'burst-statistics' );
			$this->change_text                 = __( 'Why did I receive this email?', 'burst-statistics' );
			$this->block_template_filename     = apply_filters( 'burst_email_block_template', BURST_PATH . 'src/Admin/Mailer/templates/block.html' );
			$this->read_more_template_filename = apply_filters( 'burst_email_readmore_template', BURST_PATH . 'src/Admin/Mailer/templates/read-more.html' );
			$this->template_filename           = apply_filters( 'burst_email_template', BURST_PATH . 'src/Admin/Mailer/templates/email.html' );
			$this->message                     = '';
			$read_more_template                = file_get_contents( $this->read_more_template_filename ); // phpcs:ignore
			$this->read_more                   = str_replace(
				[
					'{title}',
					'{message}',
					'{read_more_url}',
					'{read_more_text}',
				],
				[
					__( 'Find out more', 'burst-statistics' ),
					// translators: %s is the website's domain name (e.g., example.com).
					sprintf( __( 'Dive deeper into your analytics and uncover new opportunities for %s.', 'burst-statistics' ), $this->pretty_domain ),
					$this->admin_url( 'burst#/statistics' ),
					__( 'Explore your insights', 'burst-statistics' ),
				],
				$read_more_template
			);

			add_action( 'wp_mail_failed', [ $this, 'log_mailer_errors' ], 10, 1 );
		}

		/**
		 * Log mailer errors
		 */
		public function log_mailer_errors( \WP_Error $wp_error ): void {
			$this->error = $wp_error->get_error_message();
			self::error_log( 'Mailer error: ' . $this->error );
		}

		/**
		 * Send an e-mail to all recipients
		 */
		public function send_mail_queue(): void {
			$to = $this->to;
			if ( ! is_array( $to ) ) {
				$to = [ $to ];
			}
			// max 10.
			$to = array_slice( $to, 0, 10 );

			foreach ( $to as $email ) {
				if ( ! is_email( $email ) ) {
					continue;
				}

				$this->send_mail( $email );
			}
		}

		/**
		 * Send an e-mail with the correct login URL
		 */
		public function send_mail( string $to ): bool {
			if ( empty( $this->message ) || empty( $this->subject ) ) {
				$this->error = __( 'Email could not be sent. No message or subject set.', 'burst-statistics' );
			}

			if ( ! is_email( $to ) ) {
				$this->error = __( 'Email address not valid', 'burst-statistics' );
			}

			$template   = file_get_contents( $this->template_filename ); // phpcs:ignore
			$block_html = '';
			if ( is_array( $this->blocks ) && count( $this->blocks ) > 0 ) {
				$block_template = file_get_contents( $this->block_template_filename ); // phpcs:ignore
				foreach ( $this->blocks as $block ) {
					// make sure all values are set.
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
						[ '{title}', '{subtitle}', '{table}', '{url}' ],
						[
							sanitize_text_field( $block['title'] ),
							sanitize_text_field( $block['subtitle'] ),
							wp_kses_post( $block['table'] ),
							esc_url_raw( $block['url'] ),
						],
						$block_template
					);
				}
			}

			$login_url = wp_login_url();
			$body      = str_replace(
				[
					'{title}',
					'{logo}',
					'{message}',
					'{warnings}',
					'{read_more}',
					'{email-address}',
					'{learn-more}',
					'{site_url}',
					'{login_url}',
					'{change_text}',
					'{what_now}',
					'{sent_to_text}',
					'{sent_by_text}',
					'{domain}',
				],
				[
					$this->title,
					$this->logo,
					wp_kses_post( $this->message ),
					$block_html,
					$this->read_more,
					$to,
					$this->button_text,
					site_url(),
					$login_url,
					$this->change_text,
					$this->what_now_text,
					$this->sent_to_text,
					$this->sent_by_text,
					site_url(),
				],
				$template
			);

			return wp_mail( $to, sanitize_text_field( $this->subject ), $body, [ 'Content-Type: text/html; charset=UTF-8' ] );
		}
	}
}
