<?php
namespace Burst\Admin\Statistics;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

/**
 * Core geo statistics.
 *
 * Owns the country-level location layer that is shared with the free plugin so
 * country tracking works without Pro: the burst_locations lookup table, the
 * country/continent lists, and the geo query layer (country/state/city/continent
 * metrics, the locations join, geo filters and geo data endpoints). Pro adds
 * city/region detail on top via its own Statistics registrations.
 */
class Geo_Statistics {
	use Helper;
	use Admin_Helper;
	use Database_Helper;

	/**
	 * Register the geo hooks.
	 */
	public function init(): void {
		add_filter( 'burst_localize_script', [ $this, 'add_countries_to_localize_script' ], 10, 1 );
		add_filter( 'burst_allowed_metrics', [ $this, 'add_geo_metrics' ], 10, 2 );
		add_filter( 'burst_select_sql_for_metric', [ $this, 'geo_select_sql' ], 10, 3 );
		$this->register_geo_joins();
		$this->register_geo_filters();
		add_filter( 'burst_filter_validation_config', [ $this, 'add_geo_filter_validation_config' ], 10, 1 );
		add_action( 'burst_statistics_query', [ $this, 'extend_geo_query' ], 10 );
		add_filter( 'burst_live_traffic_args', [ $this, 'add_country_to_live_traffic' ], 10, 1 );
		add_action( 'burst_install_tables', [ $this, 'install_locations_table' ], 10 );
		add_filter( 'burst_countries', [ self::class, 'get_country_list' ] );
		add_filter( 'burst_continents', [ self::class, 'get_continent_list' ] );
		add_filter( 'burst_mail_report_results', [ $this, 'enrich_country_results' ], 10, 4 );
		add_filter( 'burst_get_data', [ $this, 'get_geo_data_handler' ], 10, 4 );
		add_filter( 'burst_get_data_available_args', [ $this, 'add_geo_available_args' ], 10, 2 );
		add_filter( 'burst_sanitize_arg', [ $this, 'sanitize_geo_args' ], 10, 3 );
	}

	/**
	 * Add the country code to the live traffic query.
	 */
	public function add_country_to_live_traffic( Statistics_Query $qd ): Statistics_Query {
		$qd->with( 'locations' )->append_custom_select( ', locations.country_code', [] );
		return $qd;
	}

	/**
	 * Route geo data requests through the geo query.
	 *
	 * @param array            $data    Data collected so far.
	 * @param string           $type    The data type.
	 * @param array            $args    Arguments for data retrieval.
	 * @param \WP_REST_Request $request The original request.
	 * @return array The processed data.
	 */
	public function get_geo_data_handler( array $data, string $type, array $args, \WP_REST_Request $request ): array {
		unset( $request );
		if ( $type === 'geo' ) {
			return $this->get_geo_data( $args );
		}
		return $data;
	}

	/**
	 * Add geo-specific available arguments for data types.
	 *
	 * @param array  $args Existing arguments.
	 * @param string $type The data type.
	 * @return array<int, string> Extended arguments.
	 */
	public function add_geo_available_args( array $args, string $type ): array {
		if ( $type === 'geo' ) {
			$args[] = 'currentView';
		}
		return $args;
	}

	/**
	 * Sanitize geo-specific arguments.
	 *
	 * @param mixed  $sanitized_value The sanitized value (null if not handled yet).
	 * @param string $arg The argument name.
	 * @param mixed  $value The value to sanitize.
	 * @return mixed Sanitized value or null if not handled.
	 */
	// have to allow mixed values here.
	// phpcs:disable
	public function sanitize_geo_args( $sanitized_value, string $arg, $value ) {
		// phpcs:enable
		// If already sanitized by another handler, return it.
		if ( $sanitized_value !== null ) {
			return $sanitized_value;
		}

		if ( $arg === 'currentView' ) {
			/**
			 * Current view contains an array with level and id.
			 * Level is the level of the view | world, continent, country.
			 * Id is the id of the view | empty or the iso_a2 value, checked against get_country_list().
			 * Always return level: 'world' and id: null if the level or id is not allowed.
			 */
			if ( ! is_array( $value ) ) {
				self::error_log( 'Invalid currentView format: expected array, got ' . gettype( $value ) );
				return [
					'level' => 'world',
					'id'    => null,
				];
			}

			$allowed_levels = [ 'world', 'continent', 'country' ];
			$allowed_ids    = array_keys( self::get_country_list() );

			$level = $value['level'] ?? 'world';
			$id    = $value['id'] ?? null;

			if ( ! in_array( $level, $allowed_levels, true ) ) {
				self::error_log( 'Invalid level: ' . $level );
				$level = 'world';
			}

			if ( $id !== null && ! in_array( $id, $allowed_ids, true ) ) {
				self::error_log( 'Invalid id: ' . $id );
				$id = null;
			}

			return [
				'level' => $level,
				'id'    => $id,
			];
		}

		// Let other handlers or default sanitization handle it.
		return null;
	}

