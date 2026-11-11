<?php
/**
 * Package Verifier.
 *
 * Verifies Ed25519 digital signatures of update packages before installation.
 *
 * @package Burst
 */

namespace Burst\Admin\Update_Verification;

defined( 'ABSPATH' ) || die();

/**
 * Class Package_Verifier
 */
class Package_Verifier {

	/**
	 * Expected format version of the update manifest.
	 *
	 * @var int
	 */
	public const FORMAT_VERSION = 1;

	/**
	 * Expected product name in the update manifest.
	 *
	 * @var string
	 */
	public const PRODUCT_NAME = 'burst-pro';

	/**
	 * Signature prefix to prevent cross-protocol replay attacks.
	 *
	 * @var string
	 */
	public const SIGNATURE_PREFIX = "burst-update-manifest-v1\n";

	/**
	 * First Burst Pro release with a signed manifest. Older versions cannot be verified.
	 *
	 * @var string
	 */
	public const FIRST_SIGNED_VERSION = '3.7.5';

	/**
	 * Trusted public keys for update verification: key_id => base64 Ed25519 public key.
	 * No filter, option, or remote source may add to or override this list.
	 *
	 * @var array<string, string>
	 */
	public const PUBLIC_KEYS = [
		'burst-2026-a' => 'jNYIKUkZxor2fZrS1DXlQnyCFiB/YfimIay3dH0maHY=',
		'burst-2026-b' => 'xy+zlV2ZDeks+efV33UT7yU2fiUhffI7tXQK6jyIkyg=',
	];

	/**
	 * Active public keys map for this verifier instance.
	 *
	 * @var array<string, string>
	 */
	private array $public_keys;

	/**
	 * Constructor.
	 *
	 * @param array<string, string>|null $public_keys Optional key map for tests. Defaults to self::PUBLIC_KEYS.
	 */
	public function __construct( ?array $public_keys = null ) {
		$this->public_keys = null !== $public_keys ? $public_keys : self::PUBLIC_KEYS;
	}

	/**
	 * Create the verifier used for update and auto-installer packages.
	 *
	 * The burst_package_verifier filter lets tests inject a verifier with test keys. Anything that is
	 * not a Package_Verifier falls back to the default verifier with the bundled public keys.
	 */
	public static function create(): Package_Verifier {
		$verifier = apply_filters( 'burst_package_verifier', new self() );
		return $verifier instanceof self ? $verifier : new self();
	}

	/**
	 * Fetch the signature manifest for a downloaded package and verify the package against it.
	 *
	 * Side effect: deletes the downloaded file when verification fails, so a rejected package is not left in the temp directory.
	 *
	 * @param string $zip_path          Absolute path to the downloaded zip file.
	 * @param string $expected_version  Expected version string offered by the updater.
	 * @param string $installed_version Currently installed version string, for the anti-downgrade check.
	 * @param bool   $allow_beta        Whether packages from the beta channel are allowed.
	 * @return bool|\WP_Error True when the package is verified, WP_Error explaining the failure otherwise.
	 */
	public function verify_downloaded_package( string $zip_path, string $expected_version, string $installed_version = '', bool $allow_beta = false ): bool|\WP_Error {
		$signature_data = $this->fetch_signature( $expected_version );
		$result         = is_wp_error( $signature_data ) ? $signature_data : $this->verify( $zip_path, $signature_data, $expected_version, $installed_version, $allow_beta );

		if ( is_wp_error( $result ) ) {
			wp_delete_file( $zip_path );
			return $result;
		}

		return true;
	}

