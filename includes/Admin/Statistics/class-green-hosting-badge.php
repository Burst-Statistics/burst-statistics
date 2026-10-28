<?php
/**
 * Local copy of the Green Web Foundation badge.
 *
 * @package Burst\Admin\Statistics
 */
namespace Burst\Admin\Statistics;

use Burst\Frontend\Green_Hosting_Badge_Block;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die();

/**
 * Keeps the Green Web Badge for the site's own host in uploads/burst/green-hosting/.
 *
 * The badge is served from the site itself, so visitors never load anything
 * from the Green Web Foundation: the only requests to them are the ones the
 * site owner's green hosting check already makes.
 *
 * The frontend only reads Green_Hosting_Badge_Block::OPTION. Everything that
 * touches the network or the file system runs here, from cron: the download
 * after a green check, and the daily check that the stored badge still
 * belongs to a current, green result for this host.
 */
class Green_Hosting_Badge {
	use Helper;

	/**
	 * The plugin version this file belongs to. See Upgrade::check_upgrade().
	 *
	 * @var string
	 */
	public const BUILD = '3.7.4';

	public const DOWNLOAD_HOOK = 'burst_green_hosting_badge_download';

	private const DIRECTORY   = 'green-hosting';
	private const FILE_PREFIX = 'green-hosting-badge-';
	private const ENDPOINT    = 'https://app.greenweb.org/api/v3/greencheckimage/';

	// The badge is a 200x95 PNG of about 15 KB; anything far larger is not it.
	private const MAX_BYTES = 200 * KB_IN_BYTES;

	/**
	 * Register hooks.
	 */
	public function init(): void {
		add_action( 'burst_install_tables', [ $this, 'install_option' ] );
		add_action( self::DOWNLOAD_HOOK, [ $this, 'download_for_current_status' ] );
		add_action( 'burst_daily', [ $this, 'validate' ] );
		// The first release with the badge: sites that are already verified
		// green get their badge without waiting for the next check. Safe on
		// every later upgrade too, because validate() only acts on a mismatch.
		add_action( 'burst_upgrade_after', [ $this, 'validate' ] );
	}

	/**
	 * Create the render option, autoloaded and empty.
	 *
	 * Autoloaded because the block reads it on frontend requests. It always
	 * exists: without a persistent object cache, get_option() on a missing
	 * option is a database query on every request.
	 */
	public function install_option(): void {
		add_option( Green_Hosting_Badge_Block::OPTION, [], '', true );
	}

	/**
	 * Follow a fresh check result.
	 *
	 * A non-green result removes the badge at once. A green result schedules
	 * the download, so the check request does not wait for a second remote
	 * call. A badge stored for another host stops showing right away.
	 *
	 * @param bool   $is_green Whether the check verified the host as green.
	 * @param string $host     The checked host.
	 */
	public function sync( bool $is_green, string $host ): void {
		if ( ! $is_green ) {
			$this->delete();
			return;
		}

		if ( $this->get_stored_host() !== $host ) {
			$this->clear_option();
		}

		$this->schedule_download();
	}

	/**
	 * Daily check: keep the badge only for a current, green result for this
	 * host, and fetch it again when it is missing.
	 *
	 * Runs from cron instead of on every frontend request, so a badge can
	 * outlive an expired result or a host change by up to a day.
	 */
	public function validate(): void {
		$status = Green_Hosting::get_status();
		if ( ! $status['green'] ) {
			$this->delete();
			return;
		}

		if ( $this->get_stored_host() === $status['host'] && file_exists( $this->get_path( $status['host'] ) ) ) {
			return;
		}

		$this->clear_option();
		$this->schedule_download();
	}

	/**
	 * Download the badge for the current status, from the scheduled event.
	 *
	 * A failed download keeps a badge already stored for this host: the check
	 * result it was stored under still stands, and the daily check tries again
	 * when there is none.
	 */
	public function download_for_current_status(): void {
		$status = Green_Hosting::get_status();
		if ( ! $status['green'] ) {
			$this->delete();
			return;
		}

		$host = $status['host'];
		if ( ! $this->download( $host ) && ! file_exists( $this->get_path( $host ) ) ) {
			return;
		}

		$this->store_option( $host, $status['checked_at'] );
		$this->delete_files_except( $this->get_path( $host ) );
	}

	/**
	 * Remove every stored badge and stop rendering it.
	 *
	 * Side effect: deletes the files from uploads/burst/green-hosting/.
	 */
	public function delete(): void {
		$this->clear_option();
		$this->delete_files_except( '' );
	}

	/**
	 * Schedule one badge download, unless one is already pending.
	 */
	private function schedule_download(): void {
		if ( false !== wp_next_scheduled( self::DOWNLOAD_HOOK ) ) {
			return;
		}

		$result = wp_schedule_single_event( time(), self::DOWNLOAD_HOOK, [], true );
		if ( true !== $result ) {
			$reason = is_wp_error( $result ) ? $result->get_error_message() : 'WordPress rejected the event';
			self::error_log( 'Could not schedule the green hosting badge download: ' . $reason );
		}
	}

