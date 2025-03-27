<?php defined( 'ABSPATH' ) or die( 'you do not have access to this page!' );
if ( ! function_exists( 'burst_is_logged_in_rest' ) ) {
	function burst_is_logged_in_rest() {
		$valid_request = isset( $_SERVER['REQUEST_URI'] ) && strpos( $_SERVER['REQUEST_URI'], '/burst/v1/' ) !== false;
		if ( ! $valid_request ) {
			return false;
		}

		return is_user_logged_in();
	}
}

if ( !function_exists( 'burst_maybe_update_total_pageviews_count')) {
    function burst_maybe_update_total_pageviews_count()
    {
        //we don't do this on high traffic sites.
        if ( get_option( 'burst_is_high_traffic_site') ) {
            return;
        }
        
        $page_views_to_update = get_option('burst_pageviews_to_update', array());
        if (empty($page_views_to_update)) {
            return;
        }

        //clean up first.
        update_option('burst_pageviews_to_update', []);
        foreach ($page_views_to_update as $page_url => $added_count) {
            $page_id = url_to_postid($page_url);
            unset($page_views_to_update[$page_url]);
            if ($page_id) {
                $count = (int)get_post_meta($page_id, 'burst_total_pageviews_count', true);
                update_post_meta($page_id, 'burst_total_pageviews_count', $count + $added_count);
            }
        }
    }
    add_action('burst_every_hour', 'burst_maybe_update_total_pageviews_count');
}

if ( !function_exists( 'burst_add_index') ) {
    function burst_add_index( string $table_name, array $indexes ): void
    {
        global $wpdb;
        if ( !burst_user_can_manage() ) {
            return;
        }

        $indexes = array_map( 'sanitize_key', $indexes );
        $table_name = esc_sql(sanitize_key($table_name));
        $index = esc_sql(implode(', ', $indexes));
        $index_name = esc_sql(implode('_', $indexes).'_index');
        $sql = $wpdb->prepare("SHOW INDEX FROM $table_name WHERE Key_name = %s", $index_name );
        $result = $wpdb->get_results($sql);
        $index_exists = !empty($result);
        if ( !$index_exists ) {
            $sql = "ALTER TABLE $table_name ADD INDEX $index_name ($index)";
            $wpdb->query($sql);
            if ( $wpdb->last_error ) {
                burst_error_log("Error creating index $index_name in $table_name: " . $wpdb->last_error);
                // If the error is about key length, try with reduced length
                if ( str_contains($wpdb->last_error, 'Specified key was too long') ) {
                    // Remove the original index
                    $drop_sql = "ALTER TABLE $table_name DROP INDEX $index_name";
                    $wpdb->query($drop_sql);

                    // Try with reduced length
                    $reduced_sql = "ALTER TABLE $table_name ADD INDEX $index_name ($index(100))";
                    $wpdb->query($reduced_sql);
                    if ($wpdb->last_error) {
                        burst_error_log("Error creating reduced length sessions index: " . $wpdb->last_error);
                    }
                }
            }
        }
    }
}

if ( ! function_exists( 'burst_admin_logged_in' ) ) {
	function burst_admin_logged_in() {
		return ( is_admin() && is_user_logged_in() && burst_user_can_view() )
		       || burst_is_logged_in_rest()
		       || wp_doing_cron()
		       || ( defined( 'WP_CLI' ) && WP_CLI );
	}
}

if ( ! function_exists( 'burst_verify_nonce' ) ) {
    /**
     * Add some additional sanitizing
     * https://developer.wordpress.org/news/2023/08/understand-and-use-wordpress-nonces-properly/#verifying-the-nonce
     *
     * @param string $nonce
     * @param string $action
     * @return bool
     */
	function burst_verify_nonce( string $nonce, string $action ): bool
    {
        return wp_verify_nonce( sanitize_text_field( wp_unslash( $nonce ) ), $action );
	}
}

if ( ! function_exists( 'burst_is_pro' ) ) {
	function burst_is_pro() {
		return defined( 'burst_pro' );
	}
}