	/**
	 * Add geo metrics.
	 *
	 * @param array<string, string> $metrics Existing metrics.
	 * @param bool                  $strict  Whether to enforce strict metric validation.
	 * @return array<string, string> Metrics with added geo options.
	 */
	public function add_geo_metrics( array $metrics, bool $strict ): array {
		if ( $strict ) {
			return $metrics;
		}
		$metrics['country_code'] = 'Country';
		$metrics['state_code']   = 'State';
		$metrics['city']         = 'City';
		$metrics['state']        = 'State';
		$metrics['continent']    = 'Continent';

		return $metrics;
	}

	/**
	 * Register the geo named joins with Join_Registry.
	 */
	private function register_geo_joins(): void {
		Join_Registry::register(
			'locations',
			[
				'table'      => 'burst_locations',
				'on'         => 'sessions.city_code = locations.city_code',
				'type'       => 'LEFT',
				'depends_on' => [ 'sessions' ],
			]
		);
	}

	/**
	 * Register geo filter key → qualified SQL column mappings with Filter_Registry.
	 */
	private function register_geo_filters(): void {
		$geo_filters = [
			'country_code'   => 'locations.country_code',
			'city'           => 'locations.city',
			'state'          => 'locations.state',
			'continent_code' => 'locations.continent_code',
		];
		foreach ( $geo_filters as $key => $column ) {
			Filter_Registry::register( $key, $column );
		}
	}

	/**
	 * Provide select SQL for geo metrics.
	 *
	 * Chain-safe: returns the incoming $sql untouched when the metric is not a
	 * geo metric, so other handlers (e.g. Pro campaigns/ecommerce) can resolve it.
	 *
	 * @param string           $sql    SQL accumulated by earlier handlers.
	 * @param string           $metric The metric being resolved.
	 * @param Statistics_Query $qd     The query object.
	 * @return string The select SQL.
	 */
	public function geo_select_sql( string $sql, string $metric, Statistics_Query $qd ): string {
		if ( $sql !== '' ) {
			return $sql;
		}
		if ( $metric === 'country_code' ) {
			$qd->with( 'locations' );
			return 'locations.country_code';
		}
		if ( $metric === 'city' ) {
			$qd->with( 'locations' );
			return 'locations.city';
		}
		if ( $metric === 'city_code' ) {
			$qd->with( 'locations' );
			return 'locations.city_code';
		}
		if ( $metric === 'state' ) {
			$qd->with( 'locations' );
			return 'locations.state';
		}
		if ( $metric === 'state_code' ) {
			$qd->with( 'locations' );
			return 'locations.state_code';
		}
		if ( $metric === 'continent' ) {
			$qd->with( 'locations' );
			return 'locations.continent_code';
		}
		return $sql;
	}

	/**
	 * Extend Statistics_Query with geo-specific WHERE conditions.
	 *
	 * Appends to any existing custom WHERE so it composes with other
	 * burst_statistics_query handlers (e.g. Pro) regardless of order.
	 *
	 * @param Statistics_Query $qd Query object.
	 */
	public function extend_geo_query( Statistics_Query $qd ): void {
		$data_select = $qd->get_select();
		$where       = $qd->get_custom_where();
		$before      = $where;

		if ( in_array( 'country_code', $data_select, true ) ) {
			$where .= ' AND locations.country_code IS NOT NULL';
		}
		if ( in_array( 'state_code', $data_select, true ) ) {
			$where .= ' AND locations.state_code IS NOT NULL';
		}
		if ( in_array( 'continent_code', $data_select, true ) ) {
			$where .= ' AND locations.continent_code IS NOT NULL';
		}

		if ( $where !== $before ) {
			$qd->set_custom_where( $where, [] );
		}
	}

