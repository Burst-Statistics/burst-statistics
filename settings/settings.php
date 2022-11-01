<?php
defined( 'ABSPATH' ) or die();

/**
 * Enqueue Gutenberg block assets for backend editor.
 *
 * @since 1.0.0
 */

require_once( burst_path . 'settings/config/config.php' );
require_once( burst_path . 'settings/rest-api-optimizer/rest-api-optimizer.php' );

function burst_plugin_admin_scripts() {
	$script_asset_path = __DIR__ . "/build/index.asset.php";
	$script_asset      = require( $script_asset_path );
	wp_enqueue_script(
		'burst-settings',
		plugins_url( 'build/index.js', __FILE__ ),
		$script_asset['dependencies'],
		$script_asset['version']
	);
	wp_set_script_translations( 'burst-wizard-plugin-block-editor', 'burst-statistics' );

	
	wp_localize_script(
        'burst-settings',
        'burst_settings',
        apply_filters('burst_localize_script',array(
            'site_url' => get_rest_url(),
            'dashboard_url' => add_query_arg(['page' => 'burst'], burst_admin_url() ),
            'upgrade_link' => is_multisite() ? 'https://burst-statistics.com/pro-multisite' : 'https://burst-statistics.com/pro',
            'plugin_url' => burst_url,
            'network_link' => network_site_url('plugins.php'),
            'blocks' => burst_blocks(),
            'pro_plugin_active' => defined('burst_pro_version'),
            'networkwide_active' => !is_multisite() || burst_is_networkwide_active(),//true for single sites and network wide activated
            'nonce' => wp_create_nonce( 'wp_rest' ),//to authenticate the logged in user
            'burst_nonce' => wp_create_nonce( 'burst_save' ),
            'current_ip' => burst_get_ip_address(),
            'user_roles' => burst_get_user_roles(),
            'date_ranges' => burst_get_date_ranges(),
        ))
	);
}

function burst_add_option_menu() {

	if ( ! burst_user_can_view() ) {
		return;
	}
    $menu_label = __('Statistics', 'burst-statistics');
	$warnings      = BURST()->notices->count_plusones( array('plus_ones'=>true) );
	$warning_title = esc_attr( burst_sprintf( '%d plugin warnings', $warnings ) );
    if ( $warnings > 0 ) {
        $warning_title .= ' ' . esc_attr( burst_sprintf( '(%d plus ones)', $warnings ) );
	    $menu_label    .=
		    "<span class='update-plugins count-$warnings' title='$warning_title'>
			<span class='update-count'>
				". number_format_i18n( $warnings ) . "
			</span>
		</span>";
    }


		$page_hook_suffix = add_submenu_page(
			'index.php',
			'Burst Statistics',
			$menu_label,
			'view_burst_statistics',
			'burst',
			'burst_dashboard'
		);

	add_action( "admin_print_scripts-{$page_hook_suffix}", 'burst_plugin_admin_scripts' );
}

add_action( 'admin_menu', 'burst_add_option_menu' );

/**
 * Render the settings page
 */

function burst_dashboard() {
	if ( ! burst_user_can_view() ) {
		return;
	}
	if ( !get_option('permalink_structure') ){
        $permalinks_url = admin_url('options-permalink.php');
        ?>
            <div class="burst-permalinks-warning notice notice-error settings-error is-dismissible">
                <h1><?php _e("Pretty permalinks not enabled", "burst-statistics")?></h1>
                <p><?php _e("Pretty permalinks are not enabled on your site. This prevents the REST API from working, which is required for the settings page.", "burst-statistics")?></p>
                <p><?php printf(__('To resolve, please go to the <a href="%s">permalinks settings</a>, and set to anything but plain.', "burst-statistics"), $permalinks_url)?></p>
            </div>
        <?php
    } else {
        ?>
        <div id="burst-statistics" class="burst"></div>
        <div id="burst-statistics-modal"></div>
        <?php
    }
}

