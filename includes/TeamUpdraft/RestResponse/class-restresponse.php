<?php
namespace Burst\TeamUpdraft\RestResponse;

defined( 'ABSPATH' ) | die();

class RestResponse {

	public string $message       = 'You do not have permission to perform this action.';
	public bool $success         = false;
	public bool $request_success = true;
	public array $data           = [];

	/**
	 * Get the response object
	 *
	 * @return array{
	 *     message: string,
	 *     success: bool,
	 *     request_success: bool,
	 * }
	 */
	public function get(): array {
		return [
			'message'         => $this->message,
			'success'         => $this->success,
			'request_success' => $this->request_success,
			'data'            => $this->data,
		];
	}
}
