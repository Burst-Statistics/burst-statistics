<?php

require( 'class-installer.php' );

class BurstInstallerTest extends WP_UnitTestCase {
	/**
	 * @throws Exception
	 */
	public function setUp(): void {
		// Gitlab pipeline requires direct filesystem methods! Without FS_METHOD tests will fail
		if ( ! defined('FS_METHOD') ) {
			define('FS_METHOD', 'direct');
		}

		// Load WordPress environment
		// Make it suitable for localhost and pipeline
		$max_dirs = 10;
		// Let's locate wp-load.php, if not loaded already
		$found_wp_load = defined('WPINC');
		if ( ! $found_wp_load ) {
			for ($i = 1; $i <= $max_dirs; $i++) {
				$path = dirname(__FILE__, $i) . '/wp-load.php';
				if ( file_exists( $path ) ) {
					require_once($path);
					break;
				}
			}
		}


		// Set an active user, otherwise capability checks will fail
		$user_id = 1;
		// Create a partial mock of the WP_User class
		$user_mock = $this->createPartialMock(WP_User::class, ['exists']);
		$user_mock->method('exists')->willReturn(true);

		// Set the mocked user object as the current user
		wp_set_current_user($user_id, $user_mock);
		// Ensure user 1 has the required capability
		$user = wp_get_current_user();
		if ( ! $user->has_cap('manage_burst_statistics') ) {
			$user->add_cap('manage_burst_statistics');
		}

        // Activate any required plugins, account for multisite
        if ( ! is_multisite() ) {
            activate_plugin('burst.php');
        } else {
            activate_plugin('burst.php', '', true);
        }

	}

	public function test_plugin_installation() {

		$complianz_installer           = new burst_installer( 'complianz-gdpr' );
		$complianz_terms_installer     = new burst_installer( 'complianz-terms-conditions' );

		// Get clean after every download, otherwise issues with ob_level going up
		ob_get_clean();
        $this->assertTrue( $complianz_installer->download_plugin(), 'Download of complianz-gdpr plugin failed.' );
		ob_get_clean();
		$this->assertTrue( $complianz_terms_installer->download_plugin(), 'Download of complianz-terms-conditions plugin failed.' );
		ob_get_clean();

		$this->assertTrue( $complianz_installer->plugin_is_downloaded(), 'complianz-gdpr plugin is not downloaded.' );
		$this->assertTrue( $complianz_terms_installer->plugin_is_downloaded(), 'complianz-terms-conditions plugin is not downloaded.' );

		$this->assertTrue( $complianz_installer->activate_plugin(), 'Activation of complianz-gdpr plugin failed.' );
		$this->assertTrue( $complianz_terms_installer->activate_plugin(), 'Activation of complianz-terms-conditions plugin failed.' );

		$this->assertTrue( $complianz_installer->plugin_is_activated(), 'complianz-gdpr plugin is not activated.' );
		$this->assertTrue( $complianz_terms_installer->plugin_is_activated(), 'complianz-terms-conditions plugin is not activated.' );

	}
}