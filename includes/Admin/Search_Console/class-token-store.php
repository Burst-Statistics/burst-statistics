<?php
namespace Burst\Admin\Search_Console;

use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die();

/**
 * Stores and refreshes Google Search Console OAuth tokens.
 *
 * Both the access and refresh tokens are encrypted at rest in a single
 * non-autoloaded option. Tokens are never exposed to the browser; only
 * the connection state is. All token HTTP (code exchange, refresh, revoke) runs
 * through the Burst relay, which injects the client credentials.
 */
class Token_Store {
	use Helper;

	/**
	 * Option holding the encrypted token set. Autoload is off.
	 */
	private const OPTION = 'burst_gsc_tokens';

	/**
	 * Guards the weak-key fallback warning so it logs at most once per request.
	 */
	private static bool $key_fallback_warned = false;

	/**
	 * Exchange an authorization code for a token set (PKCE flow).
	 *
	 * @param string $code     The authorization code returned by Google.
	 * @param string $verifier The PKCE code verifier minted at connect time.
	 */
	public function exchange_code( string $code, string $verifier ): bool {
		$response = $this->request_token(
			[
				'grant_type'    => 'authorization_code',
				'code'          => $code,
				'code_verifier' => $verifier,
			]
		);

		if ( null === $response || empty( $response['access_token'] ) ) {
			return false;
		}

		return $this->store( $response );
	}

	/**
	 * Return a valid access token, refreshing transparently when expired.
	 * Returns null when disconnected or when a reconnect is required.
	 */
	public function get_access_token(): ?string {
		$data = $this->raw();
		if ( empty( $data['refresh_token'] ) || ! empty( $data['needs_reconnect'] ) ) {
			return null;
		}

		if ( ! empty( $data['access_token'] ) && isset( $data['expires_at'] ) && time() < (int) $data['expires_at'] ) {
			$token = $this->decrypt( (string) $data['access_token'] );
			if ( '' !== $token ) {
				return $token;
			}
		}

		if ( ! $this->refresh() ) {
			return null;
		}

		$data  = $this->raw();
		$token = ! empty( $data['access_token'] ) ? $this->decrypt( (string) $data['access_token'] ) : '';
		return '' !== $token ? $token : null;
	}

	/**
	 * Refresh the access token. The original refresh token is preserved because
	 * a refresh grant returns none. A dead refresh token flags a reconnect.
	 */
	public function refresh(): bool {
		$refresh = $this->get_refresh_token();
		if ( '' === $refresh ) {
			$this->flag_needs_reconnect();
			return false;
		}

		$response = $this->request_token(
			[
				'grant_type'    => 'refresh_token',
				'refresh_token' => $refresh,
			]
		);

		// Network error / rate limit / 5xx: transient, leave the connection intact.
		if ( null === $response ) {
			return false;
		}

		// Only invalid_grant (refresh token revoked / expired) is terminal and
		// must force a reconnect. Any other OAuth error (e.g. a transient
		// invalid_request from a relay hiccup) leaves the still-valid refresh
		// token in place so a later refresh can recover.
		if ( isset( $response['error'] ) && 'invalid_grant' === $response['error'] ) {
			$this->flag_needs_reconnect();
			return false;
		}

		// Any other error, or a response missing the access token: transient,
		// leave the connection intact.
		if ( ! empty( $response['error'] ) || empty( $response['access_token'] ) ) {
			return false;
		}

		return $this->store( $response );
	}

	/**
	 * Best-effort revoke of the refresh token at Google. Local deletion happens
	 * regardless of the outcome (see disconnect()).
	 */
	public function revoke(): void {
		$refresh = $this->get_refresh_token();
		if ( '' === $refresh ) {
			return;
		}

		wp_remote_post(
			'https://oauth2.googleapis.com/revoke',
			[
				'timeout'   => 25,
				'sslverify' => true,
				'body'      => [ 'token' => $refresh ],
			]
		);
	}

	/**
	 * Delete the stored token set.
	 */
	public function delete(): void {
		delete_option( self::OPTION );
	}

	/**
	 * Connection state for the UI. Never returns token material.
	 *
	 * @return string One of: connected, disconnected, needs-reconnect.
	 */
	public function status(): string {
		$data = $this->raw();
		if ( empty( $data['refresh_token'] ) ) {
			return 'disconnected';
		}
		return empty( $data['needs_reconnect'] ) ? 'connected' : 'needs-reconnect';
	}

	/**
	 * Persist a token set. Both tokens are stored encrypted; a refresh grant
	 * carries no refresh token, so the previously stored (encrypted) refresh
	 * value is retained.
	 *
	 * @param array $tokens Decoded token response from the relay.
	 * @return bool False when a token could not be encrypted (nothing is stored).
	 */
	private function store( array $tokens ): bool {
		$existing = $this->raw();

		if ( isset( $tokens['refresh_token'] ) && '' !== (string) $tokens['refresh_token'] ) {
			$refresh_enc = $this->encrypt( (string) $tokens['refresh_token'] );
			if ( '' === $refresh_enc ) {
				// Encryption failed; refuse to persist a token we cannot protect.
				return false;
			}
		} else {
			$refresh_enc = (string) ( $existing['refresh_token'] ?? '' );
		}

		$access     = isset( $tokens['access_token'] ) ? (string) $tokens['access_token'] : '';
		$access_enc = '' !== $access ? $this->encrypt( $access ) : '';
		if ( '' !== $access && '' === $access_enc ) {
			// Encryption failed; refuse to persist a token we cannot protect.
			return false;
		}

		$expires_in = isset( $tokens['expires_in'] ) ? (int) $tokens['expires_in'] : 3600;

		update_option(
			self::OPTION,
			[
				'access_token'    => $access_enc,
				'refresh_token'   => $refresh_enc,
				'expires_at'      => time() + $expires_in - 60,
				'scope'           => isset( $tokens['scope'] ) ? (string) $tokens['scope'] : '',
				'needs_reconnect' => false,
			],
			false
		);

		return true;
	}