	/**
	 * Point the frontend at the badge for this host.
	 *
	 * @param string $host       The checked host.
	 * @param int    $checked_at Check time, used as cache buster so a
	 *                           re-downloaded badge replaces the browser's copy.
	 */
	private function store_option( string $host, int $checked_at ): void {
		$url = add_query_arg( 'ver', $checked_at, $this->upload_url( self::DIRECTORY ) . $this->get_filename( $host ) );
		update_option(
			Green_Hosting_Badge_Block::OPTION,
			[
				'host' => $host,
				'url'  => esc_url_raw( $url ),
			],
			true
		);
	}

	/**
	 * Stop rendering the badge. Keeps the option row, see install_option().
	 */
	private function clear_option(): void {
		update_option( Green_Hosting_Badge_Block::OPTION, [], true );
	}

	/**
	 * Host the rendered badge was stored for.
	 *
	 * @return string The host, or an empty string without a badge.
	 */
	private function get_stored_host(): string {
		$badge = get_option( Green_Hosting_Badge_Block::OPTION, [] );

		return is_array( $badge ) ? (string) ( $badge['host'] ?? '' ) : '';
	}

	/**
	 * File name of the badge for a host.
	 *
	 * Includes the host, so a badge downloaded for a previous domain can never
	 * be served as the badge of the current one.
	 *
	 * @param string $host The checked host.
	 * @return string The file name.
	 */
	private function get_filename( string $host ): string {
		return self::FILE_PREFIX . substr( hash( 'sha256', $host ), 0, 32 ) . '.png';
	}

	/**
	 * Absolute path of the badge for a host.
	 *
	 * @param string $host The checked host.
	 * @return string The badge path.
	 */
	private function get_path( string $host ): string {
		return $this->get_directory() . $this->get_filename( $host );
	}

	/**
	 * Badge directory, without creating it.
	 *
	 * Only write() needs it to exist, through upload_dir(), so reads and deletes
	 * do not leave an empty directory behind on sites that are not green.
	 *
	 * @return string The directory path, with a trailing slash.
	 */
	private function get_directory(): string {
		return $this->upload_path( self::DIRECTORY );
	}

	/**
	 * Delete stored badges, except the one at $keep.
	 *
	 * @param string $keep Path to keep, or an empty string to delete all.
	 */
	private function delete_files_except( string $keep ): void {
		$files = glob( $this->get_directory() . self::FILE_PREFIX . '*.png' );
		if ( ! is_array( $files ) ) {
			return;
		}

		foreach ( $files as $file ) {
			if ( $file !== $keep ) {
				wp_delete_file( $file );
			}
		}
	}

	/**
	 * Download the badge for this host and replace the stored copy.
	 *
	 * @param string $host The checked host.
	 * @return bool Whether a new badge was stored.
	 */
	private function download( string $host ): bool {
		$response = wp_remote_get(
			self::ENDPOINT . rawurlencode( $host ),
			[
				'timeout'    => 10,
				'user-agent' => 'Burst Statistics',
			]
		);

		if ( is_wp_error( $response ) ) {
			self::error_log( 'Green hosting badge download failed: ' . $response->get_error_message() );
			return false;
		}

		$body = wp_remote_retrieve_body( $response );
		if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) || ! $this->is_png( $body ) ) {
			self::error_log( 'Green hosting badge download failed: the response is not a PNG image.' );
			return false;
		}

		return $this->write( $body, $host );
	}

	/**
	 * Whether a response body is a PNG of a plausible size.
	 *
	 * Checks the file signature rather than the Content-Type header, so an
	 * error page sent as image/png is never stored and shown to visitors.
	 *
	 * @param string $body The response body.
	 * @return bool Whether the body is a PNG.
	 */
	private function is_png( string $body ): bool {
		return strlen( $body ) <= self::MAX_BYTES && str_starts_with( $body, "\x89PNG\r\n\x1a\n" );
	}

	/**
	 * Write the badge through a temporary file, so a visitor never gets a
	 * half-written image.
	 *
	 * The temporary name is unique, so two downloads that run at the same
	 * time never write into or rename each other's file.
	 *
	 * @param string $body The PNG data.
	 * @param string $host The checked host.
	 * @return bool Whether the badge was stored.
	 */
	private function write( string $body, string $host ): bool {
		// Public directory: a "Deny from all" .htaccess would make the badge a
		// broken image for every visitor on Apache.
		$directory = $this->upload_dir( self::DIRECTORY, false, true );
		if ( ! is_dir( $directory ) ) {
			self::error_log( 'Green hosting badge could not be stored: the upload directory is not writable.' );
			return false;
		}

		$path      = $directory . $this->get_filename( $host );
		$temp_path = $path . '.' . wp_generate_password( 12, false ) . '.tmp';
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		if ( false === file_put_contents( $temp_path, $body ) ) {
			self::error_log( 'Green hosting badge could not be stored.' );
			return false;
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.rename_rename
		if ( ! rename( $temp_path, $path ) ) {
			wp_delete_file( $temp_path );
			self::error_log( 'Green hosting badge could not be stored.' );
			return false;
		}

		return true;
	}
}