if ( ! function_exists( 'burst_add_view_capability' ) ) {
	/**
	 * Add a user capability to WordPress and add to admin and editor role
	 *
	 * @param bool $handle_subsites
	 */
	function burst_add_view_capability( bool $handle_subsites = true ) {
		$capability = 'view_burst_statistics';
		$roles      = apply_filters( 'burst_burst_add_view_capability', [ 'administrator', 'editor' ] );
		foreach ( $roles as $role ) {
			$role = get_role( $role );
			if ( $role && ! $role->has_cap( $capability ) ) {
				$role->add_cap( $capability );
			}
		}

		// we need to add this role across subsites as well.
		if ( $handle_subsites && is_multisite() ) {
			$sites = get_sites();
			if ( count( $sites ) > 0 ) {
				foreach ( $sites as $site ) {
					switch_to_blog( $site->blog_id );
					burst_add_view_capability( false );
					restore_current_blog();
				}
			}
		}
	}
}
if ( ! function_exists( 'burst_is_networkwide_active' ) ) {
	function burst_is_networkwide_active() {
		if ( ! is_multisite() ) {
			return false;
		}
		if ( ! function_exists( 'is_plugin_active_for_network' ) ) {
			require_once ABSPATH . '/wp-admin/includes/plugin.php';
		}

		if ( is_plugin_active_for_network( burst_plugin ) ) {
			return true;
		}

		return false;
	}
}

if ( ! function_exists( 'burst_add_manage_capability' ) ) {
	/**
	 * Add a user capability to WordPress and add to admin and editor role
	 *
	 * @param bool $handle_subsites
	 */
	function burst_add_manage_capability( bool $handle_subsites = true ) {
		$capability = 'manage_burst_statistics';
		$roles      = apply_filters( 'burst_burst_add_manage_capability', [ 'administrator' ] );
		foreach ( $roles as $role ) {
			$role = get_role( $role );
			if ( $role && ! $role->has_cap( $capability ) ) {
				$role->add_cap( $capability );
			}
		}

		// we need to add this role across subsites as well.
		if ( $handle_subsites && is_multisite() ) {
			$sites = get_sites();
			if ( count( $sites ) > 0 ) {
				foreach ( $sites as $site ) {
					switch_to_blog( $site->blog_id );
					burst_add_manage_capability( false );
					restore_current_blog();
				}
			}
		}
	}
}

if ( ! function_exists( 'burst_add_role_to_subsite' ) ) {
	/**
	 * When a new site is added, add our capability
	 *
	 * @param $site
	 *
	 * @return void
	 */
	function burst_add_role_to_subsite( $site ) {
		switch_to_blog( $site->blog_id );
		burst_add_manage_capability( false );
		restore_current_blog();
	}
	add_action( 'wp_initialize_site', 'burst_add_role_to_subsite', 10, 1 );
}

if ( ! function_exists( 'burst_user_can_view' ) ) {
	/**
	 * Check if user has Burst permissions
	 *
	 * @return boolean true or false
	 */
	function burst_user_can_view(): bool {
		if ( ! is_user_logged_in() ) {
			return false;
		}
		if ( ! current_user_can( 'view_burst_statistics' ) ) {
			return false;
		}

		return true;
	}
}

if ( ! function_exists( 'burst_user_can_manage' ) ) {
	/**
	 * Check if user has Burst permissions
	 *
	 * @return boolean true or false
	 */
	function burst_user_can_manage(): bool {
		if ( ! is_user_logged_in() ) {
			return false;
		}
		if ( ! current_user_can( 'manage_burst_statistics' ) ) {
			return false;
		}

		return true;
	}
}

if ( ! function_exists( 'burst_admin_url' ) ) {
	/**
	 * Get admin url, adjusted for multisite
	 * @param string $page
	 * @return string|null
	 */
    function burst_admin_url(string $page = ''): string
    {
        $url = is_multisite() && is_network_admin() ? network_admin_url( 'admin.php' ) : admin_url( 'admin.php' );
        if ( !empty($page) ) {
            $url = add_query_arg( 'page', $page, $url );
        }
        return $url;
    }
}

/**
 *
 * Check if we are currently in preview mode from one of the known page builders
 *
 * @return bool
 */
