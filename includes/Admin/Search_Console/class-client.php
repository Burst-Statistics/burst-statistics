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
	 * Supported Search Console API endpoints.
	 */
	private const ENDPOINT_SITES = 'sites';
	private const ENDPOINT_QUERY = 'query';

	/**
	 * Search Analytics response and per-day data limits documented by Google.
	 */
	private const ROW_LIMIT        = 25000;
	private const MAX_ROWS_PER_DAY = 50000;

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

		try {
			$endpoint = $this->get_endpoint_url( self::ENDPOINT_SITES );
		} catch ( \InvalidArgumentException $exception ) {
			self::error_log( 'GSC API endpoint error: ' . $exception->getMessage() );
			return null;
		}
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

		if ( isset( $data['siteEntry'] ) && ! is_array( $data['siteEntry'] ) ) {
			self::error_log( 'GSC API returned an invalid siteEntry payload.' );
			return null;
		}

		return $data['siteEntry'] ?? [];
	}

	/**
	 * Query the search-term rows for a single day, grouped by query only (the
	 * quota is shared per project, so we avoid grouping by page as well).
	 *
	 * @param string $property    The property (siteUrl) to query.
	 * @param string $date        The day in Y-m-d (startDate = endDate).
	 * @param string $page_filter Optional RE2 page filter for a broader property.
	 * @return array|null rows[] (keys, clicks, impressions, ctr, position), [] when
	 *                    the day has no data, or null on failure.
	 */
	public function query_terms( string $property, string $date, string $page_filter = '' ): ?array {
		$this->access_denied = false;
		$token               = $this->token_store->get_access_token();
		if ( null === $token ) {
			$this->log( 'api.queries', 'error', 'Could not request Search Console query data because no usable access token is available.', [ 'date' => $date ] );
			return null;
		}

		try {
			$endpoint = $this->get_endpoint_url( self::ENDPOINT_QUERY, $property );
		} catch ( \InvalidArgumentException $exception ) {
			self::error_log( 'GSC API endpoint error: ' . $exception->getMessage() );
			return null;
		}
		$body = [
			'startDate'  => $date,
			'endDate'    => $date,
			'dimensions' => [ 'query' ],
			'rowLimit'   => 5000,
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
				'property'    => $property,
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

		return $this->validated_rows( $data, 1 );
	}

	/**
	 * Query daily search terms for one exact page and date range. Google caps each
	 * response, so continue with startRow until the final partial page is returned.
	 *
	 * @param string $property   The property (siteUrl) to query.
	 * @param string $start_date First day in Y-m-d.
	 * @param string $end_date   Last day in Y-m-d.
	 * @param string $page_url   Exact page URL to query.
	 * @return array|null rows[] (keys[0] = date, keys[1] = query), [] when the
	 *                    range has no data, or null when any request fails.
	 */
	public function query_page_terms( string $property, string $start_date, string $end_date, string $page_url ): ?array {
		$this->access_denied = false;
		$token               = $this->token_store->get_access_token();
		if ( null === $token ) {
			$this->log( 'api.queries', 'error', 'Could not request Search Console page query data because no usable access token is available.' );
			return null;
		}

		$page_url = esc_url_raw( $page_url );
		if ( '' === $page_url ) {
			return null;
		}
		try {
			$endpoint = $this->get_endpoint_url( self::ENDPOINT_QUERY, $property );
		} catch ( \InvalidArgumentException $exception ) {
			self::error_log( 'GSC API endpoint error: ' . $exception->getMessage() );
			return null;
		}

		$start = strtotime( $start_date . ' UTC' );
		$end   = strtotime( $end_date . ' UTC' );
		if ( false === $start || false === $end || $start > $end ) {
			return null;
		}

		$row_limit = self::ROW_LIMIT;
		$max_rows  = ( (int) floor( ( $end - $start ) / DAY_IN_SECONDS ) + 1 ) * self::MAX_ROWS_PER_DAY;
		$start_row = 0;
		$rows      = [];

		do {
			$body     = [
				'startDate'             => $start_date,
				'endDate'               => $end_date,
				'dimensions'            => [ 'date', 'query' ],
				'dimensionFilterGroups' => [
					[
						'groupType' => 'and',
						'filters'   => [
							[
								'dimension'  => 'page',
								'operator'   => 'equals',
								'expression' => $page_url,
							],
						],
					],
				],
				'rowLimit'              => $row_limit,
				'startRow'              => $start_row,
			];
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
			$response = wp_remote_post( $endpoint, $args );
			$data     = $this->decode(
				$response,
				'api.queries',
				[
					'property'    => $property,
					'date_start'  => $start_date,
					'date_end'    => $end_date,
					'request'     => [
						'method'      => 'POST',
						'url'         => $endpoint,
						'timeout'     => $args['timeout'],
						'dimensions'  => $body['dimensions'],
						'row_limit'   => $body['rowLimit'],
						'start_row'   => $body['startRow'],
						'page_filter' => true,
					],
					'duration_ms' => (int) round( ( microtime( true ) - $started ) * 1000 ),
				]
			);
			if ( null === $data ) {
				return null;
			}

			$page_rows = $this->validated_rows( $data, 2 );
			if ( null === $page_rows || count( $page_rows ) > $row_limit ) {
				self::error_log( 'GSC API returned an invalid page-query row payload.' );
				return null;
			}
			foreach ( $page_rows as $row ) {
				$date = (string) $row['keys'][0];
				if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date ) || $date < $start_date || $date > $end_date || '' === (string) $row['keys'][1] ) {
					self::error_log( 'GSC API returned a page-query row outside the requested range.' );
					return null;
				}
				$rows[] = $row;
			}
			$page_count = count( $page_rows );
			$start_row += $row_limit;
			$total_rows = count( $rows );
		} while ( $page_count === $row_limit && $total_rows < $max_rows );

		return $rows;
	}

	/**
	 * Build a supported Search Console API endpoint URL.
	 *
	 * @throws \InvalidArgumentException When the endpoint type is unsupported or
	 *                                   a query endpoint has no property.
	 */
	private function get_endpoint_url( string $endpoint, string $property = '' ): string {
		if ( self::ENDPOINT_SITES === $endpoint ) {
			return self::BASE . '/sites';
		}

		if ( self::ENDPOINT_QUERY === $endpoint ) {
			$property = trim( $property );
			if ( '' === $property ) {
				throw new \InvalidArgumentException( 'A Search Console property is required for the query endpoint.' );
			}

			return self::BASE . '/sites/' . rawurlencode( $property ) . '/searchAnalytics/query';
		}

		throw new \InvalidArgumentException( 'Unsupported Search Console endpoint type.' );
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
			if ( ! is_array( $decoded ) ) {
				self::error_log( 'GSC API returned an invalid JSON response.' );
				$this->log( $event, 'error', 'Google API returned an invalid JSON response.', $context );
				return null;
			}
			$this->log( $event, 'success', 'Google API request completed.', $context );
			return $decoded;
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
	 * Validate the common Search Analytics row structure before a caller replaces data.
	 */
	private function validated_rows( array $data, int $required_keys ): ?array {
		if ( ! array_key_exists( 'rows', $data ) ) {
			return [];
		}
		if ( ! is_array( $data['rows'] ) ) {
			self::error_log( 'GSC API returned an invalid rows payload.' );
			return null;
		}

		foreach ( $data['rows'] as $row ) {
			if ( ! is_array( $row ) || ! isset( $row['keys'] ) || ! is_array( $row['keys'] ) || count( $row['keys'] ) < $required_keys ) {
				self::error_log( 'GSC API returned a row without the expected dimensions.' );
				return null;
			}
			foreach ( [ 'clicks', 'impressions', 'ctr', 'position' ] as $metric ) {
				if ( ! array_key_exists( $metric, $row ) || ! is_numeric( $row[ $metric ] ) || ! is_finite( (float) $row[ $metric ] ) || (float) $row[ $metric ] < 0 ) {
					self::error_log( 'GSC API returned an invalid row metric.' );
					return null;
				}
			}
		}

		return $data['rows'];
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
