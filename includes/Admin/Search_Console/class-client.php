<?php
namespace Burst\Admin\Search_Console;

use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die();

/**
 * Thin client for the Google Search Console (webmasters/v3) API.
 *
 * Calls Google directly with the stored access token; the relay is only in the
 * path for the OAuth handshake and token refresh. Every method returns null on
 * failure so the caller can stop without losing or duplicating data.
 */
class Client {
	use Helper;

	/**
	 * Search Console API base URL.
	 */
	private const BASE = 'https://www.googleapis.com/webmasters/v3';

	/**
	 * Token store providing the access token (refreshed transparently).
	 */
	private Token_Store $token_store;

	/**
	 * Whether the most recent API request was denied for the selected property.
	 */
	private bool $access_denied = false;

	/**
	 * Constructor.
	 *
	 * @param Token_Store $token_store Token store instance.
	 */
	public function __construct( Token_Store $token_store ) {
		$this->token_store = $token_store;
	}

	/**
	 * List the properties the connected account can access.
	 *
	 * @return array|null siteEntry[] (each with siteUrl, permissionLevel), or null on failure.
	 */
	public function list_sites(): ?array {
		$token = $this->token_store->get_access_token();
		if ( null === $token ) {
			$this->log( 'api.properties', 'error', 'Could not request Search Console properties because no usable access token is available.' );
			return null;
		}

		$endpoint = self::BASE . '/sites';
		$args     = [
			'timeout'   => 20,
			'sslverify' => true,
			'headers'   => [ 'Authorization' => 'Bearer ' . $token ],
		];
		$started  = microtime( true );
		$response = wp_remote_get(
			$endpoint,
			$args
		);

		$data = $this->decode(
			$response,
			'api.properties',
			[
				'request'     => [
					'method'  => 'GET',
					'url'     => $endpoint,
					'timeout' => $args['timeout'],
				],
				'duration_ms' => (int) round( ( microtime( true ) - $started ) * 1000 ),
			]
		);
		if ( null === $data ) {
			return null;
		}

		return isset( $data['siteEntry'] ) && is_array( $data['siteEntry'] ) ? $data['siteEntry'] : [];
	}

	/**
	 * Query the search-term rows for a single day, grouped by query only (the
	 * quota is shared per project, so we avoid grouping by page as well).
	 *
	 * @param string $site_url    The property (siteUrl) to query.
	 * @param string $date        The day in Y-m-d (startDate = endDate).
	 * @param string $page_filter Optional RE2 page filter for a broader property.
	 * @return array|null rows[] (keys, clicks, impressions, ctr, position), [] when
	 *                    the day has no data, or null on failure.
	 */
	public function query_terms( string $site_url, string $date, string $page_filter = '' ): ?array {
		$this->access_denied = false;
		$token               = $this->token_store->get_access_token();
		if ( null === $token ) {
			$this->log( 'api.queries', 'error', 'Could not request Search Console query data because no usable access token is available.', [ 'date' => $date ] );
			return null;
		}

		$endpoint = self::BASE . '/sites/' . rawurlencode( $site_url ) . '/searchAnalytics/query';
		$body     = [
			'startDate'  => $date,
			'endDate'    => $date,
			'dimensions' => [ 'query' ],
			'rowLimit'   => 1000,
		];
		if ( '' !== $page_filter ) {
			$body['dimensionFilterGroups'] = [
				[
					'filters' => [
						[
							'dimension'  => 'page',
							'operator'   => 'includingRegex',
							'expression' => $page_filter,
						],
					],
				],
			];
		}
		$args     = [
			'timeout'   => 30,
			'sslverify' => true,
			'headers'   => [
				'Authorization' => 'Bearer ' . $token,
				'Content-Type'  => 'application/json',
			],
			'body'      => wp_json_encode( $body ),
		];
		$started  = microtime( true );
		$response = wp_remote_post(
			$endpoint,
			$args
		);

		$data = $this->decode(
			$response,
			'api.queries',
			[
				'property'    => $site_url,
				'date'        => $date,
				'request'     => [
					'method'      => 'POST',
					'url'         => $endpoint,
					'timeout'     => $args['timeout'],
					'dimensions'  => $body['dimensions'],
					'row_limit'   => $body['rowLimit'],
					'page_filter' => '' !== $page_filter,
				],
				'duration_ms' => (int) round( ( microtime( true ) - $started ) * 1000 ),
			]
		);
		if ( null === $data ) {
			return null;
		}

		return isset( $data['rows'] ) && is_array( $data['rows'] ) ? $data['rows'] : [];
	}