	/**
	 * Fetch the signature envelope for a given version from the licensing server.
	 *
	 * @param string $version    The version string, e.g. '3.7.5'.
	 * @param string $server_url Optional server URL. If empty, uses the burst_licensing_server_url filter.
	 * @return array<string, mixed>|\WP_Error Parsed JSON envelope on success, WP_Error on failure.
	 */
	public function fetch_signature( string $version, string $server_url = '' ): array|\WP_Error {
		$servers = [];
		if ( '' !== $server_url ) {
			$servers[] = $server_url;
		} else {
			/**
			 * Filter the licensing server URL used to retrieve update signatures.
			 *
			 * @param string $url Default licensing server URL.
			 */
			$filtered_url = (string) apply_filters( 'burst_licensing_server_url', 'https://license.burst-statistics.com' );
			if ( '' !== $filtered_url ) {
				$servers[] = $filtered_url;
			}
		}

		// Fallback servers: the downloads CDN that serves the signed manifests, and the independent fallback relay.
		$fallbacks = [
			'https://downloads.burst-statistics.com',
			'https://burst-licensing.com',
		];
		foreach ( $fallbacks as $fallback ) {
			if ( ! in_array( $fallback, $servers, true ) ) {
				$servers[] = $fallback;
			}
		}

		$version_path = rawurlencode( $version );
		$last_error   = null;

		foreach ( $servers as $server ) {
			$endpoint = trailingslashit( $server ) . 'signatures/burst-pro/' . $version_path . '.json';

			$response = wp_remote_get(
				$endpoint,
				[
					'timeout'   => 15,
					'sslverify' => true,
				]
			);

			if ( is_wp_error( $response ) ) {
				$last_error = $response;
				continue;
			}

			$response_code = (int) wp_remote_retrieve_response_code( $response );
			if ( 200 !== $response_code ) {
				$last_error = new \WP_Error(
					'burst_signature_fetch_failed',
					sprintf(
						/* translators: %d: HTTP response code */
						__( 'Could not fetch signature manifest (HTTP %d).', 'burst-statistics' ),
						$response_code
					)
				);
				continue;
			}

			$body = wp_remote_retrieve_body( $response );
			/**
			 * Decoded JSON payload from server.
			 *
			 * @var mixed $data Explained: json_decode returns mixed depending on input JSON.
			 */
			$data = json_decode( $body, true );
			// A cached page or WAF page can answer 200 with HTML; try the next server instead of giving up.
			if ( ! is_array( $data ) ) {
				$last_error = new \WP_Error(
					'burst_signature_invalid_json',
					__( 'Signature manifest response was not valid JSON.', 'burst-statistics' )
				);
				continue;
			}

			return $data;
		}

		return null !== $last_error ? $last_error : new \WP_Error(
			'burst_signature_fetch_failed',
			__( 'Could not fetch signature manifest from any server.', 'burst-statistics' )
		);
	}