	/**
	 * Add geo filter validation config.
	 *
	 * @param array $config Existing validation config.
	 * @return array Config including geo filters.
	 */
	public function add_geo_filter_validation_config( array $config ): array {
		$geo_config = [
			'country_code' => [
				'sanitize' => [ $this, 'sanitize_country_code' ],
				'type'     => 'string',
			],
			'city'         => [
				'sanitize' => 'sanitize_text_field',
				'type'     => 'string',
			],
			'city_code'    => [
				'sanitize' => 'sanitize_text_field',
				'type'     => 'string',
			],
			'state'        => [
				'sanitize' => 'sanitize_text_field',
				'type'     => 'string',
			],
			'state_code'   => [
				'sanitize' => 'sanitize_text_field',
				'type'     => 'string',
			],
			'continent'    => [
				'sanitize' => [ $this, 'sanitize_continent_code' ],
				'type'     => 'string',
			],
		];

		return array_merge( $config, $geo_config );
	}

	/**
	 * Sanitize country code filter value.
	 *
	 * @param string $country_code Country code to sanitize.
	 * @return string Sanitized country code.
	 */
	public function sanitize_country_code( string $country_code ): string {
		$country_code      = strtoupper( sanitize_text_field( $country_code ) );
		$allowed_countries = array_keys( self::get_country_list() );

		if ( in_array( $country_code, $allowed_countries, true ) ) {
			return $country_code;
		}
		self::error_log( 'Country code is not allowed: ' . $country_code );
		return '';
	}

	/**
	 * Sanitize continent code filter value.
	 *
	 * @param string $continent_code Continent code to sanitize.
	 * @return string Sanitized continent code.
	 */
	public function sanitize_continent_code( string $continent_code ): string {
		$continent_code     = strtoupper( sanitize_text_field( $continent_code ) );
		$allowed_continents = array_keys( self::get_continent_list() );

		if ( in_array( $continent_code, $allowed_continents, true ) ) {
			return $continent_code;
		}
		self::error_log( 'Continent code is not allowed: ' . $continent_code );
		return '';
	}

	/**
	 * Get country nice name.
	 */
	public static function get_country_nice_name( string $country_code ): string {
		$country_list = self::get_country_list();
		if ( empty( $country_code ) ) {
			return __( 'Unknown', 'burst-statistics' );
		}
		$country_code = strtoupper( $country_code );
		return $country_list[ $country_code ] ?? __( 'Unknown', 'burst-statistics' );
	}

	/**
	 * Get continent nice name.
	 */
	public static function get_continent_nice_name( string $continent_code ): string {
		$continent_list = self::get_continent_list();
		if ( empty( $continent_code ) ) {
			return __( 'Unknown', 'burst-statistics' );
		}
		$continent_code = strtoupper( $continent_code );
		return $continent_list[ $continent_code ] ?? __( 'Unknown', 'burst-statistics' );
	}

	/**
	 * Add countries and continents to the localized script.
	 *
	 * @param array<string, mixed> $localize_script The script localization array.
	 * @return array<string, mixed> The modified localization array.
	 */
	public function add_countries_to_localize_script( array $localize_script ): array {
		$localize_script['countries']  = self::get_country_list();
		$localize_script['continents'] = self::get_continent_list();

		return $localize_script;
	}

	/**
	 * Enrich country_code email-report results with localized country names.
	 *
	 * @param array<int, array<string, mixed>> $results The raw top results.
	 * @param Statistics_Query                 $qd      Query data object.
	 * @param int                              $start   Start timestamp.
	 * @param int                              $end     End timestamp.
	 * @return array<int, array<int|string, mixed>> Passthrough results, or results with nice country names.
	 */
	public function enrich_country_results( array $results, Statistics_Query $qd, int $start, int $end ): array {
		unset( $start, $end );
		if ( ! in_array( 'country_code', $qd->get_select(), true ) ) {
			return $results;
		}

		$countries = [];
		foreach ( $results as $country ) {
			$country_code = empty( $country['country_code'] ) ? '' : $country['country_code'];
			$countries[]  = [ self::get_country_nice_name( $country_code ), $country['pageviews'] ];
		}

		return $countries;
	}

