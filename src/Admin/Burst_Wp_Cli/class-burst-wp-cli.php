<?php
namespace Burst\Admin\Burst_Wp_Cli;

use Burst\Admin\Admin;
use Burst\Frontend\Goals\Goal;
use Burst\Pro\Licensing\Licensing;
use Burst\Traits\Admin_Helper;
use Burst\Traits\Helper;
use Burst\Traits\Save;
use WP_CLI\ExitException;

defined( 'ABSPATH' ) || die();

/**
 * Usage
 * wp burst activate_license <license_key>
 * wp burst save --enable_turbo_mode=true --enable_cookieless_tracking=one
 */
class Burst_Wp_Cli {
	use Helper;
	use Admin_Helper;
	use Save;

	public array $tasks = [];

	/**
	 * Burst_Wp_Cli constructor.
	 */
	public function __construct() {
	}

	/**
	 * Check if WP CLI is active
	 */
	private function wp_cli_active(): bool {
		return defined( 'WP_CLI' ) && WP_CLI;
	}

	/**
	 * Activate SSL through CLI
	 *
	 * @throws ExitException //exit exception.
	 */
	public function add_goal( array $args, array $assoc_args ): void {
		if ( ! $this->wp_cli_active() ) {
			return;
		}

		if ( empty( $assoc_args ) ) {
			\WP_CLI::error( 'No properties passed' );
		}

		$goal = new Goal();
		foreach ( $assoc_args as $name => $value ) {
			$goal->$name = $value;
		}
		$goal->save();
	}

	/**
	 * Get all internal links
	 */
	public function get_internal_links(): void {
		if ( ! $this->wp_cli_active() ) {
			return;
		}

		if ( ! self::is_test() ) {
			return;
		}

		$urls = [];

		$iterator = new \RecursiveIteratorIterator(
			new \RecursiveDirectoryIterator( trailingslashit( BURST_PATH ) . 'src' ),
		);

		foreach ( $iterator as $file ) {
			if ( ! $file->isFile() || pathinfo( $file, PATHINFO_EXTENSION ) !== 'php' ) {
				continue;
			}
			$path_name = $file->getPathname();
			// exclude vendor directory.
			if ( strpos( $path_name, 'vendor' ) !== false ) {
				continue;
			}
			if ( strpos( $path_name, 'node_modules' ) !== false ) {
				continue;
			}

			// include only php files.
			if ( strpos( $path_name, '.php' ) === false ) {
				continue;
			}

            //phpcs:ignore
            $contents = ( file_exists( $path_name ) && is_readable( $path_name ) ) ? file_get_contents( $path_name ) : '';

			// Match 'url' and ->admin_url.
			if ( preg_match_all(
				'/["\']url["\']\s*=>\s*["\']([^"\']*#[^"\']*)["\']|->admin_url\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)/',
				$contents,
				$matches
			) ) {
				foreach ( $matches[1] as $i => $match1 ) {
					if ( ! empty( $match1 ) ) {
						$urls[] = $match1;
					} elseif ( ! empty( $matches[2][ $i ] ) ) {
						$admin_url = $matches[2][ $i ];
						// if the first characters are 'burst', strip it.
						if ( strpos( $admin_url, 'burst' ) === 0 ) {
							$admin_url = substr( $admin_url, 5 );
						}
						$urls[] = $admin_url;
					}
				}
			}
		}

		echo wp_json_encode( $urls, JSON_PRETTY_PRINT );
	}

	/**
	 * Install demo data
	 *
	 * @throws \WP_CLI\ExitException //exit exception.
	 */
	public function install_demo_data( array $args, array $assoc_args ): void {
		// prevent phpcs warnings.
		unset( $args, $assoc_args );
		if ( ! $this->wp_cli_active() ) {
			return;
		}

		( new Admin() )->install_demo_data();
		\WP_CLI::success( 'Demo data installed' );
	}

	/**
	 * Reset data
	 */
	public function reset_data(): void {
		if ( ! $this->wp_cli_active() ) {
			return;
		}

		( new Admin() )->reset();
		\WP_CLI::success( 'Data reset' );
	}


	/**
	 * Activate license through CLI
	 *
	 * @throws \WP_CLI\ExitException //exit exception.
	 */
	public function activate_license( array $args, array $assoc_args ): void {
		if ( ! $this->wp_cli_active() ) {
			return;
		}

		if ( empty( $assoc_args ) ) {
			\WP_CLI::error( 'No license key passed' );
		}

		// retrieve license key from args or assoc_args.
		$license = $args[0] ?? false;
		if ( ! $license ) {
			\WP_CLI::error( 'No license key passed' );
		}

		if ( ! defined( 'BURST_PRO' ) ) {
			\WP_CLI::error( 'Not premium, no license required' );
		}

		update_site_option( 'burst_auto_installed_license', $license );
		( new Licensing() )->activate_license_after_auto_install();

		\WP_CLI::success( 'License activated' );
	}

	/**
	 * Deactivate license through CLI
	 *
	 * @throws \WP_CLI\ExitException //exit exception.
	 */
	public function deactivate_license( array $args, array $assoc_args ): void {
		if ( ! $this->wp_cli_active() ) {
			return;
		}

		if ( empty( $assoc_args ) ) {
			\WP_CLI::error( 'No license key passed' );
		}

		// retrieve license key from args or assoc_args.
		$license = $args[0] ?? false;
		if ( ! $license ) {
			\WP_CLI::error( 'No license key passed' );
		}

		if ( ! defined( 'BURST_PRO' ) ) {
			\WP_CLI::error( 'Not premium, no license required' );
		}

		update_site_option( 'burst_auto_installed_license', $license );
		( new Licensing() )->activate_license_after_auto_install();

		\WP_CLI::success( 'License activated' );
	}

	/**
	 * Save options through CLI
	 *
	 * @throws \WP_CLI\ExitException //exit exception.
	 */
	public function save( array $args, array $assoc_args ): void {
		if ( ! $this->wp_cli_active() ) {
			return;
		}

		if ( empty( $assoc_args ) ) {
			\WP_CLI::error( 'No options passed' );
		}

		foreach ( $assoc_args as $name => $value ) {
			$value = $value === 'true' ? true : $value;
			$this->update_option( $name, $value );
			( new Admin() )->create_js_file();
			// response used in test.
			\WP_CLI::success( "Option $name updated" );
		}
	}
}