add_action( 'rest_api_init', 'burst_settings_rest_route', 1 );
function burst_settings_rest_route() {
	if ( ! burst_user_can_view() ) {
		return;
	}
	register_rest_route( 'burst/v1', 'fields/get', array(
		'methods'             => 'GET',
		'callback'            => 'burst_rest_api_fields_get',
		'permission_callback' => function () {
			return burst_user_can_manage();
		}
	) );

	register_rest_route( 'burst/v1', 'fields/set', array(
		'methods'             => 'POST',
		'callback'            => 'burst_rest_api_fields_set',
		'permission_callback' => function() {
			return burst_user_can_manage();
		},
	) );

	register_rest_route( 'burst/v1', 'block/(?P<block>[a-z\_\-]+)', array(
		'methods'             => 'GET',
		'callback'            => 'burst_rest_api_block_get',
		'permission_callback' => function() {
			return burst_user_can_view();
		},
	) );

	 register_rest_route( 'burst/v1', 'tests/(?P<test>[a-z\_\-]+)', array(
	 	'methods'  => 'GET',
	 	'callback' => 'burst_run_test',
	 	'permission_callback' => function () {
		    return burst_user_can_view();
	 	}
	 ) );

	register_rest_route( 'burst/v1', 'data/(?P<type>[a-z\_\-]+)', array(
		'methods'  => 'GET',
		'callback' => 'burst_get_data',
		'permission_callback' => function () {
			return burst_user_can_view();
		}
	) );

	register_rest_route( 'burst/v1', 'do_action/(?P<action>[a-z\_\-]+)', array(
		'methods'  => 'POST',
		'callback' => 'burst_do_action',
		'permission_callback' => function () {
			return burst_user_can_view();
		}
	) );
}

/**
 * @param WP_REST_Request $request
 *
 * @return void
 */
function burst_run_test($request){
	if ( ! burst_user_can_view() ) {
		return;
	}

	$test = sanitize_title($request->get_param('test'));
	$state = $request->get_param('state');
	$state =  $state !== 'undefined' ? $state : false;
	switch($test){
		case 'progressdata':
			$data = BURST()->notices->get();
			break;
		case 'dismiss_task':
			$data = BURST()->notices->dismiss_notice($state);
			break;
		case 'otherpluginsdata':
			$data = burst_other_plugins_data();
			break;
		case 'tracking':
			$data = BURST()->endpoint->get_tracking_status_and_time();
			break;
		default:
			$data = apply_filters("burst_run_test", [], $test, $request);
	}
	$response = json_encode( $data );
	header( "Content-Type: application/json" );
	echo $response;
	exit;
}


/**
 * @param WP_REST_Request $request
 *
 * @return void
 */
function burst_do_action($request){
	if ( !burst_user_can_manage() ) {
		return;
	}

    error_log("burst_do_action");
	$action = sanitize_title($request->get_param('action'));
	$data = $request->get_params();
	$nonce = $data['nonce'];
	error_log("do_action: $action");
	error_log(print_r($data, true));
	if ( !wp_verify_nonce($nonce, 'burst_save') ) {
		return;
	}

	switch( $action ){
		case 'plugin_actions':
			$data = burst_plugin_actions($request);
			break;
		default:
			$data = apply_filters("burst_do_action", [], $action, $request);
	}
	$response = json_encode( $data );
	header( "Content-Type: application/json" );
	echo $response;
	exit;
}

/**
 * Process plugin installation or activation actions
 *
 * @param WP_REST_Request $request
 *
 * @return array
 */

function burst_plugin_actions($request){
	if ( !burst_user_can_manage() ) {
		return [];
	}
	$data = $request->get_params();
	$slug = sanitize_title($data['slug']);
	$action = sanitize_title($data['pluginAction']);
	$installer = new burst_installer($slug);
	if ($action==='download') {
		$installer->download_plugin();
	} else if ( $action === 'activate' ) {
		$installer->activate_plugin();
	}
	return burst_other_plugins_data($slug);
}

/**
 * Get plugin data for other plugin section
 * @param string $slug
 * @return array
 */
