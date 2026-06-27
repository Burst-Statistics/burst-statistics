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
 * refreshed once per year and that cadence is deliberately not filterable. Pro
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
	 * How often the database is refreshed, in seconds. Country = yearly.
	 *
	 * Intentionally a method, not a filter: the free refresh cadence cannot be
	 * altered through hooks. Pro overrides this for the City database.
	 */
	protected function refresh_interval(): int {
		return YEAR_IN_SECONDS;
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

		$last_update = get_option( 'burst_last_update_geo_ip' );
		$time_passed = time() - (int) $last_update;

		// If the file was never downloaded, or older than the refresh interval, redownload.
		if ( ! $last_update || $time_passed > $this->refresh_interval() ) {
			$this->get_geo_ip_database_file( true );
		}
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
			$this->get_geo_ip_database_file();
			update_option( 'burst_import_geo_ip_on_activation', false );
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
		if ( ( $this->is_burst_page() || $this->is_logged_in_rest() ) && get_option( 'burst_geo_ip_import_error' ) ) {
			$file_name = get_option( 'burst_geo_ip_file' );
			if ( file_exists( $file_name ) ) {
				delete_option( 'burst_geo_ip_import_error' );
			}
		}
	}

	/**
	 * Retrieve the MaxMind geo ip database file. Pass $renew=true to force renewal of the file.
	 *
	 * @since 2.0.3
	 */
	private function get_geo_ip_database_file( bool $renew = false ): void {
		if ( ! wp_doing_cron() && ! $this->user_can_manage() ) {
			return;
		}

		if ( defined( 'BURST_DO_NOT_UPDATE_GEO_IP' ) && BURST_DO_NOT_UPDATE_GEO_IP ) {
			return;
		}

		if ( get_transient( 'burst_importing' ) ) {
			return;
		}
		// prevent more than one attempt every 5 minutes.
		$last_attempt     = get_option( 'burst_geo_ip_last_attempt' );
		$five_minutes_ago = time() - MINUTE_IN_SECONDS;
		if ( $last_attempt && $last_attempt > $five_minutes_ago ) {
			return;
		}

		set_transient( 'burst_importing', true, 5 * MINUTE_IN_SECONDS );
		// only run if it doesn't exist yet, or if it should renew.
		if ( $renew
			|| ! get_option( 'burst_geo_ip_file' )
			|| ! file_exists( get_option( 'burst_geo_ip_file' ) ) ) {
			global $wp_filesystem;

			if ( ! $wp_filesystem || ! is_a( $wp_filesystem, 'WP_Filesystem_Base' ) ) {
				require_once ABSPATH . '/wp-admin/includes/file.php';
				WP_Filesystem();
			}

			update_option( 'burst_geo_ip_file', false );

			update_option( 'burst_geo_ip_last_attempt', time() );
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
				update_option( 'burst_geo_ip_import_error', __( 'Required directory does not exist:', 'burst-statistics' ) . ' ' . $upload_dir );
			} elseif ( $this->has_open_basedir_restriction( $zip_file_name ) ) {
				update_option( 'burst_geo_ip_import_error', 'Open Base dir restriction detected. Please upload manually.' );
			} elseif ( is_wp_error( $tmpfile ) ) {
				// store the error for use in the callback notice for geo ip.
				update_option( 'burst_geo_ip_import_error', $tmpfile->get_error_message() );
			} else {
				// Extract tar.gz.
				update_option( 'burst_geo_ip_file', $unzipped );
				$new_file         = str_replace( '.mmdb', '-new.mmdb', $unzipped );
				$new_file_renamed = str_replace( '.mmdb', '-new-renamed.mmdb', $unzipped );
				// Clean up any leftover temp files from a previous failed attempt.
				if ( $wp_filesystem->is_file( $new_file ) ) {
					wp_delete_file( $new_file );
				}
				if ( $wp_filesystem->is_file( $new_file_renamed ) ) {
					wp_delete_file( $new_file_renamed );
				}

				// Copy the tar.gz if it does not exist yet.
				if ( ! $wp_filesystem->is_file( $zip_file_name ) ) {
					copy( $tmpfile, $zip_file_name );
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
							__( 'The PHP Phar extension is not available on this server. Please enable the Phar extension or contact your hosting provider.', 'burst-statistics' )
						);
					}
				} catch ( \Throwable $e ) {
					// Catches both \Exception and \Error (e.g. missing extensions).
					update_option( 'burst_geo_ip_import_error', $e->getMessage() );
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
						$wp_filesystem->move( $new_file_renamed, $unzipped );
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
				if ( file_exists( $unzipped ) ) {
					delete_option( 'burst_geo_ip_import_error' );
					// re-run the tasks validation to ensure that the geo ip warning is removed.
					\Burst\burst_loader()->admin->tasks->schedule_task_validation();
				}
			}

			// Delete temp file.
			if ( is_string( $tmpfile ) && file_exists( $tmpfile ) ) {
				wp_delete_file( $tmpfile );
			}
			delete_transient( 'burst_importing' );
			update_option( 'burst_last_update_geo_ip', time(), false );
		}
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

		$notices[] = [
			'id'          => 'burst_geo_ip_import_error',
			'condition'   => [
				'type'     => 'serverside',
				'function' => 'wp_option_burst_geo_ip_import_error',
			],
			'msg'         => __( "The GEO IP database hasn't been downloaded yet. It is necessary for tracking country information.", 'burst-statistics' ) .
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
