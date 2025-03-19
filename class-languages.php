<?php
defined( 'ABSPATH' ) or die( 'you do not have access to this page!' );
if ( ! class_exists( 'burst_languages' ) ) {
    class burst_languages {
        private static $_this;
        /**
         * If this is set to true, we don't update the language-paths.json file. This file needs only to be updated on plugin installation or update.
         * @var bool
         */
        private bool $dont_update_language_paths = false;

        function __construct() {
            if ( isset( self::$_this ) ) {
                wp_die();
            }

            self::$_this = $this;

            add_action( 'admin_init', [ $this, 'maybe_download_language_files_for_user' ] );
            add_action( 'burst_install_tables', [ $this, 'manage_languages' ], 10, 1 );
        }


        public static function this() {
            return self::$_this;
        }


        /**
         * On Multisite site creation, run table init hook as well.
         *
         * @return void
         */
        public function manage_languages() {
            if ( defined( 'burst_pro' ) ) {
                //check which languages are active
                $language_files = $this->get_language_paths();
                
                // Only clean and download if we have language files to process
                if (!empty($language_files)) {
                    //clear directory on each update, to get the latest translations
                    $this->clean_language_directory();
                    
                    foreach ( $language_files as $file_data ) {
                        $file = $file_data['file'];
                        $target_locale = $file_data['locale'];
                        $this->download_language_file( $file, $target_locale );
                    }
                }
            }
        }

        /**
         * When the user visits the burst settings page, we check for this user's locale and download the language files
         * @return void
         */
        public function maybe_download_language_files_for_user(): void
        {
            if ( ! defined( 'burst_pro' ) ) {
                return;
            }

            if ( ! burst_user_can_manage() ) {
                return;
            }

            if ( isset($_GET['page']) && $_GET['page'] === 'burst'){
                if ( !defined('BURST_INSTALL_TABLES_RUNNING') ) {
                    define( 'BURST_INSTALL_TABLES_RUNNING', true );
                }

                $this->dont_update_language_paths = true;
                $locale = get_user_locale();
                $language_files = $this->get_language_paths($locale);
                foreach ( $language_files as $file_data ) {
                    $file = $file_data['file'];
                    $target_locale = $file_data['locale'];
                    $mapped_file = $this->get_target_file_name( $file, $target_locale );
                    //if this language file already exists, we can assume it has been downloaded already, so we can skip the rest.
                    if ( file_exists( burst_path .'languages/' . $mapped_file ) ) {
                        return;
                    }

                    $this->download_language_file( $file, $target_locale );
                }
            }
        }

        /**
         * Delete all existing language files from the languages directory
         *
         * @return void
         */
        private function clean_language_directory(): void
        {
            if ( defined('BURST_KEEP_LANGUAGES') ) {
                return;
            }
            $directory = burst_path .'languages/';
            $files = glob($directory . '*'); // get all file names
            foreach($files as $file){ // iterate files
                if( is_file($file) && !str_contains($file, '.pot') && !str_contains($file, 'index.php')){
                    unlink($file); // delete file
                }
            }
        }
        /**
         * Get the download path for languages
         *
         * @return string
         */
        private function language_download_path() : string {
            $version = burst_version;
            if (str_contains($version, '#')) {
                $version = substr( $version, 0, strpos( $version, '#' ) );
            }
            return 'https://burst.ams3.cdn.digitaloceanspaces.com/languages/'.$version .'/';
        }

        /**
         * Get the target file name for a language file, the filename that it should be stored as.
         *
         * @param string $file
         * @param string $local_locale
         *
         * @return string
         */
        private function get_target_file_name(string $file, string $local_locale): string
        {
            $mapped_language = $this->get_mapped_language($local_locale);
            if ( $mapped_language === false ) {
                return $file;
            }

            return str_replace( $mapped_language, $local_locale, $file );
        }

        /**
         * Get the language paths. Either for the current locale, or, if not passed, for all active languages
         *
         * @param string $locale
         *
         * @return array
         */
        private function get_language_paths( string $locale = '' ): array {
            // First ensure the language paths file exists and is up to date
            if ( !$this->dont_update_language_paths || !file_exists( burst_path . 'languages/language-paths.json' ) ) {
                $download_result = $this->download_language_file('language-paths.json', $locale);
                if (!$download_result) {
                    burst_error_log("Failed to download language paths file");
                    return [];
                }
            }

            $language_file = burst_path . 'languages/language-paths.json';
            if (!file_exists($language_file)) {
                burst_error_log("Language file not found: {$language_file}");
                return [];
            }

            $content = @file_get_contents($language_file);
            if ($content === false) {
                burst_error_log("Failed to read language file: {$language_file}");
                return [];
            }

            $language_paths = json_decode($content, true);
            if (json_last_error() !== JSON_ERROR_NONE || !is_array($language_paths)) {
                burst_error_log("Failed to parse language paths JSON or invalid format");
                return [];
            }

            $active_languages = empty($locale) ? $this->get_supported_languages() : [$locale];
            $result = [];
            
            // Ensure $language_paths is an array before iterating
            if (!empty($language_paths)) {
                foreach ( $language_paths as $file ) {
                    foreach ( $active_languages as $active_locale ) {
                        //no translations for en_US
                        if ( $active_locale === 'en_US' ) {
                            continue;
                        }

                        $mapped_language = $this->get_mapped_language($active_locale);
                        if ( $mapped_language !== false ) {
                            $download_locale = $mapped_language;
                        } else {
                            $download_locale = $active_locale;
                        }

                        if ( str_contains($file, $download_locale) ) {
                            //check if this file is already added to the array:
                            $already_added = in_array(['file' => $file, 'locale' => $active_locale], $result);
                            if ( !$already_added ) {
                                $result[] = [
                                    'file' => $file,
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
         *
         * @param string $active_locale
         *
         * @return string|bool
         */
        private function get_mapped_language(string $active_locale){
            $language_mappings = [
                "nl_NL"        => [ "nl_BE" ],
                "fr_FR"        => [ "fr_BE", "fr_CA" ],
                "de_DE"        => [ "de_CH_informal", "de_AT" ],
                "de_DE_formal" => [ "de_CH" ],
                "en_GB"        => [ "en_NZ", "en_AU" ],
                "es_ES"        => [ "es_EC", "es_MX", "es_CO", "es_VE", "es_CL", "es_CR", "es_GT", "es_HN", "es_PE", "es_PR", "es_UY", "es_AR", "es_DO" ],
                "pt_PT"        => [ "pt_BR", "pt_AO", "pt_MZ", "pt_CV", "pt_GW", "pt_ST", "pt_TL" ],
            ];
            //e.g:
            //$active_locale = nl_BE;
            //$mapped_language = nl_NL;
            //check if the $active_locale occurs in the $language_mappings array. If so, get the key.
            return array_search( $active_locale, $language_mappings, true );
        }

        /**
         * Download language file
         * 
         * @param string $file_name
         * @param string $target_locale
         * @return bool
         */
        private function download_language_file(string $file_name, string $target_locale ): bool {
            $path = $this->language_download_path() . $file_name;
            if (!function_exists('download_url')) {
                require_once ABSPATH . 'wp-admin/includes/file.php';
            }
            
            $tmpfile = download_url( $path, $timeout = 25 );
            
            if (is_wp_error($tmpfile)) {
                burst_error_log("Failed to download language file {$path}: " . $tmpfile->get_error_message());
                return false;
            }

            $target_file_name = $this->get_target_file_name( $file_name, $target_locale );
            $target_file = burst_path .'languages/' . $target_file_name;

            // Check if languages directory exists and is writable
            $languages_dir = dirname($target_file);
            if (!file_exists($languages_dir)) {
                if (!wp_mkdir_p($languages_dir)) {
                    burst_error_log("Failed to create languages directory: {$languages_dir}");
                    return false;
                }
            }

            if (!is_writable($languages_dir)) {
                burst_error_log("Languages directory is not writable: {$languages_dir}");
                return false;
            }

            //remove current file
            if (file_exists($target_file)) {
                if (!@unlink($target_file)) {
                    burst_error_log("Failed to delete existing language file: {$target_file}");
                    return false;
                }
            }

            if (!@copy($tmpfile, $target_file)) {
                burst_error_log("Failed to copy language file from {$tmpfile} to {$target_file}");
                return false;
            }

            if (is_string($tmpfile) && file_exists($tmpfile)) {
                @unlink($tmpfile);
            }

            return true;
        }

        /**
         * Get an array of languages used on this site
         *
         * @return array
         */

        public function get_supported_languages( ): array {
            $site_locale = get_locale();
            $user_locale = get_user_locale();
            //allow to extend to more languages by returning an array
            $languages = [$site_locale];
            if ($site_locale !== $user_locale) {
                $languages[] = $user_locale;
            }
            $wp_languages = get_available_languages();
            $languages = array_merge($languages, $wp_languages);
            return array_unique( $languages );
        }

    }
} //class closure