	/**
	 * Get geographical data for analytics.
	 *
	 * @param array $args Arguments for geo data retrieval.
	 * @return array<int, array<string, mixed>> Geo data results.
	 */
	public function get_geo_data( array $args = [] ): array {
		$defaults = [
			'date_start'  => 0,
			'date_end'    => 0,
			'metrics'     => [ 'pageviews', 'visitors' ],
			// Ensure filters are initialized.
			'filters'     => [],
			'currentView' => [
				'level' => 'world',
				'id'    => null,
			],
		];

		$args = wp_parse_args( $args, $defaults );

		if ( $args['currentView']['level'] === 'country' ) {
			// Add country_code to filters and state_code to select.
			$args['filters']['country_code'] = $args['currentView']['id'];
			$args['metrics'][]               = 'country_code';
			$args['metrics'][]               = 'state_code';
			$query_id                        = 'statistics_map_data_country';
			$query_args                      = [
				'id'         => 'statistics_map_data_country',
				'date_start' => $args['date_start'],
				'date_end'   => $args['date_end'],
				'select'     => $args['metrics'],
				'filters'    => $args['filters'],
				'group_by'   => 'state_code',
				'limit'      => 0,
			];
		} else {
			$args['metrics'][] = 'country_code';
			$query_id          = 'statistics_map_data_world';
			$query_args        = [
				'id'         => 'statistics_map_data_world',
				'date_start' => $args['date_start'],
				'date_end'   => $args['date_end'],
				'select'     => $args['metrics'],
				'filters'    => $args['filters'],
				'group_by'   => 'country_code',
				'limit'      => 0,
			];
		}

		$qd = Statistics_Query::create( $query_id )
			->date_range( (int) $query_args['date_start'], (int) $query_args['date_end'] )
			->select( $query_args['select'] )
			->filters( $query_args['filters'] )
			->group_by( $query_args['group_by'] )
			->limit( $query_args['limit'] );

		return $qd->fetch( ARRAY_A );
	}

	/**
	 * Install locations table.
	 */
	public function install_locations_table(): void {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		global $wpdb;
		$charset_collate = $wpdb->get_charset_collate();
		$table_name      = $wpdb->prefix . 'burst_locations';

		// Create table with city_code as primary key.
		$sql = "CREATE TABLE `$table_name` (
            `city_code` int DEFAULT 0,
            `city` varchar(255) DEFAULT '',
            `state_code` varchar(18) DEFAULT '',
            `state` varchar(255) DEFAULT '',
            `country_code` char(2) DEFAULT '',
            `continent_code` char(5) NOT NULL DEFAULT '',
            PRIMARY KEY  (`city_code`)
        ) $charset_collate;";

		dbDelta( $sql );
		if ( ! empty( $wpdb->last_error ) ) {
			self::error_log( 'Error creating locations table: ' . $wpdb->last_error );
			return;
		}

		// Add indexes for performance.
		$indexes = [
			[ 'country_code' ],
			[ 'state_code' ],
			[ 'city' ],
		];

		foreach ( $indexes as $index ) {
			$this->add_index( 'burst_locations', $index );
		}

