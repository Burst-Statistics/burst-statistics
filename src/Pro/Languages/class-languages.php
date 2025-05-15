<?php
namespace Burst\Pro\Languages;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );
class Languages {
	use Helper;
	use Admin_Helper;

	/**
	 * Constructor
	 */
	public function __construct() {
		add_action( 'admin_init', [ $this, 'init_cron_download_language_files_for_user' ] );
		add_action( 'burst_install_tables', [ $this, 'init_cron_manage_languages' ], 10, 1 );
		add_action( 'burst_download_language_files_for_user', [ $this, 'download_language_files_for_user' ] );
		add_action( 'burst_manage_languages', [ $this, 'manage_languages' ] );
		add_action( 'burst_daily', [ $this, 'manage_languages' ] );
	}

	/**
	 * Initialize the cron job to download language files for the user.
	 * This is triggered when the user visits the Burst settings page.
	 */
	public function init_cron_download_language_files_for_user(): void {
		if ( isset( $_GET['page'] ) && $_GET['page'] === 'burst' ) {
			$locale = get_user_locale();
			if ( ! $this->language_is_installed_cached( $locale ) ) {
				update_option( 'burst_install_user_language', $locale, false );
				if ( ! wp_next_scheduled( 'burst_download_language_files_for_user' ) ) {
					wp_schedule_single_event( time() + 10, 'burst_download_language_files_for_user' );
				}
			}
		}
	}

	/**
	 * Initialize the cron job to manage languages.
	 * This is triggered when the plugin is activated or upgraded.
	 */
	public function init_cron_manage_languages(): void {
		if ( ! wp_next_scheduled( 'burst_manage_languages' ) ) {
			// only clean directory on plugin updates.
			update_option( 'burst_clean_languages', true, false );
			wp_schedule_single_event( time() + 10, 'burst_manage_languages' );
		}
	}


	/**
	 * On Multisite site creation, run table init hook as well.
	 */
	public function manage_languages(): void {
		if ( get_transient( 'burst_downloading_languages' ) ) {
			return;
		}

		set_transient( 'burst_downloading_languages', true, MINUTE_IN_SECONDS );
		// check which languages are active.
		$language_files = $this->get_language_paths();
		// Only clean and download if we have language files to process.
		if ( ! empty( $language_files ) ) {
			// clear directory on each update, to get the latest translations.
			if ( get_option( 'burst_clean_languages' ) ) {
				$this->clean_language_directory();
				delete_option( 'burst_clean_languages' );
			}

			foreach ( $language_files as $file_data ) {
				$file          = $file_data['file'];
				$target_locale = $file_data['locale'];
				$this->download_language_zip( $file, $target_locale );
			}
		}

		delete_transient( 'burst_downloading_languages' );
	}

	/**
	 * When the user visits the burst settings page, we check for this user's locale and download the language files
	 */
	public function download_language_files_for_user(): void {
		if ( get_transient( 'burst_downloading_languages' ) ) {
			return;
		}

		set_transient( 'burst_downloading_languages', true, MINUTE_IN_SECONDS );
		$locale = get_option( 'burst_install_user_language' );
		if ( empty( $locale ) ) {
			return;
		}

		if ( $this->language_is_installed_cached( $locale ) ) {
			delete_option( 'burst_install_user_language' );
			delete_transient( 'burst_downloading_languages' );
			return;
		}

		$language_files = $this->get_language_paths( $locale );
		foreach ( $language_files as $file_data ) {
			$this->download_language_zip( $file_data['file'], $file_data['locale'] );
		}

		delete_transient( 'burst_downloading_languages' );
		delete_option( 'burst_install_user_language' );
	}

	/**
	 * Check if the language is installed, cached in a transient
	 */
	private function language_is_installed_cached( $locale ): bool {
		$language_installed = get_transient( "burst_language_installed_$locale" );
		if ( empty( $language_installed ) ) {
			$installed          = $this->language_is_installed( $locale );
			$language_installed = $installed ? 'yes' : 'no';
			set_transient( "burst_language_installed_$locale", $language_installed, DAY_IN_SECONDS );
		}
		return $language_installed === 'yes';
	}

