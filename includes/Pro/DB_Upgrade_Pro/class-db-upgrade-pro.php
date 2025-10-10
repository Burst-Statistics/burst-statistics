<?php
namespace Burst\Pro\DB_Upgrade_Pro;

use Burst\Admin\DB_Upgrade\DB_Upgrade;
use Burst\Pro\Pro_Statistics;
use Burst\Traits\Save;

defined( 'ABSPATH' ) || die();

/**
 * Extends the core DB_Upgrade class to add Pro-specific upgrade functionality
 */
class DB_Upgrade_Pro extends DB_Upgrade {
	use Save;

	/**
	 * Init for the DB_Upgrade class.
	 */
	public function init(): void {
		parent::init();
		add_filter( 'burst_db_upgrades', [ $this, 'add_pro_upgrades' ], 10, 2 );
		add_filter( 'burst_upgrade_pro_iteration', [ $this, 'maybe_handle_pro_upgrades' ] );
	}

	/**
	 * Add Pro-specific database upgrades to the upgrade list
	 *
	 * @param array $upgrades The existing upgrades.
	 * @return array<string, string[]> The modified upgrades list with Pro-specific upgrades.
	 */
	public function add_pro_upgrades( array $upgrades ): array {
		// Add Pro-specific upgrades here.
		$pro_upgrades = [
			'2.2.0' => [
				'pro_to_city_database',
				'pro_country_code_to_lookup_table',
			],
			// Add more version-specific upgrades as needed.
		];

		// Merge Pro upgrades with core upgrades.
		foreach ( $pro_upgrades as $version => $version_upgrades ) {
			if ( isset( $upgrades[ $version ] ) ) {
				// Merge with existing version upgrades.
				$upgrades[ $version ] = array_merge( $upgrades[ $version ], $version_upgrades );
			} else {
				// Add new version upgrades.
				$upgrades[ $version ] = $version_upgrades;
			}
		}

		return $upgrades;
	}

	/**
	 * Handle Pro-specific upgrades when they are being processed
	 */
	public function maybe_handle_pro_upgrades(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		$upgrade_running = get_transient( 'burst_upgrade_running' );
		if ( $upgrade_running ) {
			return;
		}

		// Get the current upgrade that needs to be processed.
		$db_upgrades = $this->get_db_upgrades( 'pro', 'all' );
		$do_upgrade  = false;
		foreach ( $db_upgrades as $upgrade ) {
			if ( get_option( "burst_db_upgrade_$upgrade" ) ) {
				$do_upgrade = $upgrade;
				break;
			}
		}
		// Handle Pro-specific upgrades.
		if ( 'pro_to_city_database' === $do_upgrade ) {
			$this->upgrade_to_city_database();
		}

		if ( 'pro_country_code_to_lookup_table' === $do_upgrade ) {
			$this->upgrade_country_code_to_lookup_table();
		}
	}

	/**
	 * Upgrade existing Country database installations to City database
	 */
	private function upgrade_to_city_database(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		$option_name = 'burst_db_upgrade_pro_to_city_database';
		if ( ! get_option( $option_name ) ) {
			return;
		}

		$geo_ip_database_type = self::get_option( 'geo_ip_database_type', 'country' );
		// Set default database type to city if not already set.
		if ( $geo_ip_database_type !== 'city' ) {
			$this->update_option( 'burst_geo_ip_database_type', 'city' );
			// set update time in utc.
			$this->update_option( 'burst_update_to_city_geo_database_time', time() );
		}

		delete_option( $option_name );
	}

	/**
	 * Upgrade country code to lookup table
	 */
	private function upgrade_country_code_to_lookup_table(): void {
		if ( ! $this->has_admin_access() ) {
			return;
		}

		$option_name = 'burst_db_upgrade_pro_country_code_to_lookup_table';
		if ( ! get_option( $option_name ) ) {
			return;
		}

		global $wpdb;
		if ( ! $this->table_exists( 'burst_locations' ) ) {
			return;
		}

		if ( ! $this->column_exists( 'burst_sessions', 'country_code' ) ) {
			delete_option( $option_name );
			return;
		}

		$country_list = Pro_Statistics::get_country_list();
		// Prepare values for bulk insert.
		$values = [];
		$i      = -1;
		foreach ( $country_list as $country_code => $country_name ) {
			$values[] = $wpdb->prepare(
				'(%d, %s, %s, %s)',
				$i,
				'',
				'',
				$country_code
			);
			--$i;
		}

		// Combine the values into a single query.
		if ( ! empty( $values ) ) {
			$query = "
		INSERT INTO {$wpdb->prefix}burst_locations
		(city_code, city, state, country_code)
		VALUES " . implode( ', ', $values );

			$wpdb->query( $query );
		}

		// Now we need to update wp_burst_sessions to use the city_code and remove the country_code. First we need to add the city_codes based on the country code.
		// update every country one by one based one the $country_list.
		foreach ( $country_list as $country_code => $country_name ) {
			$city_code = $wpdb->get_var(
				$wpdb->prepare(
					"SELECT city_code FROM {$wpdb->prefix}burst_locations WHERE country_code = %s",
					$country_code
				)
			);
			if ( ! $city_code ) {
				continue;
			}

			// Now we need to update wp_burst_sessions to use the city_code and remove the country_code.
			$wpdb->query(
				$wpdb->prepare(
					"UPDATE {$wpdb->prefix}burst_sessions
			SET city_code = %d, country_code = NULL
			WHERE country_code = %s",
					$city_code,
					$country_code
				)
			);
		}
		// if all country_codes are null, we can remove the column.
		if ( $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}burst_sessions WHERE country_code IS NOT NULL" ) === 0 ) {
			$wpdb->query( "ALTER TABLE {$wpdb->prefix}burst_sessions DROP COLUMN country_code" );
		}

		delete_option( $option_name );
	}
}
