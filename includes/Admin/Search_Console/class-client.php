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
			return null;
		}

		$response = wp_remote_get(
			self::BASE . '/sites',
			[
				'timeout'   => 20,
				'sslverify' => true,
				'headers'   => [ 'Authorization' => 'Bearer ' . $token ],
			]
		);

		$data = $this->decode( $response );
		if ( null === $data ) {
			return null;
		}

		return isset( $data['siteEntry'] ) && is_array( $data['siteEntry'] ) ? $data['siteEntry'] : [];
	}

	/**
	 * Query the search-term rows for a single day, grouped by query only (the
	 * quota is shared per project, so we avoid grouping by page as well).
	 *
	 * @param string $site_url The property (siteUrl) to query.
	 * @param string $date     The day in Y-m-d (startDate = endDate).
	 * @return array|null rows[] (keys, clicks, impressions, ctr, position), [] when
	 *                    the day has no data, or null on failure.
	 */
	public function query_terms( string $site_url, string $date ): ?array {
		$token = $this->token_store->get_access_token();
		if ( null === $token ) {
			return null;
		}

		$endpoint = self::BASE . '/sites/' . rawurlencode( $site_url ) . '/searchAnalytics/query';
		$response = wp_remote_post(
			$endpoint,
			[
				'timeout'   => 30,
				'sslverify' => true,
				'headers'   => [
					'Authorization' => 'Bearer ' . $token,
					'Content-Type'  => 'application/json',
				],
				'body'      => wp_json_encode(
					[
						'startDate'  => $date,
						'endDate'    => $date,
						'dimensions' => [ 'query' ],
						'rowLimit'   => 1000,
					]
				),
			]
		);

		$data = $this->decode( $response );
		if ( null === $data ) {
			return null;
		}

		return isset( $data['rows'] ) && is_array( $data['rows'] ) ? $data['rows'] : [];
	}

	/**
	 * Decode a Google API response. Returns the decoded array on 200, or null on
	 * any error. A 401 forces a token refresh so the next run starts clean; a 403
	 * means the connected account lacks access to the property.
	 *
	 * @param \WP_Error|array $response The wp_remote_* result.
	 */
	private function decode( \WP_Error|array $response ): ?array {
		if ( is_wp_error( $response ) ) {
			self::error_log( 'GSC API request failed: ' . $response->get_error_message() );
			return null;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		if ( 200 === $code ) {
			$body = json_decode( wp_remote_retrieve_body( $response ), true );
			return is_array( $body ) ? $body : [];
		}

		if ( 401 === $code ) {
			// Access token rejected mid-window; refresh so the next call starts clean.
			$this->token_store->refresh();
			self::error_log( 'GSC API returned HTTP 401; refreshed access token.' );
			return null;
		}

		if ( 403 === $code ) {
			self::error_log( 'GSC API returned HTTP 403: the connected account lacks access to this property.' );
			return null;
		}

		self::error_log( 'GSC API returned HTTP ' . $code );
		return null;
	}
}