	/**
	 * Whether the most recent searchAnalytics request returned HTTP 403.
	 */
	public function access_was_denied(): bool {
		return $this->access_denied;
	}

	/**
	 * Decode a Google API response. Returns the decoded array on 200, or null on
	 * any error. A 401 forces a token refresh so the next run starts clean; a 403
	 * means the connected account lacks access to the property.
	 *
	 * @param \WP_Error|array $response The wp_remote_* result.
	 * @param string          $event    Event name.
	 * @param array           $context  Request context.
	 */
	private function decode( \WP_Error|array $response, string $event, array $context = [] ): ?array {
		if ( is_wp_error( $response ) ) {
			self::error_log( 'GSC API request failed: ' . $response->get_error_message() );
			$this->log(
				$event,
				'error',
				'Google API request failed before receiving a response.',
				array_merge(
					$context,
					[
						'wp_error' => [
							'code'    => $response->get_error_code(),
							'message' => $response->get_error_message(),
						],
					]
				)
			);
			return null;
		}

		$code    = (int) wp_remote_retrieve_response_code( $response );
		$raw     = wp_remote_retrieve_body( $response );
		$decoded = json_decode( $raw, true );
		$context = array_merge(
			$context,
			[
				'response' => [
					'http_status' => $code,
					'summary'     => $this->response_summary( $event, $decoded, $raw ),
				],
			]
		);
		if ( 200 === $code ) {
			$this->log( $event, 'success', 'Google API request completed.', $context );
			return is_array( $decoded ) ? $decoded : [];
		}

		if ( 401 === $code ) {
			// Access token rejected mid-window; refresh so the next call starts clean.
			$this->token_store->refresh();
			self::error_log( 'GSC API returned HTTP 401; refreshed access token.' );
			$this->log( $event, 'error', 'Google API rejected the access token and a refresh was requested.', $context );
			return null;
		}

		if ( 403 === $code ) {
			$this->access_denied = true;
			self::error_log( 'GSC API returned HTTP 403: the connected account lacks access to this property.' );
			$this->log( $event, 'error', 'Google API denied access to this Search Console property.', $context );
			return null;
		}

		self::error_log( 'GSC API returned HTTP ' . $code );
		$this->log( $event, 'error', 'Google API returned an unexpected response.', $context );
		return null;
	}

	/**
	 * Summarize a Google API response without recording Search Console rows,
	 * queries, properties, or other response data in diagnostics.
	 *
	 * @param string $event   API event name.
	 * @param mixed  $decoded Decoded response body.
	 * @param string $raw     Raw response body.
	 */
	private function response_summary( string $event, mixed $decoded, string $raw ): array {
		$summary = [ 'body_bytes' => strlen( $raw ) ];
		if ( ! is_array( $decoded ) ) {
			return $summary;
		}

		if ( 'api.properties' === $event ) {
			$summary['property_count'] = isset( $decoded['siteEntry'] ) && is_array( $decoded['siteEntry'] ) ? count( $decoded['siteEntry'] ) : 0;
		}
		if ( 'api.queries' === $event ) {
			$summary['row_count'] = isset( $decoded['rows'] ) && is_array( $decoded['rows'] ) ? count( $decoded['rows'] ) : 0;
		}

		return $summary;
	}

	/**
	 * Store a redacted Google API event for the current site.
	 *
	 * @param string $event Event name.
	 * @param string $status Event status.
	 * @param string $message Event message.
	 * @param array  $context Non-sensitive context.
	 */
	private function log( string $event, string $status, string $message, array $context = [] ): void {
		( new Diagnostic_Logs() )->add( $event, $status, $message, $context );
	}
}
