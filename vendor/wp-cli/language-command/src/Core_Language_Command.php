<?php

/**
 * Installs, activates, and manages core language packs.
 *
 * ## EXAMPLES
 *
 *     # Install the Dutch core language pack.
 *     $ wp language core install nl_NL
 *     Downloading translation from https://downloads.wordpress.org/translation/core/6.4.3/nl_NL.zip...
 *     Unpacking the update...
 *     Installing the latest version...
 *     Removing the old version of the translation...
 *     Translation updated successfully.
 *     Language 'nl_NL' installed.
 *     Success: Installed 1 of 1 languages.
 *
 *     # Activate the Dutch core language pack.
 *     $ wp site switch-language nl_NL
 *     Success: Language activated.
 *
 *     # Uninstall the Dutch core language pack.
 *     $ wp language core uninstall nl_NL
 *     Success: Language uninstalled.
 *
 *     # List installed core language packs.
 *     $ wp language core list --status=installed
 *     +----------+--------------+-------------+-----------+-----------+---------------------+
 *     | language | english_name | native_name | status    | update    | updated             |
 *     +----------+--------------+-------------+-----------+-----------+---------------------+
 *     | nl_NL    | Dutch        | Nederlands  | installed | available | 2024-01-31 10:24:06 |
 *     +----------+--------------+-------------+-----------+-----------+---------------------+
 *
 * @package wp-cli
 */
class Core_Language_Command extends WP_CLI\CommandWithTranslation {
	protected $obj_type = 'core';

	protected $obj_fields = array(
		'language',
		'english_name',
		'native_name',
		'status',
		'update',
		'updated',
	);

	/**
	 * Lists all available languages.
	 *
	 * ## OPTIONS
	 *
	 * [--field=<field>]
	 * : Display the value of a single field
	 *
	 * [--<field>=<value>]
	 * : Filter results by key=value pairs.
	 *
	 * [--fields=<fields>]
	 * : Limit the output to specific fields.
	 *
	 * [--format=<format>]
	 * : Render output in a particular format.
	 * ---
	 * default: table
	 * options:
	 *   - table
	 *   - csv
	 *   - json
	 *   - count
	 * ---
	 *
	 * ## AVAILABLE FIELDS
	 *
	 * These fields will be displayed by default for each translation:
	 *
	 * * language
	 * * english_name
	 * * native_name
	 * * status
	 * * update
	 * * updated
	 *
	 * ## EXAMPLES
	 *
	 *     # List language,english_name,status fields of available languages.
	 *     $ wp language core list --fields=language,english_name,status
	 *     +----------------+-------------------------+-------------+
	 *     | language       | english_name            | status      |
	 *     +----------------+-------------------------+-------------+
	 *     | ar             | Arabic                  | uninstalled |
	 *     | ary            | Moroccan Arabic         | uninstalled |
	 *     | az             | Azerbaijani             | uninstalled |
	 *
	 * @subcommand list
	 */
	public function list_( $args, $assoc_args ) {
		$translations = $this->get_all_languages();
		$available    = $this->get_installed_languages();
		$updates      = $this->get_translation_updates();

		$current_locale = get_locale();

		$translations = array_map(
			function ( $translation ) use ( $available, $current_locale, $updates ) {
				$translation['status'] = 'uninstalled';
				if ( in_array( $translation['language'], $available, true ) ) {
					$translation['status'] = 'installed';
				}

				if ( $current_locale === $translation['language'] ) {
					$translation['status'] = 'active';
				}

				$update = wp_list_filter( $updates, array( 'language' => $translation['language'] ) );
				if ( $update ) {
					$translation['update'] = 'available';
				} else {
					$translation['update'] = 'none';
				}

				return $translation;
			},
			$translations
		);

		foreach ( $translations as $key => $translation ) {
			foreach ( array_keys( $translation ) as $field ) {
				if ( isset( $assoc_args[ $field ] ) && $assoc_args[ $field ] !== $translation[ $field ] ) {
					unset( $translations[ $key ] );
				}
			}
		}

		$formatter = $this->get_formatter( $assoc_args );
		$formatter->display_items( $translations );
	}