	/**
	 * Verify an update zip package against a signature manifest.
	 *
	 * @param string               $zip_path          Absolute path to the downloaded zip file.
	 * @param array<string, mixed> $signature_data    Decoded envelope containing base64 manifest and signature.
	 * @param string               $expected_version  Expected version string offered by updater.
	 * @param string               $installed_version Currently installed version string, for anti-downgrade check.
	 * @param bool                 $allow_beta        Whether packages from the beta channel are allowed.
	 * @return bool|\WP_Error True on success, WP_Error explaining verification failure.
	 */
	public function verify( string $zip_path, array $signature_data, string $expected_version, string $installed_version = '', bool $allow_beta = false ): bool|\WP_Error {
		// 1. Envelope format and base64 decoding.
		if ( empty( $signature_data['manifest'] ) || ! is_string( $signature_data['manifest'] ) || empty( $signature_data['signature'] ) || ! is_string( $signature_data['signature'] ) ) {
			return new \WP_Error(
				'burst_signature_missing_envelope',
				__( 'Signature data is missing manifest or signature envelope.', 'burst-statistics' )
			);
		}

		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		$manifest_raw = base64_decode( $signature_data['manifest'], true );
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		$signature_raw = base64_decode( $signature_data['signature'], true );

		if ( false === $manifest_raw || false === $signature_raw ) {
			return new \WP_Error(
				'burst_signature_invalid_base64',
				__( 'Manifest or signature could not be base64-decoded.', 'burst-statistics' )
			);
		}

		// 2. Decode manifest JSON.
		/**
		 * Decoded manifest array.
		 *
		 * @var mixed $manifest Explained: json_decode returns mixed depending on input JSON.
		 */
		$manifest = json_decode( $manifest_raw, true );
		if ( ! is_array( $manifest ) ) {
			return new \WP_Error(
				'burst_manifest_invalid_json',
				__( 'Decoded manifest is not valid JSON.', 'burst-statistics' )
			);
		}

		// 3. Look up key_id in public keys list.
		$key_id = isset( $manifest['key_id'] ) && is_string( $manifest['key_id'] ) ? $manifest['key_id'] : '';
		if ( '' === $key_id || ! isset( $this->public_keys[ $key_id ] ) ) {
			return new \WP_Error(
				'burst_signature_unknown_key',
				__( 'Unknown signing key ID.', 'burst-statistics' )
			);
		}

		$public_key_b64 = $this->public_keys[ $key_id ];
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
		$public_key_raw = base64_decode( $public_key_b64, true );

		if ( false === $public_key_raw || strlen( $public_key_raw ) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES ) {
			return new \WP_Error(
				'burst_signature_invalid_public_key',
				__( 'Public key is invalid.', 'burst-statistics' )
			);
		}

		if ( strlen( $signature_raw ) !== SODIUM_CRYPTO_SIGN_BYTES ) {
			return new \WP_Error(
				'burst_signature_invalid',
				__( 'Package signature verification failed.', 'burst-statistics' )
			);
		}

		// 4. Verify Ed25519 signature over exact manifest bytes with prefix.
		$signed_payload = self::SIGNATURE_PREFIX . $manifest_raw;
		try {
			$verified = sodium_crypto_sign_verify_detached( $signature_raw, $signed_payload, $public_key_raw );
		} catch ( \SodiumException $e ) {
			$verified = false;
		}

		if ( ! $verified ) {
			return new \WP_Error(
				'burst_signature_invalid',
				__( 'Package signature verification failed.', 'burst-statistics' )
			);
		}

		// 5. Validate manifest fields.
		if ( ! isset( $manifest['format'] ) || (int) $manifest['format'] !== self::FORMAT_VERSION ) {
			return new \WP_Error(
				'burst_manifest_unsupported_format',
				__( 'Unsupported manifest format version.', 'burst-statistics' )
			);
		}

		if ( ! isset( $manifest['product'] ) || self::PRODUCT_NAME !== $manifest['product'] ) {
			return new \WP_Error(
				'burst_manifest_unsupported_product',
				__( 'Manifest product does not match Burst Pro.', 'burst-statistics' )
			);
		}

		$channel = isset( $manifest['channel'] ) && is_string( $manifest['channel'] ) ? $manifest['channel'] : '';
		if ( 'beta' === $channel ) {
			if ( ! $allow_beta ) {
				return new \WP_Error(
					'burst_manifest_channel_not_allowed',
					__( 'Beta channel package not allowed on this site.', 'burst-statistics' )
				);
			}
		} elseif ( 'stable' !== $channel ) {
			return new \WP_Error(
				'burst_manifest_unknown_channel',
				__( 'Manifest channel is not supported.', 'burst-statistics' )
			);
		}

		$manifest_version = isset( $manifest['version'] ) && is_string( $manifest['version'] ) ? $manifest['version'] : '';
		if ( '' === $manifest_version ) {
			return new \WP_Error(
				'burst_manifest_invalid_version',
				__( 'Manifest version is missing.', 'burst-statistics' )
			);
		}

		if ( $manifest_version !== $expected_version ) {
			return new \WP_Error(
				'burst_manifest_version_mismatch',
				sprintf(
					/* translators: 1: manifest version, 2: expected version */
					__( 'Manifest version %1$s does not match expected version %2$s.', 'burst-statistics' ),
					$manifest_version,
					$expected_version
				)
			);
		}

		if ( '' !== $installed_version && version_compare( $manifest_version, $installed_version, '<=' ) ) {
			return new \WP_Error(
				'burst_manifest_version_downgrade',
				sprintf(
					/* translators: 1: manifest version, 2: installed version */
					__( 'Manifest version %1$s is not newer than installed version %2$s.', 'burst-statistics' ),
					$manifest_version,
					$installed_version
				)
			);
		}

		// 6. Check downloaded zip file existence, size, and SHA-256 hash.
		if ( ! file_exists( $zip_path ) || ! is_readable( $zip_path ) ) {
			return new \WP_Error(
				'burst_package_file_missing',
				__( 'Downloaded package file not found.', 'burst-statistics' )
			);
		}

		$expected_size = isset( $manifest['size'] ) ? (int) $manifest['size'] : 0;
		if ( 0 === $expected_size && isset( $manifest['package']['size'] ) ) {
			$expected_size = (int) $manifest['package']['size'];
		}
		$actual_size = (int) filesize( $zip_path );
		if ( $actual_size !== $expected_size ) {
			return new \WP_Error(
				'burst_package_size_mismatch',
				sprintf(
					/* translators: 1: expected size in bytes, 2: actual size in bytes */
					__( 'Package size mismatch: expected %1$d bytes, got %2$d bytes.', 'burst-statistics' ),
					$expected_size,
					$actual_size
				)
			);
		}

		$expected_sha256 = isset( $manifest['sha256'] ) && is_string( $manifest['sha256'] ) ? $manifest['sha256'] : '';
		if ( '' === $expected_sha256 && isset( $manifest['package']['sha256'] ) && is_string( $manifest['package']['sha256'] ) ) {
			$expected_sha256 = $manifest['package']['sha256'];
		}
		$actual_sha256 = hash_file( 'sha256', $zip_path );
		if ( false === $actual_sha256 || ! hash_equals( strtolower( $expected_sha256 ), strtolower( $actual_sha256 ) ) ) {
			return new \WP_Error(
				'burst_package_hash_mismatch',
				__( 'Package SHA-256 hash mismatch.', 'burst-statistics' )
			);
		}

		return true;
	}
}
