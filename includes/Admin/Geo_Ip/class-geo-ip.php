<?php
namespace Burst\Admin\Geo_Ip;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die();

/**
 * Core Geo_Ip.
 *
 * Downloads and maintains the MaxMind GeoLite2 Country database. Shared with the
 * free plugin so country tracking works without Pro. The country database is
 * refreshed once per month and that cadence is deliberately not filterable. Pro
 * extends this class (Geo_Ip_Pro) to use the City database at a higher frequency.
 *
 * http://geolite.maxmind.com/download/geoip/database/GeoLite2-Country.tar.gz
 */
class Geo_Ip {
	use Helper;
	use Admin_Helper;

	protected string $download_url = 'https://burst.ams3.cdn.digitaloceanspaces.com/maxmind/';
	protected string $db_name      = 'GeoLite2-Country.tar.gz';
	protected string $db_url;

	/**
	 * Hook into WordPress.
	 */
	public function init(): void {
		$this->db_url = $this->download_url . $this->db_name;
		add_action( 'admin_init', [ $this, 'initialize' ] );
		add_action( 'burst_daily', [ $this, 'cron_check_geo_ip_db' ] );
		add_filter( 'burst_tasks', [ $this, 'add_burst_geo_ip_import_error' ], 10, 1 );
	}

	/**
	 * How often the database is refreshed, in seconds. Country = monthly.
	 *
	 * Intentionally a method, not a filter: the free refresh cadence cannot be
	 * altered through hooks. Pro overrides this for the City database.
	 */
	protected function refresh_interval(): int {
		return MONTH_IN_SECONDS;
	}

	/**
	 * Whether the on-disk database must be re-downloaded because it does not match
	 * the expected variant. Country (core) never needs to swap; Pro overrides this
	 * to force a City download when only the Country database is present.
	 *
	 * @param string $file_name The current database file path.
	 */
	protected function should_force_redownload( string $file_name ): bool {
		unset( $file_name );
		return false;
	}

	/**
	 * Check if the geo ip database should be updated.
	 *
	 * @hooked burst_daily
	 */
	public function cron_check_geo_ip_db(): void {
		if ( ! apply_filters( 'burst_geo_ip_enabled', true ) ) {
			return;
		}

		$last_update = (int) get_option( 'burst_last_update_geo_ip', 0 );
		$time_passed = time() - $last_update;
		$file_name   = (string) get_option( 'burst_geo_ip_file', '' );
		$force       = (bool) get_option( 'burst_import_geo_ip_on_activation' )
			|| '' === $file_name
			|| ! file_exists( $file_name )
			|| $this->should_force_redownload( $file_name );

		// If the file was never downloaded, or older than the refresh interval, redownload.
		if ( $force || 0 === $last_update || $time_passed > $this->refresh_interval() ) {
			if ( $this->get_geo_ip_database_file( true ) ) {
				update_option( 'burst_import_geo_ip_on_activation', false, false );
			}
		}
	}

