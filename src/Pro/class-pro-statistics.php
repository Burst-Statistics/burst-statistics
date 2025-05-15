<?php
namespace Burst\Pro;

use Burst\Traits\Admin_Helper;
use Burst\Traits\Database_Helper;
use Burst\Traits\Helper;

defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

if ( ! class_exists( 'pro_statistics' ) ) {
	/**
	 * Class Pro_Statistics
	 */
	class Pro_Statistics {
		use Helper;
		use Admin_Helper;

		use Database_Helper;

		/**
		 * Pro_Statistics constructor.
		 */
		public function __construct() {
			add_filter( 'burst_localize_script', [ $this, 'add_countries_to_localize_script' ], 10, 1 );
			add_filter( 'burst_metrics', [ $this, 'add_pro_metrics' ], 10, 1 );
			add_filter( 'burst_select_sql_for_metric', [ $this, 'add_pro_select_sql_for_metric' ], 10, 1 );
			add_filter( 'burst_available_joins', [ $this, 'add_pro_available_joins' ], 10, 1 );
			add_filter( 'burst_possible_filters_with_table_prefix', [ $this, 'add_pro_possible_filters_with_table_prefix' ], 10, 1 );
			add_action( 'burst_install_tables', [ $this, 'install_campaigns_table' ], 10 );
			add_action( 'burst_install_tables', [ $this, 'install_parameters_table' ], 10 );
		}

		/**
		 * Add metrics for pro users.
		 *
		 * @param array<string, string> $metrics Existing metrics.
		 * @return array<string, string> Metrics with added pro options.
		 */
		public function add_pro_metrics( array $metrics ): array {
			$metrics['country_code'] = __( 'Country', 'burst-statistics' );
			$metrics['source']       = __( 'Source', 'burst-statistics' );
			$metrics['medium']       = __( 'Medium', 'burst-statistics' );
			$metrics['campaign']     = __( 'Campaign', 'burst-statistics' );
			$metrics['term']         = __( 'Term', 'burst-statistics' );
			$metrics['content']      = __( 'Content', 'burst-statistics' );
			$metrics['parameter']    = __( 'Parameter', 'burst-statistics' );
			$metrics['parameters']   = __( 'Parameters', 'burst-statistics' );

			return $metrics;
		}

		/**
		 * Add joins for pro.
		 *
		 * @param array<string, array<string, string>> $joins Existing joins.
		 * @return array<string, array<string, string>> Joins with added pro tables and conditions.
		 */
		public function add_pro_available_joins( array $joins ): array {
			$joins['parameters'] = [
				'table' => 'burst_parameters',
				'on'    => 'statistics.ID = parameters.statistic_id',
				// Optional, default is INNER JOIN.
				'type'  => 'RIGHT',
			];
			$joins['campaigns']  = [
				'table' => 'burst_campaigns',
				'on'    => 'statistics.ID = campaigns.statistic_id',
				// Optional, default is INNER JOIN.
				'type'  => 'RIGHT',
			];
			return $joins;
		}

		/**
		 * Add filters for pro.
		 *
		 * @param array<string, string> $filters Existing filters.
		 * @return array<string, string> Filters including country_code with table prefix.
		 */
		public function add_pro_possible_filters_with_table_prefix( array $filters ): array {
			$filters['country_code'] = 'sessions.country_code';

			return $filters;
		}

		/**
		 * Add pro select SQL for a specific metric
		 */
		public function add_pro_select_sql_for_metric( string $metric ): string {
			$sql = '';
			if ( $metric === 'country_code' ) {
				$sql = 'sessions.country_code';
			}
			if ( $metric === 'source' ) {
				$sql = 'campaigns.source';
			}
			if ( $metric === 'medium' ) {
				$sql = 'campaigns.medium';
			}
			if ( $metric === 'campaign' ) {
				$sql = 'campaigns.campaign';
			}
			if ( $metric === 'term' ) {
				$sql = 'campaigns.term';
			}
			if ( $metric === 'content' ) {
				$sql = 'campaigns.content';
			}
			if ( $metric === 'parameter' ) {
				// combine parameter name and value.
				$sql = "CONCAT(parameters.parameter, '=', parameters.value)";
			}
			if ( $metric === 'parameters' ) {
				$sql = 'statistics.parameters';
			}
			return $sql;
		}

		/**
		 * Get country nice name
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
		 * Add countries to localize script.
		 *
		 * @param array<string, mixed> $localize_script The script localization array.
		 * @return array<string, mixed> The modified localization array including the countries list.
		 */
		public function add_countries_to_localize_script( array $localize_script ): array {
			$localize_script['countries'] = self::get_country_list();

			return $localize_script;
		}

		/**
		 * Get country list
		 *
		 * @return array<string, string> Associative array of country codes and names.
		 */
		private static function get_country_list(): array {
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
		 * Install statistic table
		 * */
		public function install_parameters_table(): void {
			require_once ABSPATH . 'wp-admin/includes/upgrade.php';

			global $wpdb;
			$charset_collate = $wpdb->get_charset_collate();
			// Create table without indexes first.
			$table_name = $wpdb->prefix . 'burst_parameters';
			$sql        = "CREATE TABLE $table_name (
                `ID` int(11) NOT NULL AUTO_INCREMENT,
                `statistic_id` int NOT NULL,
                `parameter` varchar(255) NOT NULL,
                `value` varchar(255),
                PRIMARY KEY (ID)
            ) $charset_collate;";

			$result = dbDelta( $sql );
			if ( ! empty( $wpdb->last_error ) ) {
				self::error_log( 'Error creating parameters table: ' . $wpdb->last_error );
				// Exit without updating version if table creation failed.
				return;
			}

			$indexes = [
				[ 'statistic_id' ],
				[ 'parameter' ],
			];

			foreach ( $indexes as $index ) {
				$this->add_index( $table_name, $index );
			}
		}

		/**
		 * Install campaigns table
		 */
		public function install_campaigns_table(): void {
			require_once ABSPATH . 'wp-admin/includes/upgrade.php';
			global $wpdb;
			$charset_collate = $wpdb->get_charset_collate();

			// Create table without indexes first.
			$table_name = $wpdb->prefix . 'burst_campaigns';
			$sql        = "CREATE TABLE $table_name (
                `ID` int(11) NOT NULL AUTO_INCREMENT,
                `statistic_id` int NOT NULL,
                `source` varchar(255),
                `medium` varchar(255),
                `campaign` varchar(255),
                `term` varchar(255),
                `content` varchar(255),
                PRIMARY KEY (ID)
            ) $charset_collate;";

			dbDelta( $sql );
			if ( ! empty( $wpdb->last_error ) ) {
				self::error_log( 'Error creating campaigns table: ' . $wpdb->last_error );
				// Exit without updating version if table creation failed.
				return;
			}

			$indexes = [
				[ 'statistic_id' ],
				[ 'source' ],
				[ 'medium' ],
				[ 'campaign' ],
				[ 'term' ],
				[ 'content' ],
			];

			foreach ( $indexes as $index ) {
				$this->add_index( $table_name, $index );
			}
		}
	}
}
