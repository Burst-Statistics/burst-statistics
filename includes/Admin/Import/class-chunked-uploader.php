<?php
namespace Burst\Admin\Import;

use Burst\Traits\Admin_Helper;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || die();

/**
 * Class Chunked_Uploader
 *
 * Manages chunked multi-part uploads with sandboxed isolation and security verification.
 */
class Chunked_Uploader {
	use Admin_Helper;

	/**
	 * Register REST routes for chunked upload pipeline.
	 */
	public function register_rest_routes(): void {
		$permission_callback = function (): bool {
			return $this->user_can_manage();
		};

		register_rest_route(
			'burst/v1',
			'/import/upload/init',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'rest_upload_init' ],
				'permission_callback' => $permission_callback,
			]
		);

		register_rest_route(
			'burst/v1',
			'/import/upload/chunk',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'rest_upload_chunk' ],
				'permission_callback' => $permission_callback,
			]
		);

		register_rest_route(
			'burst/v1',
			'/import/upload/finalize',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'rest_upload_finalize' ],
				'permission_callback' => $permission_callback,
			]
		);
	}


	/**
	 * File extensions an import upload may have: the single allowlist behind
	 * the upload endpoints and Import_Manager::start_import(). A '.sql.gz'
	 * name is reported as 'sql.gz' by file_extension(); the bare 'gz' covers a
	 * gzip export without the '.sql' part.
	 *
	 * @var string[]
	 */
	public const ALLOWED_EXTENSIONS = [ 'csv', 'sql', 'gz', 'sql.gz', 'zip', 'json', 'ndjson' ];

	/**
	 * The extension of a filename as the allowlist spells it, lower-case;
	 * '.sql.gz' resolves to 'sql.gz'.
	 */
	public static function file_extension( string $filename ): string {
		$ext = strtolower( pathinfo( $filename, PATHINFO_EXTENSION ) );
		if ( 'gz' === $ext && str_ends_with( strtolower( $filename ), '.sql.gz' ) ) {
			$ext = 'sql.gz';
		}
		return $ext;
	}

	/**
	 * Whether a filename has an extension the importer accepts. Checked before
	 * an upload session is created and again before the chunks are assembled,
	 * so nothing but an import file is ever written to the sandbox.
	 */
	public static function is_allowed_file( string $filename ): bool {
		return in_array( self::file_extension( $filename ), self::ALLOWED_EXTENSIONS, true );
	}

	/**
	 * Whether a string is a well-formed upload id: exactly 32 lower-case hex
	 * characters, the shape random_token() produces. The single gate every
	 * caller runs before an upload id reaches the filesystem, so a 32-character
	 * string of other characters can never be mapped onto a sandbox path.
	 */
	public static function is_valid_upload_id( string $upload_id ): bool {
		return 1 === preg_match( '/^[a-f0-9]{32}$/', $upload_id );
	}

	/**
	 * Get (and create) the base import sandbox upload directory. Created and
	 * hardened by the shared Helper::upload_dir(), like the sandboxes below it.
	 *
	 * @return string Absolute path to uploads/burst/import (no trailing slash).
	 */
	public function get_base_upload_dir(): string {
		return rtrim( $this->upload_dir( 'import' ), '/' );
	}

	/**
	 * Get (and create) the sandbox upload directory for a given upload ID.
	 *
	 * Delegates to the shared Helper::upload_dir() which creates the directory,
	 * hardens it with index.php and .htaccess and honours the burst_upload_dir
	 * filter. Because it creates, only rest_upload_init() and the tests that
	 * seed a sandbox use it; reads go through sandbox_path().
	 *
	 * Callers validate the id with is_valid_upload_id() first; the
	 * normalisation here is a last line of defence that keeps the path inside
	 * the import directory, not a substitute for that check (a stripped id
	 * would silently point at a different, shorter sandbox name).
	 *
	 * @param string $upload_id 32-hex upload identifier, already validated.
	 * @return string Absolute directory path (no trailing slash).
	 */
	public function get_upload_dir( string $upload_id ): string {
		$clean_id = preg_replace( '/[^a-f0-9]/', '', strtolower( $upload_id ) );
		// upload_dir() returns a trailing-slashed path; strip it for consistency with callers.
		return rtrim( $this->upload_dir( 'import/' . $clean_id ), '/' );
	}

	/**
	 * The sandbox path of a validated upload id without creating anything on
	 * disk, so a request for an unknown id leaves no directory behind.
	 *
	 * @param string $upload_id 32-hex upload identifier, already validated.
	 * @return string Absolute directory path (no trailing slash).
	 */
	private function sandbox_path( string $upload_id ): string {
		return $this->get_base_upload_dir() . '/' . $upload_id;
	}

	/**
	 * Initialize upload session.
	 *
	 * Purges any pre-existing import sandboxes before creating the new one,
	 * enforcing a single-active-upload-file policy so the import directory
	 * never accumulates stale uploads.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public function rest_upload_init( WP_REST_Request $request ): WP_REST_Response {
		$params   = $request->get_json_params() ?: [];
		$filename = sanitize_file_name( (string) ( $params['filename'] ?? 'export.csv' ) );
		$filesize = (int) ( $params['filesize'] ?? 0 );
		$chunks   = (int) ( $params['total_chunks'] ?? 1 );

		if ( ! self::is_allowed_file( $filename ) ) {
			return new WP_REST_Response( [ 'error' => __( 'File format not supported for analytics import.', 'burst-statistics' ) ], 400 );
		}

		// Enforce single-file policy: remove all pre-existing upload sandboxes.
		$this->purge_all_upload_sandboxes();

		$upload_id = $this->random_token();

		$sandbox_dir = $this->get_upload_dir( $upload_id );
		$meta_file   = $sandbox_dir . '/upload_meta.json';

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		file_put_contents(
			$meta_file,
			wp_json_encode(
				[
					'upload_id'    => $upload_id,
					'filename'     => $filename,
					'filesize'     => $filesize,
					'total_chunks' => $chunks,
					'created_at'   => time(),
				]
			)
		);

		return new WP_REST_Response(
			[
				'success'    => true,
				'upload_id'  => $upload_id,
				'chunk_size' => 4 * 1024 * 1024, // 4MB chunks
			],
			200
		);
	}

	/**
	 * Ingest a single uploaded chunk.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public function rest_upload_chunk( WP_REST_Request $request ): WP_REST_Response {
		$upload_id   = sanitize_text_field( (string) $request->get_param( 'upload_id' ) );
		$chunk_index = (int) $request->get_param( 'chunk_index' );

		if ( ! self::is_valid_upload_id( $upload_id ) ) {
			return new WP_REST_Response( [ 'error' => __( 'Invalid upload ID.', 'burst-statistics' ) ], 400 );
		}

		$sandbox_dir = $this->sandbox_path( $upload_id );

		// Only a session created by rest_upload_init() may receive chunks; without
		// this, any valid-looking id would create a fresh sandbox on disk.
		if ( ! file_exists( $sandbox_dir . '/upload_meta.json' ) ) {
			return new WP_REST_Response( [ 'error' => __( 'Upload session expired or invalid.', 'burst-statistics' ) ], 400 );
		}

		$files = $request->get_file_params();

		if ( empty( $files['file']['tmp_name'] ) ) {
			return new WP_REST_Response( [ 'error' => __( 'Missing chunk file data.', 'burst-statistics' ) ], 400 );
		}

		$chunk_file = $sandbox_dir . '/chunk_' . sprintf( '%05d', $chunk_index ) . '.part';
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_move_uploaded_file
		$moved = move_uploaded_file( $files['file']['tmp_name'], $chunk_file );

		if ( ! $moved && ! is_uploaded_file( $files['file']['tmp_name'] ) && file_exists( $files['file']['tmp_name'] ) ) {
			// Fallback exclusively for CLI and test runners where files are not HTTP-uploaded.
			// This must never run in a standard web request — is_uploaded_file() exists to reject exactly this.
			$is_cli      = defined( 'WP_CLI' ) && WP_CLI;
			$is_test_env = ( defined( 'BURST_TEST_ENV' ) && BURST_TEST_ENV ) || defined( 'DIR_TESTDATA' );
			if ( $is_cli || $is_test_env ) {
				// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_copy
				$moved = copy( $files['file']['tmp_name'], $chunk_file );
				if ( $moved ) {
					wp_delete_file( $files['file']['tmp_name'] );
				}
			}
		}

		if ( ! $moved ) {
			return new WP_REST_Response( [ 'error' => __( 'Failed to save chunk to disk.', 'burst-statistics' ) ], 500 );
		}

		return new WP_REST_Response(
			[
				'success'     => true,
				'chunk_index' => $chunk_index,
			],
			200
		);
	}

	/**
	 * Finalize upload session: assemble chunks and validate payload.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public function rest_upload_finalize( WP_REST_Request $request ): WP_REST_Response {
		$params    = $request->get_json_params() ?: [];
		$upload_id = sanitize_text_field( (string) ( $params['upload_id'] ?? '' ) );

		if ( ! self::is_valid_upload_id( $upload_id ) ) {
			return new WP_REST_Response( [ 'error' => __( 'Invalid upload ID.', 'burst-statistics' ) ], 400 );
		}

		$sandbox_dir = $this->sandbox_path( $upload_id );
		$meta_file   = $sandbox_dir . '/upload_meta.json';

		if ( ! file_exists( $meta_file ) ) {
			return new WP_REST_Response( [ 'error' => __( 'Upload session expired or invalid.', 'burst-statistics' ) ], 400 );
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$meta     = json_decode( (string) file_get_contents( $meta_file ), true ) ?: [];
		$filename = sanitize_file_name( (string) ( $meta['filename'] ?? '' ) );
		if ( ! self::is_allowed_file( $filename ) ) {
			$this->cleanup_upload( $upload_id );
			return new WP_REST_Response( [ 'error' => __( 'File format not supported for analytics import.', 'burst-statistics' ) ], 400 );
		}
		$target_file = $sandbox_dir . '/' . $filename;

		// Assemble chunks into final file.
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		$out_handle = fopen( $target_file, 'wb' );
		if ( false === $out_handle ) {
			return new WP_REST_Response( [ 'error' => __( 'Failed to create target file on server.', 'burst-statistics' ) ], 500 );
		}

		$total_chunks = (int) ( $meta['total_chunks'] ?? 1 );

		for ( $i = 0; $i < $total_chunks; $i++ ) {
			$chunk_path = $sandbox_dir . '/chunk_' . sprintf( '%05d', $i ) . '.part';
			if ( ! file_exists( $chunk_path ) ) {
				// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
				fclose( $out_handle );
				/* translators: %d: chunk index */
				return new WP_REST_Response( [ 'error' => sprintf( __( 'Missing chunk #%d.', 'burst-statistics' ), $i ) ], 400 );
			}
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
			$in_handle = fopen( $chunk_path, 'rb' );
			if ( false === $in_handle ) {
				// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
				fclose( $out_handle );
				/* translators: %d: chunk index */
				return new WP_REST_Response( [ 'error' => sprintf( __( 'Failed to read chunk #%d.', 'burst-statistics' ), $i ) ], 500 );
			}
			while ( ! feof( $in_handle ) ) {
				// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite, WordPress.WP.AlternativeFunctions.file_system_operations_fread
				fwrite( $out_handle, fread( $in_handle, 65536 ) );
			}
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
			fclose( $in_handle );
			wp_delete_file( $chunk_path );
		}
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		fclose( $out_handle );

		$file_hash = hash_file( 'sha256', $target_file );
		if ( false !== $file_hash ) {
			global $wpdb;
			( new Import_Manager() )->maybe_update_schema();
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$existing = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT id, created_at FROM {$wpdb->prefix}burst_imports WHERE file_hash = %s AND status IN ('processing', 'completed') ORDER BY id DESC LIMIT 1",
					$file_hash
				),
				ARRAY_A
			);

			if ( ! empty( $existing ) ) {
				$this->cleanup_upload( $upload_id );
				$import_date = date_i18n( get_option( 'date_format', 'Y-m-d' ), (int) $existing['created_at'] );
				return new WP_REST_Response(
					[
						'error' => sprintf(
							/* translators: 1: Import ID, 2: Import date */
							__( 'This file has already been imported (Import #%1$d on %2$s). Duplicate file imports are not allowed to prevent duplicate data.', 'burst-statistics' ),
							(int) $existing['id'],
							$import_date
						),
					],
					400
				);
			}
		}

		return new WP_REST_Response(
			[
				'success'   => true,
				'upload_id' => $upload_id,
				'file_path' => $upload_id,
				'filename'  => basename( $target_file ),
				'filesize'  => filesize( $target_file ),
			],
			200
		);
	}

	/**
	 * Clean up and remove the sandbox directory for an upload ID.
	 *
	 * @param string $upload_id 32-hex upload identifier.
	 */
	public function cleanup_upload( string $upload_id ): void {
		if ( ! self::is_valid_upload_id( $upload_id ) ) {
			return;
		}
		$this->delete_sandbox( $this->sandbox_path( $upload_id ) );
	}

	/**
	 * Purge stale upload sandboxes under the base import directory.
	 *
	 * Enforces the single-file-upload policy: when a new upload session is
	 * initiated, leftover sandbox directories from previous (possibly
	 * incomplete) uploads are deleted. Only subdirectories whose names consist
	 * entirely of hex characters are treated as sandboxes to avoid accidentally
	 * removing unrelated directories, and a sandbox a running import still
	 * reads from is kept: deleting it would fail that import mid-way.
	 */
	private function purge_all_upload_sandboxes(): void {
		$base_dir = realpath( rtrim( $this->upload_dir( 'import' ), '/' ) );
		if ( ! $base_dir || ! is_dir( $base_dir ) ) {
			return;
		}

		$entries = @scandir( $base_dir ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		if ( ! is_array( $entries ) ) {
			return;
		}

		$in_use = $this->sandboxes_in_use();
		foreach ( $entries as $entry ) {
			// Only process 32-char hex directory names (valid upload_id sandboxes).
			if ( preg_match( '/^[a-f0-9]{32}$/', $entry ) && ! isset( $in_use[ $entry ] ) ) {
				$this->delete_sandbox( $base_dir . DIRECTORY_SEPARATOR . $entry );
			}
		}
	}

	/**
	 * The sandbox ids a running import still reads from: the upload file and
	 * the uncompressed working file of every `processing` row in burst_imports
	 * both live in that upload's sandbox (see Import_Manager::start_import()).
	 *
	 * @return array<string, true> Keyed by 32-hex sandbox id.
	 */
	private function sandboxes_in_use(): array {
		global $wpdb;
		$in_use = [];

		// The table is created on the first import; before that there is nothing in use.
		$suppress = $wpdb->suppress_errors();
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_col( "SELECT settings FROM {$wpdb->prefix}burst_imports WHERE status = 'processing'" );
		$wpdb->suppress_errors( $suppress );

		foreach ( (array) $rows as $json ) {
			$settings = json_decode( (string) $json, true );
			if ( ! is_array( $settings ) ) {
				continue;
			}
			foreach ( [ 'file_path', 'working_file' ] as $key ) {
				$path = (string) ( $settings[ $key ] ?? '' );
				if ( '' === $path ) {
					continue;
				}
				$sandbox = basename( dirname( $path ) );
				if ( preg_match( '/^[a-f0-9]{32}$/', $sandbox ) ) {
					$in_use[ $sandbox ] = true;
				}
			}
		}

		return $in_use;
	}

	/**
	 * Delete a sandbox directory with everything in it, including the
	 * sub-directories the adapters extract archives into (plausible_unpacked,
	 * burst_extracted_{id}), which a flat file delete left behind. Confined to
	 * the import base directory: anything that resolves outside it, or to the
	 * base directory itself, is left alone.
	 *
	 * @param string $sandbox_dir Sandbox directory path.
	 */
	private function delete_sandbox( string $sandbox_dir ): void {
		$base_dir = realpath( rtrim( $this->upload_dir( 'import' ), '/' ) );
		$real_dir = realpath( $sandbox_dir );

		if ( ! $real_dir || ! $base_dir || $real_dir === $base_dir || ! str_starts_with( $real_dir, $base_dir . DIRECTORY_SEPARATOR ) || ! is_dir( $real_dir ) ) {
			return;
		}

		$this->delete_directory( $real_dir );
	}

	/**
	 * Recursively delete a directory. Symlinks are removed as links, never
	 * followed, so a link inside a sandbox cannot reach outside it.
	 *
	 * @param string $dir Directory path, already confined by the caller.
	 */
	private function delete_directory( string $dir ): void {
		$entries = @scandir( $dir ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		if ( ! is_array( $entries ) ) {
			return;
		}

		foreach ( $entries as $entry ) {
			if ( '.' === $entry || '..' === $entry ) {
				continue;
			}
			$path = $dir . DIRECTORY_SEPARATOR . $entry;
			if ( is_dir( $path ) && ! is_link( $path ) ) {
				$this->delete_directory( $path );
			} else {
				wp_delete_file( $path );
			}
		}

		@rmdir( $dir ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir, WordPress.PHP.NoSilencedErrors.Discouraged
	}
}