		$this->seed_country_lookup_rows();
	}

	/**
	 * Seed burst_locations with one negative-city_code row per country.
	 *
	 * Country-only tracking stores a negative city_code per country; this lookup
	 * lets the tracker resolve a country to its city_code (see
	 * Tracking_GeoIp::add_location_data). Runs on install and upgrade and is
	 * idempotent: existing rows are kept (INSERT IGNORE on the city_code primary
	 * key), so it is safe for City (Pro) installs that already hold these rows.
	 */
	private function seed_country_lookup_rows(): void {
		global $wpdb;

		$country_list = self::get_country_list();
		$values       = [];
		$i            = -1;
		foreach ( $country_list as $country_code => $country_name ) {
			$values[] = $wpdb->prepare( '(%d, %s, %s, %s)', $i, '', '', $country_code );
			--$i;
		}

		if ( ! empty( $values ) ) {
			// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- values prepared above.
			$wpdb->query( "INSERT IGNORE INTO {$wpdb->prefix}burst_locations (city_code, city, state, country_code) VALUES " . implode( ', ', $values ) );
		}
	}

	/**
	 * Get country list
	 *
	 * @return array<string, string> Associative array of country codes and names.
	 */
	public static function get_country_list(): array {
		return [
			'LO' => __( 'Localhost', 'burst-statistics' ),
			'AF' => __( 'Afghanistan', 'burst-statistics' ),
			'AX' => __( 'Aland Islands', 'burst-statistics' ),
			'AL' => __( 'Albania', 'burst-statistics' ),
			'DZ' => __( 'Algeria', 'burst-statistics' ),
			'AS' => __( 'American Samoa', 'burst-statistics' ),
			'AD' => __( 'Andorra', 'burst-statistics' ),
			'AO' => __( 'Angola', 'burst-statistics' ),
			'AI' => __( 'Anguilla', 'burst-statistics' ),
			'AQ' => __( 'Antarctica', 'burst-statistics' ),
			'AG' => __( 'Antigua and Barbuda', 'burst-statistics' ),
			'AR' => __( 'Argentina', 'burst-statistics' ),
			'AM' => __( 'Armenia', 'burst-statistics' ),
			'AW' => __( 'Aruba', 'burst-statistics' ),
			'AU' => __( 'Australia', 'burst-statistics' ),
			'AT' => __( 'Austria', 'burst-statistics' ),
			'AZ' => __( 'Azerbaijan', 'burst-statistics' ),
			'BS' => __( 'Bahamas', 'burst-statistics' ),
			'BH' => __( 'Bahrain', 'burst-statistics' ),
			'BD' => __( 'Bangladesh', 'burst-statistics' ),
			'BB' => __( 'Barbados', 'burst-statistics' ),
			'BY' => __( 'Belarus', 'burst-statistics' ),
			'BE' => __( 'Belgium', 'burst-statistics' ),
			'BZ' => __( 'Belize', 'burst-statistics' ),
			'BJ' => __( 'Benin', 'burst-statistics' ),
			'BM' => __( 'Bermuda', 'burst-statistics' ),
			'BT' => __( 'Bhutan', 'burst-statistics' ),
			'BO' => __( 'Bolivia', 'burst-statistics' ),
			'BQ' => __( 'Bonaire, Sint Eustatius and Saba', 'burst-statistics' ),
			'BA' => __( 'Bosnia and Herzegovina', 'burst-statistics' ),
			'BW' => __( 'Botswana', 'burst-statistics' ),
			'BV' => __( 'Bouvet Island', 'burst-statistics' ),
			'BR' => __( 'Brazil', 'burst-statistics' ),
			'IO' => __( 'British Indian Ocean Territory', 'burst-statistics' ),
			'BN' => __( 'Brunei Darussalam', 'burst-statistics' ),
			'BG' => __( 'Bulgaria', 'burst-statistics' ),
			'BF' => __( 'Burkina Faso', 'burst-statistics' ),
			'BI' => __( 'Burundi', 'burst-statistics' ),
			'KH' => __( 'Cambodia', 'burst-statistics' ),
			'CM' => __( 'Cameroon', 'burst-statistics' ),
			'CA' => __( 'Canada', 'burst-statistics' ),
			'CV' => __( 'Cape Verde', 'burst-statistics' ),
			'KY' => __( 'Cayman Islands', 'burst-statistics' ),
			'CF' => __( 'Central African Republic', 'burst-statistics' ),
			'TD' => __( 'Chad', 'burst-statistics' ),
			'CL' => __( 'Chile', 'burst-statistics' ),
			'CN' => __( 'China', 'burst-statistics' ),
			'CX' => __( 'Christmas Island', 'burst-statistics' ),
			'CC' => __( 'Cocos (Keeling) Islands', 'burst-statistics' ),
			'CO' => __( 'Colombia', 'burst-statistics' ),
			'KM' => __( 'Comoros', 'burst-statistics' ),
			'CG' => __( 'Congo', 'burst-statistics' ),
			'CD' => __( 'Congo, Democratic Republic of the Congo', 'burst-statistics' ),
			'CK' => __( 'Cook Islands', 'burst-statistics' ),
			'CR' => __( 'Costa Rica', 'burst-statistics' ),
			'CI' => __( "Cote D'Ivoire", 'burst-statistics' ),
			'HR' => __( 'Croatia', 'burst-statistics' ),
			'CU' => __( 'Cuba', 'burst-statistics' ),
			'CW' => __( 'Curacao', 'burst-statistics' ),
			'CY' => __( 'Cyprus', 'burst-statistics' ),
			'CZ' => __( 'Czech Republic', 'burst-statistics' ),
			'DK' => __( 'Denmark', 'burst-statistics' ),
			'DJ' => __( 'Djibouti', 'burst-statistics' ),
			'DM' => __( 'Dominica', 'burst-statistics' ),
			'DO' => __( 'Dominican Republic', 'burst-statistics' ),
			'EC' => __( 'Ecuador', 'burst-statistics' ),
			'EG' => __( 'Egypt', 'burst-statistics' ),
			'SV' => __( 'El Salvador', 'burst-statistics' ),
			'GQ' => __( 'Equatorial Guinea', 'burst-statistics' ),
			'ER' => __( 'Eritrea', 'burst-statistics' ),
			'EE' => __( 'Estonia', 'burst-statistics' ),
			'ET' => __( 'Ethiopia', 'burst-statistics' ),
			'FK' => __( 'Falkland Islands (Malvinas)', 'burst-statistics' ),
			'FO' => __( 'Faroe Islands', 'burst-statistics' ),
			'FJ' => __( 'Fiji', 'burst-statistics' ),
			'FI' => __( 'Finland', 'burst-statistics' ),
			'FR' => __( 'France', 'burst-statistics' ),
			'GF' => __( 'French Guiana', 'burst-statistics' ),
			'PF' => __( 'French Polynesia', 'burst-statistics' ),
			'TF' => __( 'French Southern Territories', 'burst-statistics' ),
			'GA' => __( 'Gabon', 'burst-statistics' ),
			'GM' => __( 'Gambia', 'burst-statistics' ),
			'GE' => __( 'Georgia', 'burst-statistics' ),
			'DE' => __( 'Germany', 'burst-statistics' ),
			'GH' => __( 'Ghana', 'burst-statistics' ),
			'GI' => __( 'Gibraltar', 'burst-statistics' ),
			'GR' => __( 'Greece', 'burst-statistics' ),
			'GL' => __( 'Greenland', 'burst-statistics' ),
			'GD' => __( 'Grenada', 'burst-statistics' ),
			'GP' => __( 'Guadeloupe', 'burst-statistics' ),
			'GU' => __( 'Guam', 'burst-statistics' ),
			'GT' => __( 'Guatemala', 'burst-statistics' ),
			'GG' => __( 'Guernsey', 'burst-statistics' ),
			'GN' => __( 'Guinea', 'burst-statistics' ),
			'GW' => __( 'Guinea-Bissau', 'burst-statistics' ),
			'GY' => __( 'Guyana', 'burst-statistics' ),
			'HT' => __( 'Haiti', 'burst-statistics' ),
			'HM' => __( 'Heard Island and McDonald Islands', 'burst-statistics' ),
			'VA' => __( 'Holy See (Vatican City State)', 'burst-statistics' ),
			'HN' => __( 'Honduras', 'burst-statistics' ),
			'HK' => __( 'Hong Kong', 'burst-statistics' ),
			'HU' => __( 'Hungary', 'burst-statistics' ),
			'IS' => __( 'Iceland', 'burst-statistics' ),
			'IN' => __( 'India', 'burst-statistics' ),
			'ID' => __( 'Indonesia', 'burst-statistics' ),
			'IR' => __( 'Iran, Islamic Republic of', 'burst-statistics' ),
			'IQ' => __( 'Iraq', 'burst-statistics' ),
			'IE' => __( 'Ireland', 'burst-statistics' ),
			'IM' => __( 'Isle of Man', 'burst-statistics' ),
			'IL' => __( 'Israel', 'burst-statistics' ),
			'IT' => __( 'Italy', 'burst-statistics' ),
			'JM' => __( 'Jamaica', 'burst-statistics' ),
			'JP' => __( 'Japan', 'burst-statistics' ),
			'JE' => __( 'Jersey', 'burst-statistics' ),
			'JO' => __( 'Jordan', 'burst-statistics' ),
			'KZ' => __( 'Kazakhstan', 'burst-statistics' ),
			'KE' => __( 'Kenya', 'burst-statistics' ),
			'KI' => __( 'Kiribati', 'burst-statistics' ),
			'KP' => __( "Korea, Democratic People's Republic of", 'burst-statistics' ),
			'KR' => __( 'Korea, Republic of', 'burst-statistics' ),
			'XK' => __( 'Kosovo', 'burst-statistics' ),
			'KW' => __( 'Kuwait', 'burst-statistics' ),
			'KG' => __( 'Kyrgyzstan', 'burst-statistics' ),
			'LA' => __( "Lao People's Democratic Republic", 'burst-statistics' ),
			'LV' => __( 'Latvia', 'burst-statistics' ),
			'LB' => __( 'Lebanon', 'burst-statistics' ),
			'LS' => __( 'Lesotho', 'burst-statistics' ),
			'LR' => __( 'Liberia', 'burst-statistics' ),
			'LY' => __( 'Libyan Arab Jamahiriya', 'burst-statistics' ),
			'LI' => __( 'Liechtenstein', 'burst-statistics' ),
			'LT' => __( 'Lithuania', 'burst-statistics' ),
			'LU' => __( 'Luxembourg', 'burst-statistics' ),
			'MO' => __( 'Macao', 'burst-statistics' ),
			'MK' => __( 'Macedonia, the Former Yugoslav Republic of', 'burst-statistics' ),
			'MG' => __( 'Madagascar', 'burst-statistics' ),
			'MW' => __( 'Malawi', 'burst-statistics' ),
			'MY' => __( 'Malaysia', 'burst-statistics' ),
			'MV' => __( 'Maldives', 'burst-statistics' ),
			'ML' => __( 'Mali', 'burst-statistics' ),
			'MT' => __( 'Malta', 'burst-statistics' ),
			'MH' => __( 'Marshall Islands', 'burst-statistics' ),
			'MQ' => __( 'Martinique', 'burst-statistics' ),
			'MR' => __( 'Mauritania', 'burst-statistics' ),
			'MU' => __( 'Mauritius', 'burst-statistics' ),
			'YT' => __( 'Mayotte', 'burst-statistics' ),
			'MX' => __( 'Mexico', 'burst-statistics' ),
			'FM' => __( 'Micronesia, Federated States of', 'burst-statistics' ),
			'MD' => __( 'Moldova, Republic of', 'burst-statistics' ),
			'MC' => __( 'Monaco', 'burst-statistics' ),
			'MN' => __( 'Mongolia', 'burst-statistics' ),
			'ME' => __( 'Montenegro', 'burst-statistics' ),
			'MS' => __( 'Montserrat', 'burst-statistics' ),
			'MA' => __( 'Morocco', 'burst-statistics' ),
			'MZ' => __( 'Mozambique', 'burst-statistics' ),
			'MM' => __( 'Myanmar', 'burst-statistics' ),
			'NA' => __( 'Namibia', 'burst-statistics' ),
			'NR' => __( 'Nauru', 'burst-statistics' ),
			'NP' => __( 'Nepal', 'burst-statistics' ),
			'NL' => __( 'Netherlands', 'burst-statistics' ),
			'AN' => __( 'Netherlands Antilles', 'burst-statistics' ),
			'NC' => __( 'New Caledonia', 'burst-statistics' ),
			'NZ' => __( 'New Zealand', 'burst-statistics' ),
			'NI' => __( 'Nicaragua', 'burst-statistics' ),
			'NE' => __( 'Niger', 'burst-statistics' ),
			'NG' => __( 'Nigeria', 'burst-statistics' ),
			'NU' => __( 'Niue', 'burst-statistics' ),
			'NF' => __( 'Norfolk Island', 'burst-statistics' ),
			'MP' => __( 'Northern Mariana Islands', 'burst-statistics' ),
			'NO' => __( 'Norway', 'burst-statistics' ),
			'OM' => __( 'Oman', 'burst-statistics' ),
			'PK' => __( 'Pakistan', 'burst-statistics' ),
			'PW' => __( 'Palau', 'burst-statistics' ),
			'PS' => __( 'Palestinian Territory, Occupied', 'burst-statistics' ),
			'PA' => __( 'Panama', 'burst-statistics' ),
			'PG' => __( 'Papua New Guinea', 'burst-statistics' ),
			'PY' => __( 'Paraguay', 'burst-statistics' ),
			'PE' => __( 'Peru', 'burst-statistics' ),
			'PH' => __( 'Philippines', 'burst-statistics' ),
			'PN' => __( 'Pitcairn', 'burst-statistics' ),
			'PL' => __( 'Poland', 'burst-statistics' ),
			'PT' => __( 'Portugal', 'burst-statistics' ),
			'PR' => __( 'Puerto Rico', 'burst-statistics' ),
			'QA' => __( 'Qatar', 'burst-statistics' ),
			'RE' => __( 'Reunion', 'burst-statistics' ),
			'RO' => __( 'Romania', 'burst-statistics' ),
			'RU' => __( 'Russian Federation', 'burst-statistics' ),
			'RW' => __( 'Rwanda', 'burst-statistics' ),
			'BL' => __( 'Saint Barthelemy', 'burst-statistics' ),
			'SH' => __( 'Saint Helena', 'burst-statistics' ),
			'KN' => __( 'Saint Kitts and Nevis', 'burst-statistics' ),
			'LC' => __( 'Saint Lucia', 'burst-statistics' ),
			'MF' => __( 'Saint Martin', 'burst-statistics' ),
			'PM' => __( 'Saint Pierre and Miquelon', 'burst-statistics' ),
			'VC' => __( 'Saint Vincent and the Grenadines', 'burst-statistics' ),
			'WS' => __( 'Samoa', 'burst-statistics' ),
			'SM' => __( 'San Marino', 'burst-statistics' ),
			'ST' => __( 'Sao Tome and Principe', 'burst-statistics' ),
			'SA' => __( 'Saudi Arabia', 'burst-statistics' ),
			'SN' => __( 'Senegal', 'burst-statistics' ),
			'RS' => __( 'Serbia', 'burst-statistics' ),
			'CS' => __( 'Serbia and Montenegro', 'burst-statistics' ),
			'SC' => __( 'Seychelles', 'burst-statistics' ),
			'SL' => __( 'Sierra Leone', 'burst-statistics' ),
			'SG' => __( 'Singapore', 'burst-statistics' ),
			'SX' => __( 'St Martin', 'burst-statistics' ),
			'SK' => __( 'Slovakia', 'burst-statistics' ),
			'SI' => __( 'Slovenia', 'burst-statistics' ),
			'SB' => __( 'Solomon Islands', 'burst-statistics' ),
			'SO' => __( 'Somalia', 'burst-statistics' ),
			'ZA' => __( 'South Africa', 'burst-statistics' ),
			'GS' => __( 'South Georgia and the South Sandwich Islands', 'burst-statistics' ),
			'SS' => __( 'South Sudan', 'burst-statistics' ),
			'ES' => __( 'Spain', 'burst-statistics' ),
			'LK' => __( 'Sri Lanka', 'burst-statistics' ),
			'SD' => __( 'Sudan', 'burst-statistics' ),
			'SR' => __( 'Suriname', 'burst-statistics' ),
			'SJ' => __( 'Svalbard and Jan Mayen', 'burst-statistics' ),
			'SZ' => __( 'Swaziland', 'burst-statistics' ),
			'SE' => __( 'Sweden', 'burst-statistics' ),
			'CH' => __( 'Switzerland', 'burst-statistics' ),
			'SY' => __( 'Syrian Arab Republic', 'burst-statistics' ),
			'TW' => __( 'Taiwan', 'burst-statistics' ),
			'TJ' => __( 'Tajikistan', 'burst-statistics' ),
			'TZ' => __( 'Tanzania, United Republic of', 'burst-statistics' ),
			'TH' => __( 'Thailand', 'burst-statistics' ),
			'TL' => __( 'Timor-Leste', 'burst-statistics' ),
			'TG' => __( 'Togo', 'burst-statistics' ),
			'TK' => __( 'Tokelau', 'burst-statistics' ),
			'TO' => __( 'Tonga', 'burst-statistics' ),
			'TT' => __( 'Trinidad and Tobago', 'burst-statistics' ),
			'TN' => __( 'Tunisia', 'burst-statistics' ),
			'TR' => __( 'Turkey', 'burst-statistics' ),
			'TM' => __( 'Turkmenistan', 'burst-statistics' ),
			'TC' => __( 'Turks and Caicos Islands', 'burst-statistics' ),
			'TV' => __( 'Tuvalu', 'burst-statistics' ),
			'UG' => __( 'Uganda', 'burst-statistics' ),
			'UA' => __( 'Ukraine', 'burst-statistics' ),
			'AE' => __( 'United Arab Emirates', 'burst-statistics' ),
			'GB' => __( 'United Kingdom', 'burst-statistics' ),
			'US' => __( 'United States', 'burst-statistics' ),
			'UM' => __( 'United States Minor Outlying Islands', 'burst-statistics' ),
			'UY' => __( 'Uruguay', 'burst-statistics' ),
			'UZ' => __( 'Uzbekistan', 'burst-statistics' ),
			'VU' => __( 'Vanuatu', 'burst-statistics' ),
			'VE' => __( 'Venezuela', 'burst-statistics' ),
			'VN' => __( 'Viet Nam', 'burst-statistics' ),
			'VG' => __( 'Virgin Islands, British', 'burst-statistics' ),
			'VI' => __( 'Virgin Islands, U.s.', 'burst-statistics' ),
			'WF' => __( 'Wallis and Futuna', 'burst-statistics' ),
			'EH' => __( 'Western Sahara', 'burst-statistics' ),
			'YE' => __( 'Yemen', 'burst-statistics' ),
			'ZM' => __( 'Zambia', 'burst-statistics' ),
			'ZW' => __( 'Zimbabwe', 'burst-statistics' ),
		];
	}

	/**
	 * Get continent list
	 *
	 * @return array<string, string> Associative array of continent codes and names.
	 */
	public static function get_continent_list(): array {
		return [
			'AF' => __( 'Africa', 'burst-statistics' ),
			'AN' => __( 'Antarctica', 'burst-statistics' ),
			'AS' => __( 'Asia', 'burst-statistics' ),
			'EU' => __( 'Europe', 'burst-statistics' ),
			'NA' => __( 'North America', 'burst-statistics' ),
			'OC' => __( 'Oceania', 'burst-statistics' ),
			'SA' => __( 'South America', 'burst-statistics' ),
		];
	}
}