	/**
	 * When the user visits the burst settings page, we check for this user's locale and download the language files
	 */
	private function language_is_installed( string $locale ): bool {

		$language_files = $this->get_language_paths( $locale );
		foreach ( $language_files as $file_data ) {
			$file          = $file_data['file'];
			$target_locale = $file_data['locale'];
			$mapped_file   = $this->get_target_file_name( $file, $target_locale );
			// strip zip extension.
			$mapped_file = str_replace( '.zip', '', $mapped_file );
			// if this language file already exists, we can assume it has been downloaded already, so we can skip the rest.
			$directory = BURST_PATH . 'languages/';
			$pattern   = $directory . $mapped_file . '*';

			$files = glob( $pattern );
			if ( ! empty( $files ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Delete all existing language files from the languages directory
	 */
	private function clean_language_directory(): void {
		if ( defined( 'BURST_KEEP_LANGUAGES' ) ) {
			return;
		}

		delete_transient( 'burst_downloading_languages' );
		$locales = $this->get_supported_languages();
		foreach ( $locales as $locale ) {
			delete_transient( "burst_language_installed_$locale" );
		}
		$directory = BURST_PATH . 'languages/';
		// get all file names.
		$files = glob( $directory . '*' );
		// iterate files.
		foreach ( $files as $file ) {
			if ( is_file( $file ) && ! str_contains( $file, '.pot' ) && ! str_contains( $file, 'index.php' ) ) {
				// delete file.
				wp_delete_file( $file );
			}
		}
		if ( file_exists( $directory . 'language-paths.json' ) ) {
			wp_delete_file( $directory . 'language-paths.json' );
		}
	}
	/**
	 * Get the download path for languages
	 */
	private function language_download_path(): string {
		$version = BURST_VERSION;
		if ( str_contains( $version, '#' ) ) {
			$version = substr( $version, 0, strpos( $version, '#' ) );
		}
		return 'https://burst.ams3.cdn.digitaloceanspaces.com/languages/' . $version . '/';
	}

	/**
	 * Get the target file name for a language file, the filename that it should be stored as.
	 */
	private function get_target_file_name( string $file, string $local_locale ): string {
		$mapped_language = $this->get_mapped_language( $local_locale );
		if ( $mapped_language === $local_locale ) {
			return $file;
		}

		return str_replace( $mapped_language, $local_locale, $file );
	}

	/**
	 * Get the language paths. Either for the current locale, or for all active languages if none is provided.
	 *
	 * @param string $locale Optional locale to filter language paths (e.g., 'fr_FR').
	 * @return array<int, array{file: string, locale: string}> List of language files with associated locales.
	 */
	private function get_language_paths( string $locale = '' ): array {
		// First ensure the language paths file exists and is up to date.
		if ( ! file_exists( BURST_PATH . 'languages/language-paths.json' ) ) {
			$download_result = $this->download_language_file( 'language-paths.json', $locale );
			if ( ! $download_result ) {
				self::error_log( 'Failed to download language paths file' );
				return [];
			}
		}

		$language_file = BURST_PATH . 'languages/language-paths.json';
		if ( ! file_exists( $language_file ) ) {
			self::error_log( "Language file not found: {$language_file}" );
			return [];
		}

		$content = @file_get_contents( $language_file );
		if ( $content === false ) {
			self::error_log( "Failed to read language file: {$language_file}" );
			return [];
		}

		$language_paths = json_decode( $content, true );
		if ( json_last_error() !== JSON_ERROR_NONE || ! is_array( $language_paths ) ) {
			self::error_log( 'Failed to parse language paths JSON or invalid format' );
			return [];
		}

		$active_languages = empty( $locale ) ? $this->get_supported_languages() : [ $locale ];
		$result           = [];

		// Ensure $language_paths is an array before iterating.
		if ( ! empty( $language_paths ) ) {
			foreach ( $language_paths as $file ) {
				foreach ( $active_languages as $active_locale ) {
					// no translations for en_US.
					if ( $active_locale === 'en_US' ) {
						continue;
					}

					$download_locale = $this->get_mapped_language( $active_locale );

					if ( str_contains( $file, $download_locale ) ) {
						// check if this file is already added to the array:.
						$already_added = in_array(
							[
								'file'   => $file,
								'locale' => $active_locale,
							],
							$result,
							true
						);
						if ( ! $already_added ) {
							$result[] = [
								'file'   => $file,
								'locale' => $active_locale,
							];
						}
					}
				}
			}
		}

		return $result;
	}

	/**
	 * Get the mapped language for a locale. Some languages, like nl_BE, are mapped to nl_NL
	 */
	private function get_mapped_language( string $active_locale ): string {
		$language_mappings = [
			'nl_NL'        => [ 'nl_BE' ],
			'fr_FR'        => [ 'fr_BE', 'fr_CA' ],
			'de_DE'        => [ 'de_CH_informal', 'de_AT' ],
			'de_DE_formal' => [ 'de_CH' ],
			'en_GB'        => [ 'en_NZ', 'en_AU' ],
			'es_ES'        => [ 'es_EC', 'es_MX', 'es_CO', 'es_VE', 'es_CL', 'es_CR', 'es_GT', 'es_HN', 'es_PE', 'es_PR', 'es_UY', 'es_AR', 'es_DO' ],
			'pt_PT'        => [ 'pt_BR', 'pt_AO', 'pt_MZ', 'pt_CV', 'pt_GW', 'pt_ST', 'pt_TL' ],
		];
		// e.g:.
		// $active_locale = nl_BE;.
		// $mapped_language = nl_NL;.
		// check if the $active_locale occurs in the $language_mappings array. If so, get the key.
		foreach ( $language_mappings as $main_locale => $mapped_locales ) {
			if ( in_array( $active_locale, $mapped_locales, true ) ) {
				return $main_locale;
			}
		}
		return $active_locale;
	}
	/**
	 * Download language file
	 */
	private function download_language_file( string $file_name, string $target_locale ): bool {
		$path = $this->language_download_path() . $file_name;
		if ( ! function_exists( 'download_url' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}

		$tmpfile = download_url( $path, $timeout = 25 );

		if ( is_wp_error( $tmpfile ) ) {
			self::error_log( "Failed to download language file {$path}: " . $tmpfile->get_error_message() );
			return false;
		}

		$target_file_name = $this->get_target_file_name( $file_name, $target_locale );
		$target_file      = BURST_PATH . 'languages/' . $target_file_name;

		// Check if languages directory exists and is writable.
		$languages_dir = dirname( $target_file );
		if ( ! file_exists( $languages_dir ) ) {
			if ( ! wp_mkdir_p( $languages_dir ) ) {
				self::error_log( "Failed to create languages directory: {$languages_dir}" );
				return false;
			}
		}

		if ( ! is_writable( $languages_dir ) ) {
			self::error_log( "Languages directory is not writable: {$languages_dir}" );
			return false;
		}

		// remove current file.
		if ( file_exists( $target_file ) ) {
			if ( ! wp_delete_file( $target_file ) ) {
				self::error_log( "Failed to delete existing language file: {$target_file}" );
				return false;
			}
		}

		if ( ! @copy( $tmpfile, $target_file ) ) {
			self::error_log( "Failed to copy language file from {$tmpfile} to {$target_file}" );
			return false;
		}

		if ( file_exists( $tmpfile ) ) {
			wp_delete_file( $tmpfile );
		}
		return true;
	}

	/**
	 * Download language file
	 */
	private function download_language_zip( string $file_name, string $target_locale ): bool {
		// this string is checked in the tests.
		self::error_log( "Downloading language pack for $target_locale" );

		$path = $this->language_download_path() . $file_name;
		if ( ! function_exists( 'download_url' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}

		$tmpfile = download_url( $path, $timeout = 25 );
		if ( is_wp_error( $tmpfile ) ) {
			self::error_log( "Failed to download language file {$path}: " . $tmpfile->get_error_message() );
			return false;
		}

		// Check if languages directory exists and is writable.
		$languages_dir = BURST_PATH . 'languages/';
		if ( ! file_exists( $languages_dir ) ) {
			if ( ! wp_mkdir_p( $languages_dir ) ) {
				self::error_log( "Failed to create languages directory: {$languages_dir}" );
				return false;
			}
		}

		if ( ! is_writable( $languages_dir ) ) {
			self::error_log( "Languages directory is not writable: {$languages_dir}" );
			return false;
		}

		$file_path = $languages_dir . $file_name;
		if ( file_exists( $file_path ) ) {
			if ( ! wp_delete_file( $file_path ) ) {
				self::error_log( "Failed to delete existing language file: {$file_path}" );
				return false;
			}
		}

		if ( ! @copy( $tmpfile, $file_path ) ) {
			self::error_log( "Failed to copy language zip file from {$tmpfile} to {$file_path}" );
			return false;
		}
		if ( file_exists( $tmpfile ) ) {
			wp_delete_file( $tmpfile );
		}

		$zip                      = new \ZipArchive();
		$unzipped_files_directory = BURST_PATH . 'languages/' . str_replace( '.zip', '', $file_name );

		if ( $zip->open( $file_path ) === true ) {
			$zip->extractTo( $unzipped_files_directory );
			$zip->close();
		} else {
			self::error_log( "Failed to extract language zip file: {$file_name}" );
			return false;
		}

		if ( file_exists( $file_path ) ) {
			wp_delete_file( $file_path );
		}

		$unzipped_files = glob( $unzipped_files_directory . '/*' );
		foreach ( $unzipped_files as $unzipped_file ) {
			$target_file_name = $this->get_target_file_name( basename( $unzipped_file ), $target_locale );
			$target_file      = BURST_PATH . 'languages/' . $target_file_name;

			// remove current file.
			if ( file_exists( $target_file ) ) {
				if ( ! wp_delete_file( $target_file ) ) {
					self::error_log( "Failed to delete existing language file: {$target_file}" );
					return false;
				}
			}

			if ( ! @copy( $unzipped_file, $target_file ) ) {
				self::error_log( "Failed to copy language file from {$unzipped_file} to {$target_file}" );
				return false;
			}
		}

		// delete the $unzipped_files_directory directory and all files in it.
		if ( is_dir( $unzipped_files_directory ) ) {
			$files = glob( $unzipped_files_directory . '/*' );
			foreach ( $files as $file ) {
				if ( is_file( $file ) ) {
					wp_delete_file( $file );
				}
			}
			rmdir( $unzipped_files_directory );
		}

		return true;
	}

	/**
	 * Get an array of languages used on this site.
	 *
	 * @return array<int, string> List of unique language locale codes (e.g., 'en_US', 'nl_NL').
	 */
	public function get_supported_languages(): array {
		$site_locale = get_locale();
		$user_locale = get_user_locale();
		// allow to extend to more languages by returning an array.
		$languages = [ $site_locale ];
		if ( $site_locale !== $user_locale ) {
			$languages[] = $user_locale;
		}
		$wp_languages = get_available_languages();
		$languages    = array_merge( $languages, $wp_languages );
		return array_unique( $languages );
	}
}