	/**
	 * Raw stored token array (refresh token still encrypted).
	 */
	private function raw(): array {
		$data = get_option( self::OPTION, [] );
		return is_array( $data ) ? $data : [];
	}

	/**
	 * Decrypted refresh token, or '' when absent/undecryptable.
	 */
	private function get_refresh_token(): string {
		$data = $this->raw();
		if ( empty( $data['refresh_token'] ) ) {
			return '';
		}
		return $this->decrypt( (string) $data['refresh_token'] );
	}

	/**
	 * Mark the connection as needing a reconnect.
	 */
	private function flag_needs_reconnect(): void {
		$data = $this->raw();
		if ( empty( $data ) ) {
			return;
		}
		$data['needs_reconnect'] = true;
		update_option( self::OPTION, $data, false );
	}

	/**
	 * POST a grant to the relay's /token endpoint.
	 *
	 * @param array $body Grant body.
	 * @return array|null Decoded body on a 200 or a definitive OAuth error (400),
	 *                    null on a transient failure (network / 429 / 5xx).
	 */
	private function request_token( array $body ): ?array {
		$response = wp_remote_post(
			Search_Console::relay_base() . '/token',
			[
				'timeout'   => 25,
				'sslverify' => true,
				'headers'   => [ 'HTTP_X_BURST_SIGNATURE' => BURST_PUBLIC_KEY ],
				'body'      => $body,
			]
		);

		if ( is_wp_error( $response ) ) {
			// Network-level message only; never the request/response body.
			self::error_log( 'GSC token request failed: ' . $response->get_error_message() );
			return null;
		}

		$code    = (int) wp_remote_retrieve_response_code( $response );
		$decoded = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $decoded ) ) {
			$decoded = [];
		}

		if ( 200 === $code ) {
			return $decoded;
		}

		// A 400 with an OAuth error is definitive and the caller must act on it.
		if ( 400 === $code && ! empty( $decoded['error'] ) ) {
			return $decoded;
		}

		self::error_log( 'GSC token request returned HTTP ' . $code );
		return null;
	}

	/**
	 * Encrypt a value with libsodium (authenticated). Output is base64( nonce . cipher ).
	 * Returns '' when the CSPRNG or libsodium fails, so the caller can fail closed.
	 */
	private function encrypt( string $plaintext ): string {
		try {
			$nonce  = random_bytes( SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
			$cipher = sodium_crypto_secretbox( $plaintext, $nonce, $this->key() );
			// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- Encodes encrypted token bytes for storage, not obfuscation.
			return base64_encode( $nonce . $cipher );
		} catch ( \Exception $e ) {
			self::error_log( 'GSC: token encryption failed: ' . $e->getMessage() );
			return '';
		}
	}

	/**
	 * Decrypt a value produced by encrypt(). Returns '' on any failure, which
	 * fails closed to a reconnect rather than throwing.
	 */
	private function decrypt( string $encoded ): string {
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- Decodes stored ciphertext, not obfuscation.
		$decoded = base64_decode( $encoded, true );
		if ( false === $decoded || strlen( $decoded ) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ) {
			return '';
		}
		try {
			$nonce  = substr( $decoded, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
			$cipher = substr( $decoded, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
			$plain  = sodium_crypto_secretbox_open( $cipher, $nonce, $this->key() );
			return false === $plain ? '' : $plain;
		} catch ( \Exception ) {
			return '';
		}
	}

	/**
	 * Derive the 32-byte encryption key from a secret kept outside the database
	 * where possible: a dedicated constant, else WordPress' AUTH_KEY (a wp-config
	 * constant on standard installs), else the auth salt as a last resort.
	 *
	 * @throws \SodiumException Throws SodiumException from sodium_crypto_generichash function.
	 */
	private function key(): string {
		if ( defined( 'BURST_GSC_ENCRYPTION_KEY' ) && '' !== (string) BURST_GSC_ENCRYPTION_KEY ) {
			$material = (string) BURST_GSC_ENCRYPTION_KEY;
		} elseif ( defined( 'AUTH_KEY' ) && '' !== (string) AUTH_KEY ) {
			$material = AUTH_KEY;
		} else {
			// wp_salt() persists its salt in the database, so it is weaker against a
			// DB compromise than a wp-config constant. Warn once and fall back.
			if ( ! self::$key_fallback_warned ) {
				self::$key_fallback_warned = true;
				self::error_log( 'GSC: AUTH_KEY is not defined; falling back to wp_salt for token encryption, which is weaker against a database compromise. Define AUTH_KEY or BURST_GSC_ENCRYPTION_KEY in wp-config.php.' );
			}
			$material = wp_salt( 'auth' );
		}
		return sodium_crypto_generichash( $material, '', SODIUM_CRYPTO_SECRETBOX_KEYBYTES );
	}
}