	/**
	 * Checks if a given language is installed.
	 *
	 * Returns exit code 0 when installed, 1 when uninstalled.
	 *
	 * ## OPTIONS
	 *
	 * <language>
	 * : The language code to check.
	 *
	 * ## EXAMPLES
	 *
	 *     # Check whether the German language is installed; exit status 0 if installed, otherwise 1.
	 *     $ wp language core is-installed de_DE
	 *     $ echo $?
	 *     1
	 *
	 * @subcommand is-installed
	 */
	public function is_installed( $args, $assoc_args = array() ) {
		list( $language_code ) = $args;
		$available             = $this->get_installed_languages();
		if ( in_array( $language_code, $available, true ) ) {
			\WP_CLI::halt( 0 );
		} else {
			\WP_CLI::halt( 1 );
		}
	}

	/**
	 * Installs a given language.
	 *
	 * Downloads the language pack from WordPress.org. Find your language code at: https://translate.wordpress.org/
	 *
	 * ## OPTIONS
	 *
	 * <language>...
	 * : Language code to install.
	 *
	 * [--activate]
	 * : If set, the language will be activated immediately after install.
	 *
	 * ## EXAMPLES
	 *
	 *     # Install the Brazilian Portuguese language.
	 *     $ wp language core install pt_BR
	 *     Downloading translation from https://downloads.wordpress.org/translation/core/6.5/pt_BR.zip...
	 *     Unpacking the update...
	 *     Installing the latest version...
	 *     Removing the old version of the translation...
	 *     Translation updated successfully.
	 *     Language 'pt_BR' installed.
	 *     Success: Installed 1 of 1 languages.
	 *
	 * @subcommand install
	 */
	public function install( $args, $assoc_args ) {
		$language_codes = (array) $args;
		$count          = count( $language_codes );

		if ( $count > 1 && in_array( true, $assoc_args, true ) ) {
			WP_CLI::error( 'Only a single language can be active.' );
		}

		$available = $this->get_installed_languages();

		$successes = 0;
		$errors    = 0;
		$skips     = 0;
		foreach ( $language_codes as $language_code ) {

			if ( in_array( $language_code, $available, true ) ) {
				\WP_CLI::log( "Language '{$language_code}' already installed." );
				++$skips;
			} else {
				$response = $this->download_language_pack( $language_code );

				if ( is_wp_error( $response ) ) {
					\WP_CLI::warning( $response );
					\WP_CLI::log( "Language '{$language_code}' not installed." );

					// Skip if translation is not yet available.
					if ( 'not_found' === $response->get_error_code() ) {
						++$skips;
					} else {
						++$errors;
					}
				} else {
					\WP_CLI::log( "Language '{$language_code}' installed." );
					++$successes;
				}
			}

			if ( WP_CLI\Utils\get_flag_value( $assoc_args, 'activate' ) ) {
				$this->activate_language( $language_code );
			}
		}

		\WP_CLI\Utils\report_batch_operation_results( 'language', 'install', $count, $successes, $errors, $skips );
	}