	/**
	 * Retrieve the SHA-256 hash published beside the database archive.
	 *
	 * @return string|null The normalized hash, or null when unavailable or malformed.
	 */
	private function get_remote_database_hash(): ?string {
		$response = wp_remote_get( $this->db_url . '.sha256', [ 'timeout' => 25 ] );
		if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) < 200 || wp_remote_retrieve_response_code( $response ) >= 300 ) {
			return null;
		}

		$body = trim( wp_remote_retrieve_body( $response ) );
		if ( 1 !== preg_match( '/^([a-f0-9]{64})/i', $body, $matches ) ) {
			return null;
		}

		return strtolower( $matches[1] );
	}

	/**
	 * Get the delay before another failed import may be retried.
	 *
	 * @param int $failed_attempts Number of consecutive failed attempts.
	 */
	private function get_import_retry_delay( int $failed_attempts ): int {
		$delays = [
			5 * MINUTE_IN_SECONDS,
			HOUR_IN_SECONDS,
			6 * HOUR_IN_SECONDS,
			DAY_IN_SECONDS,
			3 * DAY_IN_SECONDS,
			7 * DAY_IN_SECONDS,
		];
		$index  = min( max( 0, $failed_attempts - 1 ), count( $delays ) - 1 );

		return $delays[ $index ];
	}

	/**
	 * Record a failed GeoIP import for retry backoff.
	 */
	private function record_import_failure(): void {
		$failed_attempts = (int) get_option( 'burst_geo_ip_failed_attempts', 0 );
		if ( 0 === $failed_attempts ) {
			update_option( 'burst_geo_ip_first_failed_attempt', time(), false );
		}
		update_option( 'burst_geo_ip_failed_attempts', $failed_attempts + 1, false );
		update_option( 'burst_geo_ip_last_failed_attempt', time(), false );
	}

	/**
	 * Reset the GeoIP import retry backoff after recovery.
	 */
	private function clear_import_failures(): void {
		delete_option( 'burst_geo_ip_failed_attempts' );
		delete_option( 'burst_geo_ip_first_failed_attempt' );
		delete_option( 'burst_geo_ip_last_failed_attempt' );
	}

	/**
	 * Initialize the geo ip library.
	 *
	 * @since 1.2
	 */
	public function initialize(): void {
		if ( ! apply_filters( 'burst_geo_ip_enabled', true ) ) {
			return;
		}

		if ( $this->has_admin_access() && get_option( 'burst_import_geo_ip_on_activation' ) ) {
			if ( $this->get_geo_ip_database_file( true ) ) {
				update_option( 'burst_import_geo_ip_on_activation', false, false );
			}
		}

		$file_name = get_option( 'burst_geo_ip_file' );
		if ( ! $file_name ) {
			return;
		}

		// Pro forces a re-download when the on-disk database is the wrong variant
		// (e.g. only the Country database is present but City is required).
		if ( $this->should_force_redownload( (string) $file_name ) ) {
			$this->get_geo_ip_database_file( true );
		}

		// If manually uploaded after an error was detected, the error can be removed now.
		// Compare against the first failure since the last success: later failed retries
		// would otherwise keep pushing the threshold past the manual upload's mtime.
		if ( ( $this->is_burst_page() || $this->is_logged_in_rest() ) && get_option( 'burst_geo_ip_import_error' ) ) {
			$file_name            = (string) get_option( 'burst_geo_ip_file', '' );
			$first_failed_attempt = (int) get_option( 'burst_geo_ip_first_failed_attempt', 0 );
			if ( 0 === $first_failed_attempt ) {
				$first_failed_attempt = (int) get_option( 'burst_geo_ip_last_failed_attempt', 0 );
			}
			$file_modified = file_exists( $file_name ) ? (int) filemtime( $file_name ) : 0;
			if ( file_exists( $file_name ) && ! $this->should_force_redownload( $file_name ) && ( 0 === $first_failed_attempt || $file_modified > $first_failed_attempt ) ) {
				delete_option( 'burst_geo_ip_import_error' );
				$this->clear_import_failures();
			}
		}
	}

	/**
	 * Retrieve the MaxMind geo ip database file. Pass $renew=true to force renewal of the file.
	 *
	 * @since 2.0.3
	 */
	private function get_geo_ip_database_file( bool $renew = false ): bool {
		if ( ! wp_doing_cron() && ! $this->user_can_manage() ) {
			return false;
		}

		if ( defined( 'BURST_DO_NOT_UPDATE_GEO_IP' ) && BURST_DO_NOT_UPDATE_GEO_IP ) {
			return false;
		}

		if ( get_transient( 'burst_importing' ) ) {
			return false;
		}
		// prevent more than one attempt every 5 minutes.
		$last_attempt     = (int) get_option( 'burst_geo_ip_last_attempt', 0 );
		$five_minutes_ago = time() - ( 5 * MINUTE_IN_SECONDS );
		if ( 0 !== $last_attempt && $last_attempt > $five_minutes_ago ) {
			return false;
		}

		$failed_attempts     = (int) get_option( 'burst_geo_ip_failed_attempts', 0 );
		$last_failed_attempt = (int) get_option( 'burst_geo_ip_last_failed_attempt', 0 );
		if ( 0 < $failed_attempts && 0 !== $last_failed_attempt && $last_failed_attempt > time() - $this->get_import_retry_delay( $failed_attempts ) ) {
			return false;
		}

		$file_name        = (string) get_option( 'burst_geo_ip_file', '' );
		$has_current_file = '' !== $file_name && file_exists( $file_name ) && ! $this->should_force_redownload( $file_name );
		$needs_download   = $renew || ! $has_current_file;
		$import_succeeded = ! $needs_download;
		// only run if it doesn't exist yet, or if it should renew.
		if ( $needs_download ) {
			set_transient( 'burst_importing', true, 5 * MINUTE_IN_SECONDS );
			$import_succeeded = false;
			update_option( 'burst_geo_ip_last_attempt', time(), false );

			$expected_hash    = $this->get_remote_database_hash();
			$stored_hash      = get_option( 'burst_geo_ip_db_hash', '' );
			$stored_file_hash = get_option( 'burst_geo_ip_file_hash', '' );

			// Only hash the on-disk database once the cheap conditions hold.
			if (
				$has_current_file
				&& null !== $expected_hash
				&& is_string( $stored_hash )
				&& hash_equals( $stored_hash, $expected_hash )
				&& is_string( $stored_file_hash )
				&& '' !== $stored_file_hash
			) {
				$current_file_hash = hash_file( 'sha256', $file_name );
				if ( is_string( $current_file_hash ) && hash_equals( $stored_file_hash, strtolower( $current_file_hash ) ) ) {
					if ( get_option( 'burst_geo_ip_import_error' ) ) {
						delete_option( 'burst_geo_ip_import_error' );
						// re-run the tasks validation to ensure that the geo ip warning is removed.
						\Burst\burst_loader()->admin->tasks->schedule_task_validation();
					}
					$this->clear_import_failures();
					update_option( 'burst_last_update_geo_ip', time(), false );
					delete_transient( 'burst_importing' );
					return true;
				}
			}

			global $wp_filesystem;

			if ( ! $wp_filesystem || ! is_a( $wp_filesystem, 'WP_Filesystem_Base' ) ) {
				require_once ABSPATH . '/wp-admin/includes/file.php';
				WP_Filesystem();
			}

			$upload_dir = $this->upload_dir( 'maxmind' );
			$name       = $this->db_name;

			$zip_file_name = apply_filters( 'burst_zip_file_path', $upload_dir . $name );

			$tar_file_name    = str_replace( '.gz', '', $zip_file_name );
			$result_file_name = str_replace( '.tar.gz', '.mmdb', $name );
			$unzipped         = $upload_dir . $result_file_name;

			// download file from maxmind.
			$tmpfile = download_url( $this->db_url, 25 );
			if ( ! $wp_filesystem->is_dir( $upload_dir ) ) {
				// try to create the directory.
				wp_mkdir_p( $upload_dir );
			}
			// check for errors.
			if ( ! $wp_filesystem->is_dir( $upload_dir ) ) {
				// store the error for use in the callback notice for geo ip.
				update_option( 'burst_geo_ip_import_error', __( 'Required directory does not exist:', 'burst-statistics' ) . ' ' . $upload_dir, false );
			} elseif ( $this->has_open_basedir_restriction( $zip_file_name ) ) {
				update_option( 'burst_geo_ip_import_error', 'Open Base dir restriction detected. Please upload manually.', false );
			} elseif ( is_wp_error( $tmpfile ) ) {
				// store the error for use in the callback notice for geo ip.
				update_option( 'burst_geo_ip_import_error', $tmpfile->get_error_message(), false );
			} else {
				$download_hash = hash_file( 'sha256', $tmpfile );

				if ( null !== $expected_hash && ( ! is_string( $download_hash ) || ! hash_equals( $expected_hash, strtolower( $download_hash ) ) ) ) {
					$verification_error = __( 'The downloaded GeoIP database failed SHA-256 verification. The existing database has been kept.', 'burst-statistics' );
					self::error_log( $verification_error );
					update_option( 'burst_geo_ip_import_error', $verification_error, false );
					$this->record_import_failure();
					wp_delete_file( $tmpfile );
					delete_transient( 'burst_importing' );
					return false;
				}

				// Extract tar.gz.
				$new_file         = str_replace( '.mmdb', '-new.mmdb', $unzipped );
				$new_file_renamed = str_replace( '.mmdb', '-new-renamed.mmdb', $unzipped );
				// Clean up any leftover temp files from a previous failed attempt.
				if ( $wp_filesystem->is_file( $new_file ) ) {
					wp_delete_file( $new_file );
				}
				if ( $wp_filesystem->is_file( $new_file_renamed ) ) {
					wp_delete_file( $new_file_renamed );
				}

				// Always extract the archive that was just verified.
				if ( $wp_filesystem->is_file( $zip_file_name ) ) {
					wp_delete_file( $zip_file_name );
				}
				if ( ! copy( $tmpfile, $zip_file_name ) ) {
					update_option( 'burst_geo_ip_import_error', __( 'The GeoIP database archive could not be copied for extraction.', 'burst-statistics' ), false );
					$this->record_import_failure();
					wp_delete_file( $tmpfile );
					delete_transient( 'burst_importing' );
					return false;
				}

				try {
					if ( class_exists( 'PharData' ) ) {
						// unzip the file.
						$p = new \PharData( $zip_file_name );
						if ( $wp_filesystem->is_file( $tar_file_name ) ) {
							wp_delete_file( $tar_file_name );
						}
						// creates tar file.
						$p->decompress();
						// unarchive from the tar.
						$phar = new \PharData( $tar_file_name );
						$phar->extractTo( $upload_dir, null, true );
					} else {
						update_option(
							'burst_geo_ip_import_error',
							__( 'The PHP Phar extension is not available on this server. Please enable the Phar extension or contact your hosting provider.', 'burst-statistics' ),
							false
						);
					}
				} catch ( \Throwable $e ) {
					// Catches both \Exception and \Error (e.g. missing extensions).
					update_option( 'burst_geo_ip_import_error', $e->getMessage(), false );
				}

				// now look up the uncompressed folder.
				foreach ( glob( $upload_dir . '*' ) as $file ) {
					if ( $wp_filesystem->is_dir( $file ) ) {
						$wp_filesystem->chmod( $file, 0755 );
						// copy our file to the maxmind folder.
						copy( trailingslashit( $file ) . $result_file_name, $new_file );

						// delete this one.
						wp_delete_file( trailingslashit( $file ) . $result_file_name );
						// clean up txt files.
						foreach ( glob( $file . '/*' ) as $txt_file ) {
							wp_delete_file( $txt_file );
						}
						// remove the directory.
						$wp_filesystem->rmdir( $file );
					}
				}

				// Verify the new file was created before touching the original.
				if ( $wp_filesystem->is_file( $new_file ) ) {
					// Test whether rename works on this filesystem by doing a trial rename.
					if ( $wp_filesystem->move( $new_file, $new_file_renamed ) ) {
						// Rename works: safely swap old file for the new one.
						if ( $wp_filesystem->is_file( $unzipped ) ) {
							wp_delete_file( $unzipped );
						}
						if ( $wp_filesystem->move( $new_file_renamed, $unzipped ) ) {
							update_option( 'burst_geo_ip_file', $unzipped );
							$import_succeeded = true;
						}
					} else {
						// Rename failed: leave the original in place and report the error.
						self::error_log( 'Renaming the GeoIP database did not produce the expected file. The existing database has been kept.' );
						wp_delete_file( $new_file );
					}
				} else {
					self::error_log( 'Extracting the GeoIP database did not produce the expected file. The existing database has been kept.' );
				}

				// clean up zip file.
				if ( $wp_filesystem->is_file( $zip_file_name ) ) {
					wp_delete_file( $zip_file_name );
				}

				// clean up tar file.
				if ( file_exists( $tar_file_name ) ) {
					wp_delete_file( $tar_file_name );
				}

				// if there was an error saved previously, remove it.
				if ( $import_succeeded ) {
					delete_option( 'burst_geo_ip_import_error' );
					// re-run the tasks validation to ensure that the geo ip warning is removed.
					\Burst\burst_loader()->admin->tasks->schedule_task_validation();
					if ( is_string( $download_hash ) ) {
						update_option( 'burst_geo_ip_db_hash', strtolower( $download_hash ), false );
					}
					$file_hash = hash_file( 'sha256', $unzipped );
					if ( is_string( $file_hash ) ) {
						update_option( 'burst_geo_ip_file_hash', strtolower( $file_hash ), false );
					} else {
						delete_option( 'burst_geo_ip_file_hash' );
					}
					$this->clear_import_failures();
					update_option( 'burst_last_update_geo_ip', time(), false );
				}
			}

			// Delete temp file.
			if ( is_string( $tmpfile ) && file_exists( $tmpfile ) ) {
				wp_delete_file( $tmpfile );
			}
			delete_transient( 'burst_importing' );
			if ( ! $import_succeeded ) {
				$this->record_import_failure();
			}
		}

		return $import_succeeded;
	}

	/**
	 * Add geo ip database error to tasks list
	 *
	 * @param array $notices Existing notices.
	 * @return array<int, array{ id: string, condition: array<string, string>, msg: string, icon: string, url: string, dismissible: bool, plusone: bool }>
	 */
	public function add_burst_geo_ip_import_error( array $notices ): array {
		// if the plugin was activated only just now, don't show the notice yet. Maybe it's still downloading.
		if ( get_transient( 'burst_recently_activated' ) ) {
			return $notices;
		}

		// A refresh failure with a working database on disk needs different wording:
		// tracking still works with the previous database in that case.
		$file_name    = (string) get_option( 'burst_geo_ip_file', '' );
		$has_database = '' !== $file_name && file_exists( $file_name );
		$intro        = $has_database
			? __( 'The GEO IP database could not be updated. The previously downloaded database is still being used.', 'burst-statistics' )
			: __( "The GEO IP database hasn't been downloaded yet. It is necessary for tracking country information.", 'burst-statistics' );

		$notices[] = [
			'id'          => 'burst_geo_ip_import_error',
			'condition'   => [
				'type'     => 'serverside',
				'function' => 'wp_option_burst_geo_ip_import_error',
			],
			'msg'         => $intro .
							// translators: %s is the actual error message returned from the failed GEO IP import.
							' ' . $this->sprintf( __( 'The following error was reported: %s', 'burst-statistics' ), get_option( 'burst_geo_ip_import_error' ) ),
			'icon'        => 'warning',
			'url'         => 'instructions/geo-ip-error/',
			'dismissible' => true,
			'plusone'     => true,
		];

		return $notices;
	}
}