if ( ! function_exists( 'burst_is_pagebuilder_preview' ) ) {
	function burst_is_pagebuilder_preview() {
		$preview = false;
		global $wp_customize;
		if ( isset( $wp_customize ) || isset( $_GET['fb-edit'] )
			|| isset( $_GET['et_pb_preview'] )
			|| isset( $_GET['et_fb'] )
			|| isset( $_GET['elementor-preview'] )
			|| isset( $_GET['vc_action'] )
			|| isset( $_GET['vcv-action'] )
			|| isset( $_GET['fl_builder'] )
			|| isset( $_GET['tve'] )
			|| isset( $_GET['ct_builder'] )
		) {
			$preview = true;
		}

		return apply_filters( 'burst_is_preview', $preview );
	}
}

if ( ! function_exists( 'burst_localize_date' ) ) {

	function burst_localize_date( $date ) {
		$month             = date( 'F', strtotime( $date ) ); // june
		$month_localized   = __( $month ); // juni
		$date              = str_replace( $month, $month_localized, $date );
		$weekday           = date( 'l', strtotime( $date ) ); // wednesday
		$weekday_localized = __( $weekday ); // woensdag

		return str_replace( $weekday, $weekday_localized, $date );
	}
}


if ( ! function_exists( 'burst_display_date' ) ) {
	/**
	 * @param $date
	 *
	 * @return string
	 */
	function burst_display_date( $date ) {
		return date_i18n( get_option( 'date_format' ), $date );
	}
}

if ( ! function_exists( 'burst_format_milliseconds_to_readable_time' ) ) {
	/**
	 * Format milliseconds to readable time
	 *
	 * @param        $milliseconds
	 * @param string       $format
	 *
	 * @return string
	 */
	function burst_format_milliseconds_to_readable_time( $milliseconds, $format = '%02u:%02u:%02u ' ): string {
		$seconds  = floor( $milliseconds / 1000 );
		$minutes  = floor( $seconds / 60 );
		$hours    = floor( $minutes / 60 );
		$seconds %= 60;
		$minutes %= 60;

		$time = sprintf( $format, $hours, $minutes, $seconds );

		return rtrim( $time, '0' );
	}
}

if ( ! function_exists( 'burst_format_number' ) ) {
	/**
	 * Format number with correct decimal and thousands separator
	 *
	 * @param     $number
	 * @param int    $precision
	 *
	 * @return string
	 */
	function burst_format_number( $number, int $precision = 2 ): string {
		if ( ! (int) $number ) {
			return '0';
		}
		$number_rounded = round( $number );
		if ( $number < 10000 ) {
			if ( $number_rounded - $number > 0 && $number_rounded - $number < 1 ) { // if difference is less than 1
				return number_format_i18n( $number, $precision ); // return number with specified decimal precision
			}

			return number_format_i18n( $number ); // return number without decimal
		}
		$divisors = array(
			1000 ** 0 => '', // 1000^0 == 1
			1000 ** 1 => 'k', // Thousand - kilo
			1000 ** 2 => 'M', // Million - mega
			1000 ** 3 => 'G', // Billion - giga
			1000 ** 4 => 'T', // Trillion - tera
			1000 ** 5 => 'P', // quadrillion - peta
		);

		// Loop through each $divisor and find the
		// lowest amount that matches
		foreach ( $divisors as $divisor => $shorthand ) {
			if ( abs( $number ) < ( $divisor * 1000 ) ) {
				// We found a match!
				break;
			}
		}
		// We found our match, or there were no matches.
		// Either way, use the last defined value for $divisor.
		$number_rounded = round( $number / $divisor );
		$number        /= $divisor;
		if ( $number_rounded - $number > 0 && $number_rounded - $number < 1 ) { // if difference is less than 1
			return number_format_i18n( $number, $precision ) . $shorthand; // return number with specified decimal precision
		}

		return number_format_i18n( $number ) . $shorthand; // return number without decimal
	}
}

/**
 * Get a Burst option by name
 *
 * @param string $name
 * @param mixed  $default
 *
 * @return mixed
 */
function burst_get_option( $name, $default = false ) {
	$name    = sanitize_title( $name );
	$options = get_option( 'burst_options_settings', [] );
	$value = isset( $options[ $name ] ) ? $options[ $name ] : false;
	if ( $value === false && $default !== false ) {
		$value = $default;
	}

	return apply_filters( "burst_option_$name", $value, $name );
}