function burst_other_plugins_data($slug=false){
	if ( !burst_user_can_view() ) {
		return [];
	}
	$plugins = array(
		[
			'slug' => 'burst-statistics',
			'constant_free' => 'burst_version',
			'wordpress_url' => 'https://wordpress.org/plugins/burst-statistics/',
			'upgrade_url' => 'https://burst-statistics.com/?src=burst-plugin',
			'title' => 'Burst Statistics - '. __("Self-hosted, Privacy-friendly analytics tool.", "burst-statistics"),
		],
		[
			'slug' => 'complianz-gdpr',
			'constant_free' => 'cmplz_plugin',
			'constant_premium' => 'cmplz_premium',
			'wordpress_url' => 'https://wordpress.org/plugins/complianz-gdpr/',
			'upgrade_url' => 'https://complianz.io/pricing?src=burst-plugin',
			'title' => __("Complianz Privacy Suite - Cookie Consent Management as it should be ", "burst-statistics" ),
		],
		[
			'slug' => 'complianz-terms-conditions',
			'constant_free' => 'cmplz_tc_version',
			'wordpress_url' => 'https://wordpress.org/plugins/complianz-terms-conditions/',
			'upgrade_url' => 'https://complianz.io?src=burst-plugin',
			'title' => 'Complianz - '. __("Terms and Conditions", "burst-statistics"),
		],
	);

	foreach ($plugins as $index => $plugin ){
		$installer = new burst_installer($plugin['slug']);
		if ( isset($plugin['constant_premium']) && defined($plugin['constant_premium']) ) {
			$plugins[ $index ]['pluginAction'] = 'installed';
		} else if ( !$installer->plugin_is_downloaded() && !$installer->plugin_is_activated() ) {
			$plugins[$index]['pluginAction'] = 'download';
		} else if ( $installer->plugin_is_downloaded() && !$installer->plugin_is_activated() ) {
			$plugins[ $index ]['pluginAction'] = 'activate';
		} else {
			if (isset($plugin['constant_premium']) ) {
				$plugins[$index]['pluginAction'] = 'upgrade-to-premium';
			} else {
				$plugins[ $index ]['pluginAction'] = 'installed';
			}
		}
	}

	if ( $slug ) {
		foreach ($plugins as $key=> $plugin) {
			if ($plugin['slug']===$slug){
				return $plugin;
			}
		}
	}
	return $plugins;

}

/**
 * @param WP_REST_Request $request
 *
 * @return void
 */
function burst_get_data($request){
	if ( ! burst_user_can_view() ) {
		return;
	}
	$type = sanitize_title($request->get_param('type'));
    $args = [
            'date_start' => BURST()->statistics->convert_date_to_utc( $request->get_param('date_start') . ' 00:00:00'), // add 00:00:00 to date,
            'date_end' => BURST()->statistics->convert_date_to_utc($request->get_param('date_end') . ' 23:59:59'), // add 23:59:59 to date
            'date_range' => burst_sanitize_date_range($request->get_param('date_range')),
    ];
    $request_args = json_decode($request->get_param('args'), true);
	$args['metrics'] = $request_args['metrics'] ?? [];
	switch($type){
		case 'live':
			$data = BURST()->statistics->get_live_data($args);
			break;
		case 'today':
			$data = BURST()->statistics->get_today_data($args);
			break;
		case 'insights':
            $args['interval'] = sanitize_title($request_args['interval']);
			$data = BURST()->statistics->get_insights_data($args);
			break;
		case 'pages':
			$data = BURST()->statistics->get_pages_data($args);
			break;

		case 'referrers':
			$data = BURST()->statistics->get_referrers_data($args);
			break;
		case 'compare':
			$data = BURST()->statistics->get_compare_data($args);
			break;
		case 'devices':
			$data = BURST()->statistics->get_devices_data($args);
			break;
		default:
			$data = apply_filters("burst_get_data", [], $type, $request);
	}
	$response = json_encode( $data );
	header( "Content-Type: application/json" );
	echo $response;
	exit;
}

/**
 * List of allowed field types
 *
 * @param $type
 *
 * @return mixed|string
 */
function burst_sanitize_field_type( $type ) {
	$types = [
		'hidden',
		'database',
		'checkbox',
		'radio',
		'text',
		'textarea',
		'number',
		'email',
		'select',
        'ip_blocklist',
        'user_role_blocklist',
	];
	if ( in_array( $type, $types ) ) {
		return $type;
	}
	error_log( "TYPE NOT FOUND" );

	return 'checkbox';
}

/**
 * @param WP_REST_Request $request
 *
 * @return void
 */