	/**
	 * Uninstalls a given language.
	 *
	 * ## OPTIONS
	 *
	 * <language>...
	 * : Language code to uninstall.
	 *
	 * ## EXAMPLES
	 *
	 *     # Uninstall the Japanese core language pack.
	 *     $ wp language core uninstall ja
	 *     Success: Language uninstalled.
	 *
	 * @subcommand uninstall
	 * @throws WP_CLI\ExitException
	 */
	public function uninstall( $args, $assoc_args ) {
		global $wp_filesystem;

		$dir   = 'core' === $this->obj_type ? '' : "/$this->obj_type";
		$files = scandir( WP_LANG_DIR . $dir );
		if ( ! $files ) {
			WP_CLI::error( 'No files found in language directory.' );
		}

		$language_codes = (array) $args;

		$available = $this->get_installed_languages();

		$current_locale = get_locale();

		foreach ( $language_codes as $language_code ) {
			if ( ! in_array( $language_code, $available, true ) ) {
				WP_CLI::error( 'Language not installed.' );
			}

			if ( $language_code === $current_locale ) {
				WP_CLI::warning( "The '{$language_code}' language is active." );
				exit;
			}

			$files_to_remove = array(
				"$language_code.po",
				"$language_code.mo",
				"$language_code.l10n.php",
				"admin-$language_code.po",
				"admin-$language_code.mo",
				"admin-$language_code.l10n.php",
				"admin-network-$language_code.po",
				"admin-network-$language_code.mo",
				"admin-network-$language_code.l10n.php",
				"continents-cities-$language_code.po",
				"continents-cities-$language_code.mo",
				"continents-cities-$language_code.l10n.php",
			);

			// As of WP 4.0, no API for deleting a language pack
			WP_Filesystem();
			$deleted = false;
			foreach ( $files as $file ) {
				if ( '.' === $file[0] || is_dir( $file ) ) {
					continue;
				}

				if (
					! in_array( $file, $files_to_remove, true ) &&
					! preg_match( "/$language_code-\w{32}\.json/", $file )
				) {
					continue;
				}

				/** @var WP_Filesystem_Base $wp_filesystem */
				$deleted = $wp_filesystem->delete( WP_LANG_DIR . $dir . '/' . $file );
			}

			if ( $deleted ) {
				WP_CLI::success( 'Language uninstalled.' );
			} else {
				WP_CLI::error( "Couldn't uninstall language." );
			}
		}
	}

	/**
	 * Updates installed languages for core.
	 *
	 * ## OPTIONS
	 *
	 * [--dry-run]
	 * : Preview which translations would be updated.
	 *
	 * ## EXAMPLES
	 *
	 *     # Update installed core languages packs.
	 *     $ wp language core update
	 *     Updating 'Japanese' translation for WordPress 6.4.3...
	 *     Downloading translation from https://downloads.wordpress.org/translation/core/6.4.3/ja.zip...
	 *     Translation updated successfully.
	 *     Success: Updated 1/1 translation.
	 *
	 * @subcommand update
	 */
	public function update( $args, $assoc_args ) { // phpcs:ignore Generic.CodeAnalysis.UselessOverridingMethod.Found -- Overruling the documentation, so not useless ;-).
		parent::update( $args, $assoc_args );
	}

	/**
	 * Activates a given language.
	 *
	 * **Warning: `wp language core activate` is deprecated. Use `wp site switch-language` instead.**
	 *
	 * ## OPTIONS
	 *
	 * <language>
	 * : Language code to activate.
	 *
	 * ## EXAMPLES
	 *
	 *     # Activate the given language.
	 *     $ wp language core activate ja
	 *     Success: Language activated.
	 *
	 * @subcommand activate
	 * @throws WP_CLI\ExitException
	 */
	public function activate( $args, $assoc_args ) {
		\WP_CLI::warning( 'This command is deprecated. use wp site switch-language instead' );

		list( $language_code ) = $args;

		$this->activate_language( $language_code );
	}

	private function activate_language( $language_code ) {
		$available = $this->get_installed_languages();

		if ( ! in_array( $language_code, $available, true ) ) {
			WP_CLI::error( 'Language not installed.' );
		}

		if ( 'en_US' === $language_code ) {
			$language_code = '';
		}

		if ( get_locale() === $language_code ) {
			WP_CLI::warning( "Language '{$language_code}' already active." );

			return;
		}

		update_option( 'WPLANG', $language_code );

		WP_CLI::success( 'Language activated.' );
	}
}