if ( ! function_exists( 'burst_sprintf' ) ) {
	/**
	 * @param string $format
	 * @param mixed  $values
	 *
	 * @return string
	 *
	 * We use this custom sprintf for outputting translatable strings. This function only works with %s
	 * This function wraps the sprintf and will prevent fatal errors.
	 */
	function burst_sprintf(): string {
		$args             = func_get_args();
		$count            = substr_count( $args[0], '%s' );
		$count_percentage = substr_count( $args[0], '%' );
		$args_count       = count( $args ) - 1;

		if ( $count_percentage === $count ) {
			if ( $args_count === $count ) {
				return call_user_func_array( 'sprintf', $args );
			}
		}

		return $args[0] . ' (Translation error)';
	}
}

if ( ! function_exists( 'burst_printf' ) ) {
	/**
	 * @param string $format
	 * @param mixed  $values
	 *
	 * @echo string
	 */
	function burst_printf() {
		$args       = func_get_args();
		$count      = substr_count( $args[0], '%s' );
		$args_count = count( $args ) - 1;

		if ( $args_count === $count ) {
			$string = call_user_func_array( 'sprintf', $args );
			echo wp_kses_post( $string );
		} else {
			echo wp_kses_post( $args[0] ) . ' (Translation error)';
		}
	}
}


if ( ! function_exists( 'burst_get_date_ranges' ) ) {
	function burst_get_date_ranges() {
		return apply_filters(
			'burst_date_ranges',
			[
				'today',
				'yesterday',
				'last-7-days',
				'last-30-days',
				'last-90-days',
				'last-month',
				'last-year',
				'week-to-date',
				'month-to-date',
				'year-to-date',
			]
		);
	}
}

if ( ! function_exists( 'burst_sanitize_filters' ) ) {
	/**
	 * @param mixed $filters JSON string, stdClass, or array
	 *
	 * @return array Sanitized array of filters
	 */
	function burst_sanitize_filters( $filters ) {
		// Ensure $filters is an array
		if ( ! is_array( $filters ) ) {
			if ( $filters instanceof stdClass ) {
				$filters = (array) $filters; // Convert stdClass to array if needed
			} else {
				$filters = []; // Default to an empty array for invalid input
			}
		}

		// Filter out false or empty values
		$filters = array_filter(
			$filters,
			static function ( $item ) {
				return $item !== false && $item !== '';
			}
		);

		// Sanitize keys and values
		$out = [];
		foreach ( $filters as $key => $value ) {
			$out[ esc_sql( $key ) ] = esc_sql( $value );
		}

		return $out;
	}
}


if ( ! function_exists( 'burst_sanitize_relative_url' ) ) {
	/**
	 * Sanitize relative_url
	 *
	 * @param string $relative_url
	 *
	 * @return string
	 */
	function burst_sanitize_relative_url( $relative_url ): string {
		if ( empty( $relative_url ) ) {
			return '*';
		}
		if ( $relative_url[0] !== '/' ) {
			$relative_url = '/' . $relative_url;
		}
		return trailingslashit( filter_var( $relative_url, FILTER_SANITIZE_URL ) );
	}
}

if ( ! function_exists( 'burst_tracking_status_error' ) ) {
	/**
	 * Get tracking status message
	 *
	 * @return bool
	 */
	function burst_tracking_status_error() {
		return BURST()->endpoint->get_tracking_status() === 'error';
	}
}

if ( ! function_exists( 'burst_get_tracking_status' ) ) {
	function burst_get_tracking_status() {
		return BURST()->endpoint->get_tracking_status();
	}
}

if ( ! function_exists( 'burst_tracking_status_rest_api' ) ) {
	/**
	 * Get tracking status message
	 *
	 * @return bool
	 */
	function burst_tracking_status_rest_api() {
		return BURST()->endpoint->get_tracking_status() === 'rest';
	}
}

if ( ! function_exists( 'burst_tracking_status_beacon' ) ) {
	/**
	 * Get tracking status message
	 *
	 * @return bool
	 */
	function burst_tracking_status_beacon() {
		return BURST()->endpoint->get_tracking_status() === 'beacon';
	}
}