function burst_rest_api_fields_set( $request ) {
	if ( ! burst_user_can_manage() ) {
		return;
	}
	$fields = $request->get_json_params();
	$config_fields = burst_fields(false);
	$config_ids = array_column($config_fields, 'id');
	foreach ( $fields as $index => $field ) {

		$config_field_index = array_search($field['id'], $config_ids);
		$config_field = $config_fields[$config_field_index];
		if ( !$config_field_index ){
			error_log("unsetting ".$field['id']." as not existing field in BURST ");
			unset($fields[$index]);
			continue;
		}
		$type = burst_sanitize_field_type($field['type']);
		$field_id = sanitize_text_field($field['id']);
		$value = burst_sanitize_field( $field['value'] , $type,  $field_id);
		//if an endpoint is defined, we use that endpoint instead
		if ( isset($config_field['data_endpoint'])){
			//the updateItemId allows us to update one specific item in a field set.
			$update_item_id = isset($field['updateItemId']) ? $field['updateItemId'] : false;
			$action = isset($field['action']) && $field['action']==='delete' ? 'delete' : 'update';
			$endpoint = $config_field['data_endpoint'];
			if (is_array($endpoint) ) {
				$main = $endpoint[0];
				$class = $endpoint[1];
				$function = $endpoint[2];
				if (function_exists($main)) {
					$main()->$class->$function( $value, $update_item_id, $action );
				}
			} else if ( function_exists($endpoint) ){
				$endpoint($value, $update_item_id, $action);
			}

			unset($fields[$index]);
			continue;
		}

		$field['value'] = $value;
		$fields[$index] = $field;
	}

    $options = get_option( 'burst_options_settings', [] );


	//build a new options array
	foreach ( $fields as $field ) {
		$prev_value = isset( $options[ $field['id'] ] ) ? $options[ $field['id'] ] : false;
		do_action( "burst_before_save_option", $field['id'], $field['value'], $prev_value, $field['type'] );
		$options[ $field['id'] ] = $field['value'];
	}

	if ( ! empty( $options ) ) {
		if ( is_multisite() && burst_is_networkwide_active() ) {
			update_site_option( 'burst_options_settings', $options );
		} else {
			update_option( 'burst_options_settings', $options );
		}
	}

	foreach ( $fields as $field ) {
		do_action( "burst_after_save_field", $field['id'], $field['value'], $prev_value, $field['type'] );
	}
	do_action('burst_after_saved_fields', $fields );
	$output   = [
		'success' => true,
		'progress' => BURST()->notices->get(),
		'fields' => burst_fields(true),
	];
	$response = json_encode( $output );
	header( "Content-Type: application/json" );
	echo $response;
	exit;
}

/**
 * Update a burst option
 * @param string $name
 * @param mixed $value
 *
 * @return void
 */

function burst_update_option( $name, $value ) {
	if ( !burst_user_can_manage() ) {
		return;
	}

	$config_fields = burst_fields(false);
	$config_ids = array_column($config_fields, 'id');
	$config_field_index = array_search($name, $config_ids);
	$config_field = $config_fields[$config_field_index];
	if ( $config_field_index === false ){
		error_log("exiting ".$name." as not existing field in burst ");
		return;
	}

	$type = isset( $config_field['type'] ) ? $config_field['type'] : false;
	if ( !$type ) {
		error_log("exiting ".$name." has not existing type ");
		return;
	}
    $options = get_option( 'burst_options_settings', [] );
	if ( !is_array($options) ) $options = [];
	$prev_value = $options[ $name ] ?? false;
	$name = sanitize_text_field($name);
	$type = burst_sanitize_field_type($config_field['type']);
	$value = burst_sanitize_field( $value, $type, $name );
	$value = apply_filters("burst_fieldvalue", $value, sanitize_text_field($name), $type);
	$options[$name] = $value;
	if ( is_multisite() && burst_is_networkwide_active() ) {
		update_site_option( 'burst_options_settings', $options );
	} else {
		update_option( 'burst_options_settings', $options );
	}
	do_action( "burst_after_save_field", $name, $value, $prev_value, $type );
}
/**
 * Get the rest api fields
 * @return void
 */

function burst_rest_api_fields_get() {
	if ( !burst_user_can_manage() ) {
		return;
	}

	$output = array();
	$fields = burst_fields();
	$menu = burst_menu();
	foreach ( $fields as $index => $field ) {
		/**
		 * Load data from source
		 */
		if ( isset($field['data_source']) ){
			$data_source = $field['data_source'];
			if ( is_array($data_source)) {
				$main = $data_source[0];
				$class = $data_source[1];
				$function = $data_source[2];
				$field['value'] = [];
				if (function_exists($main)){
					$field['value'] = $main()->$class->$function();
				}
			} else if ( function_exists($field['data_source'])) {
				$func = $field['data_source'];
				$field['value'] = $func();
			}
		}

		$fields[$index] = $field;
	}

	//remove empty menu items
	foreach ($menu as $key => $menu_group ){
		$menu_group['menu_items'] = burst_drop_empty_menu_items($menu_group['menu_items'], $fields);
		$menu[$key] = $menu_group;
	}

	$output['fields'] = $fields;
	$output['menu'] = $menu;
	$output['progress'] = BURST()->notices->get();

	$output = apply_filters('burst_rest_api_fields_get', $output);
	$response = json_encode( $output );
	header( "Content-Type: application/json" );
	echo $response;
	exit;
}

/**
 * Checks if there are field linked to menu_item if not removes menu_item from menu_item array
 * @param $menu_items
 * @param $fields
 * @return array
 */
