<?php
namespace Burst\Admin\Mailer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'Email_Block' ) ) {
	class Email_Block {
		public string $title   = '';
		public string $message = '';
		public string $url     = '';

		/**
		 * Get the email block data.
		 *
		 * @return array{title: string, message: string, url: string}
		 */
		public function get(): array {
			return [
				'title'   => $this->title,
				'message' => $this->message,
				'url'     => $this->url,
			];
		}
	}
}