if ( ! function_exists( 'burst_get_beacon_url' ) ) {
	/**
	 * Get beacon path
	 *
	 * @return string
	 */
	function burst_get_beacon_url(): string {
		if ( is_multisite() && get_site_option( 'burst_track_network_wide' ) && burst_is_networkwide_active() ) {
			if ( is_main_site() ) {
				return burst_url . 'endpoint.php';
			} else {
				// replace the subsite url with the main site url in burst_url
				// get main site_url
				$main_site_url = get_site_url( get_main_site_id() );
				return str_replace( site_url(), $main_site_url, burst_url ) . 'endpoint.php';
			}
		}
		return burst_url . 'endpoint.php';
	}
}

if ( ! function_exists( 'burst_upload_dir' ) ) {
	/**
	 * Get the upload dir
	 *
	 * @param string $path
	 *
	 * @return string
	 */
	function burst_upload_dir( string $path = '' ): string {
		$uploads    = wp_upload_dir();
		$upload_dir = trailingslashit( apply_filters( 'burst_upload_dir', $uploads['basedir'] ) ) . 'burst/' . $path;
		if ( ! is_dir( $upload_dir ) ) {
			burst_create_missing_directories_recursively( $upload_dir );
		}

		return trailingslashit( $upload_dir );
	}
}

if ( ! function_exists( 'burst_upload_url' ) ) {
	/**
	 * Get the upload url
	 *
	 * @param string $path
	 *
	 * @return string
	 */
	function burst_upload_url( string $path = '' ): string {
		$uploads    = wp_upload_dir();
		$upload_url = $uploads['baseurl'];
		$upload_url = trailingslashit( apply_filters( 'burst_upload_url', $upload_url ) );
		return trailingslashit( $upload_url . 'burst/' . $path );
	}
}

/**
 * Create directories recursively
 *
 * @param string $path
 */

if ( ! function_exists( 'burst_create_missing_directories_recursively' ) ) {
	function burst_create_missing_directories_recursively( string $path ) {
		if ( ! burst_user_can_view() ) {
			return;
		}

		$parts = explode( '/', $path );
		$dir   = '';
		foreach ( $parts as $part ) {
			$dir .= $part . '/';
			if ( burst_has_open_basedir_restriction( $dir ) ) {
				continue;
			}
			if ( ! is_dir( $dir ) && strlen( $dir ) > 0 && is_writable( dirname( $dir, 1 ) ) ) {
				if ( ! mkdir( $dir ) && ! is_dir( $dir ) ) {
					throw new \RuntimeException( sprintf( 'Directory "%s" was not created', $dir ) );
				}
			}
		}
	}
}


if ( ! function_exists( 'burst_has_open_basedir_restriction' ) ) {
	function burst_has_open_basedir_restriction( $path ) {
		// Default error handler is required
		set_error_handler( null );
		// Clean last error info.
		error_clear_last();
		// Testing...
		@file_exists( $path );
		// Restore previous error handler
		restore_error_handler();
		// Return `true` if error has occurred
		return ( $error = error_get_last() ) && $error['message'] !== '__clean_error_info';
	}
}


if ( ! function_exists( 'burst_get_value' ) ) {
	/**
	 * Deprecated: Get a Burst option by name, use burst_get_option instead
	 *
	 * @deprecated 1.3.0
	 * @param $name
	 * @param $default
	 *
	 * @return mixed
	 */
	function burst_get_value( $name, $default = false ) {
		return burst_get_option( $name, $default );
	}
}

if ( ! function_exists('burst_get_website_url') ) {
	/**
	 * @param string $url
	 * @param array $params
	 *               Example usage:
	 *               burst_content=page-analytics -> specifies that the user is interacting with the page analytics feature.
	 *               burst_source=download-button -> indicates that the click originated from the download button.
	 *
	 * @return string
	 */
	function burst_get_website_url(string $url = '/', array $params = []): string
    {
		$version = defined('burst_pro') ? 'pro' : 'free';
		$version_nr = defined('burst_version') ? burst_version : '0';

		// strip debug time from version nr
		$version_nr = explode('#', $version_nr);
		$version_nr = $version_nr[0];
		$default_params = [
			'burst_campaign' => 'burst-' . $version . '-' . $version_nr,
		];

		$params = wp_parse_args($params, $default_params);
        //remove slash prepending the $url
        $url = ltrim($url, '/');

		return add_query_arg($params, "https://burst-statistics.com/" . trailingslashit($url) );
	}
}