function burst_drop_empty_menu_items( $menu_items, $fields) {
	if ( !burst_user_can_manage() ) {
		return $menu_items;
	}
    $new_menu_items = $menu_items;
    foreach($menu_items as $key => $menu_item) {
        $searchResult = array_search($menu_item['id'], array_column($fields, 'menu_id'));
        if($searchResult === false) {
            unset($new_menu_items[$key]);
            //reset array keys to prevent issues with react
	        $new_menu_items = array_values($new_menu_items);
        } else {
            if(isset($menu_item['menu_items'])){
                $updatedValue = burst_drop_empty_menu_items($menu_item['menu_items'], $fields);
                $new_menu_items[$key]['menu_items'] = $updatedValue;
            }
        }
    }
    return $new_menu_items;
}

/**
 * Get grid block data
 *
 * @param WP_REST_Request $request
 *
 * @return void
 */
function burst_rest_api_block_get( $request ) {
	if ( ! burst_user_can_manage() ) {
		return;
	}
	$block    = $request->get_param( 'block' );
	$blocks   = burst_blocks();
	$out      = isset( $blocks[ $block ] ) ? $blocks[ $block ] : [];
	$response = json_encode( $out );
	header( "Content-Type: application/json" );
	echo $response;
	exit;
}

/**
 * Sanitize a field
 *
 * @param mixed  $value
 * @param string $type
 *
 * @oaram string $id
 *
 * @return array|bool|int|string|void
 */
function burst_sanitize_field( $value, $type, $id ) {
	if ( ! burst_user_can_manage() ) {
		return false;
	}

	switch ( $type ) {
		case 'checkbox':
		case 'hidden':
		case 'database':
			return intval( $value );
		case 'select':
		case 'text':
			return sanitize_text_field( $value );
		case 'textarea':
			return sanitize_text_field( $value );
		case 'multicheckbox':
        case 'user_role_blocklist':
			if ( ! is_array( $value ) ) {
				$value = array( $value );
			}
			return array_map( 'sanitize_text_field', $value );
		case 'email':
			return sanitize_email( $value );
		case 'url':
			return esc_url_raw( $value );
		case 'number':
			return intval( $value );
		case 'ip_blocklist':
			return burst_sanitize_ip_field( $value );
		default:
			return sanitize_text_field( $value );
	}
}

function burst_sanitize_ip_field( $value ) {
    if ( ! burst_user_can_manage() ) {
        return false;
    }

    $ips = explode( PHP_EOL, $value );
    $ips = array_map( 'trim', $ips ); // remove whitespace
    $ips = array_filter( $ips ); // remove empty lines
    $ips = array_unique( $ips ); // remove duplicates
    $ips = array_map( 'sanitize_text_field', $ips ); // sanitize each ip
    return implode( PHP_EOL, $ips );
}
//function burst_sanitize_datatable( $value, $type, $field_name ) {
//	$possible_keys = apply_filters( "burst_datatable_datatypes_$type", [
//		'id'     => 'string',
//		'title'  => 'string',
//		'status' => 'boolean',
//	] );
//
//	if ( ! is_array( $value ) ) {
//		return false;
//	} else {
//		foreach ( $value as $row_index => $row ) {
//			//check if we have invalid values
//			if ( is_array( $row ) ) {
//				foreach ( $row as $column_index => $row_value ) {
//					if ( $column_index === 'id' && $row_value === false ) {
//						unset( $value[ $column_index ] );
//					}
//				}
//			}
//
//			//has to be an array.
//			if ( ! is_array( $row ) ) {
//				unset( $value[ $row_index ] );
//			}
//
//			foreach ( $row as $col_index => $col_value ) {
//				if ( ! isset( $possible_keys[ $col_index ] ) ) {
//					unset( $value[ $row_index ][ $col_index ] );
//				} else {
//					$datatype = $possible_keys[ $col_index ];
//					switch ( $datatype ) {
//						case 'string':
//							$value[ $row_index ][ $col_index ] = sanitize_text_field( $col_value );
//							break;
//						case 'int':
//						case 'boolean':
//						default:
//							$value[ $row_index ][ $col_index ] = intval( $col_value );
//							break;
//					}
//				}
//			}
//
//			//Ensure that all required keys are set with at least an empty value
//			foreach ( $possible_keys as $key => $data_type ) {
//				if ( ! isset( $value[ $row_index ][ $key ] ) ) {
//					$value[ $row_index ][ $key ] = false;
//				}
//			}
//		}
//	}
//
//	return $value;
//}

function burst_get_user_roles(){
    global $wp_roles;
    return $wp_roles->get_names();
}