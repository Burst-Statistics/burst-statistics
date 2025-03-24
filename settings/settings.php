<?php
defined( 'ABSPATH' ) or die();

/**
 * Enqueue Gutenberg block assets for backend editor.
 *
 * @since 1.0.0
 */
require_once burst_path . 'settings/config/config.php';
require_once burst_path . 'settings/rest-api-optimizer/rest-api-optimizer.php';
require_once burst_path . 'settings/media/media-override.php';

/**
 * WordPress doesn't allow for translation of chunks resulting of code splitting.
 * Several workarounds have popped up in JetPack and Woocommerce: https://developer.wordpress.com/2022/01/06/wordpress-plugin-i18n-webpack-and-composer/
 * Below is mainly based on the Woocommerce solution, which seems to be the most simple approach. Simplicity is king here.
 *
 * @return array
 */
function burst_get_chunk_translations( $dir ): array
{
    $text_domain = 'burst-statistics';
    $languages_dir = defined('burst_pro') ? burst_path . 'languages' : WP_CONTENT_DIR . '/languages/plugins';
    $json_translations = [];
    $locale = determine_locale();
    $languages = [];

    if ( is_dir($languages_dir) ) {
        // Get all JSON files matching text domain & locale
        foreach (glob("$languages_dir/{$text_domain}-{$locale}-*.json") as $language_file) {
            $languages[] = basename($language_file);
        }
    }

    foreach ($languages as $src) {
        $hash = str_replace([$text_domain . '-', $locale . '-', '.json'], '', $src);
        wp_register_script($hash, plugins_url($src, __FILE__), [], true);
        $localeData = load_script_textdomain($hash, $text_domain, $languages_dir);
        wp_deregister_script($hash);

        if ( !empty($localeData) ) {
            $json_translations[] = $localeData;
        }
    }
    $js_files = glob(burst_path . $dir."/index*.js");
    $asset_files = glob(burst_path . $dir."/index*.asset.php");
    $js_filename = !empty($js_files) ? basename($js_files[0]) : '';
    $asset_filename = !empty($asset_files) ? basename($asset_files[0]) : '';
	$asset_file = require burst_path . $dir . '/' . $asset_filename;

	if ( empty( $js_filename ) ) {
		return [];
	}

	return [
		'json_translations' => $json_translations,
		'js_file'           => $js_filename,
		'dependencies'      => $asset_file['dependencies'],
		'version'           => $asset_file['version'],
	];
}

function burst_plugin_admin_scripts() {
	$js_data = burst_get_chunk_translations( 'settings/build' );
	if ( empty( $js_data ) ) {
		return;
	}
	burst_wp_enqueue_media();
	wp_enqueue_script(
		'burst-settings',
		plugins_url( 'build/' . $js_data['js_file'], __FILE__ ),
		$js_data['dependencies'],
		$js_data['version'],
		true
	);
	$path = defined( 'burst_pro' ) ? burst_path . 'languages' : false;
	wp_set_script_translations( 'burst-settings', 'burst-statistics', $path );

	wp_localize_script(
		'burst-settings',
		'burst_settings',
		burst_localized_settings( $js_data )
	);
}

function burst_localized_settings( $js_data ) {
	return apply_filters(
		'burst_localize_script',
		[
			'json_translations'       => $js_data['json_translations'],
			'menu'                    => burst_menu(),
			'site_url'                => get_rest_url(),
			'admin_ajax_url'          => add_query_arg( array( 'action' => 'burst_rest_api_fallback' ), admin_url( 'admin-ajax.php' ) ),
			'dashboard_url'           => burst_admin_url( 'burst' ),
			'plugin_url'              => burst_url,
			'network_link'            => network_site_url( 'plugins.php' ),
			'is_pro'                  => burst_is_pro(),
			'nonce'                   => wp_create_nonce( 'wp_rest' ), // to authenticate the logged in user
			'burst_nonce'             => wp_create_nonce( 'burst_nonce' ),
			'current_ip'              => burst_get_ip_address(),
			'user_roles'              => burst_get_user_roles(),
			'date_ranges'             => burst_get_date_ranges(),
			'date_format'             => get_option( 'date_format' ),
			'tour_shown'              => burst_get_option( 'burst_tour_shown_once' ),
			'gmt_offset'              => get_option( 'gmt_offset' ),
			'goals_information_shown' => (int) get_option( 'burst_goals_information_shown' ),
            'burst_version'           => burst_version,
            'burst_pro'               => defined( 'burst_pro' ),
		]
	);
}

/**
 * If the rest api is blocked, the code will try an admin ajax call as fall back.
 *
 * @return void
 */
function burst_rest_api_fallback() {
	$response = [];
	$error    = $action = $do_action = $data = $data_type = false;
	if ( ! burst_user_can_view() ) {
		$error = true;
	}

	// if the site is using this fallback, we want to show a notice
	update_option( 'burst_ajax_fallback_active', time(), false );
	if ( isset( $_GET['rest_action'] ) ) {
		$action = sanitize_text_field( $_GET['rest_action'] );
		if ( strpos( $action, 'burst/v1/data/' ) !== false ) {
			$data_type = strtolower( str_replace( 'burst/v1/data/', '', $action ) );
		}
	}

    // get all of the rest of the $_GET parameters so we can forward them in the REST request
    $get_params = $_GET;
    // remove the rest_action parameter
    unset($get_params['rest_action']);

    // convert get metrics to array if it is a string
    if ( isset( $get_params['metrics'] ) && is_string( $get_params['metrics'] ) ) {
        $get_params['metrics'] = explode(',', $get_params['metrics']);
    }

	// Handle filters - check if it's a string and needs slashes removed
	if ( isset( $get_params['filters'] ) ) {
		if (is_string($get_params['filters'])) {
			// Remove slashes but keep as JSON string for later decoding
			$get_params['filters'] = stripslashes($get_params['filters']);
		}
	}

    

	$requestData = json_decode( file_get_contents( 'php://input' ), true );
	if ( $requestData ) {
		$action = $requestData['path'] ?? false;

		$action = sanitize_text_field( $action );
		$data   = $requestData['data'] ?? false;
		if ( strpos( $action, 'burst/v1/do_action/' ) !== false ) {
			$do_action = strtolower( str_replace( 'burst/v1/do_action/', '', $action ) );
		}
	}


	$request = new WP_REST_Request();
	$args    = array( 'type', 'nonce', 'date_start', 'date_end', 'args', 'search', 'filters', 'metrics', 'group_by'  );
	foreach ( $args as $arg ) {
		if ( isset( $get_params[ $arg ] ) ) {
			$request->set_param( $arg,  $get_params[ $arg ] );
		}
	}

	if ( ! $error ) {
		if ( strpos( $action, '/fields/get' ) !== false ) {
			$response = burst_rest_api_fields_get( $request );
		} elseif ( strpos( $action, '/fields/set' ) !== false ) {
			$response = burst_rest_api_fields_set( $request, $data );
		} elseif ( strpos( $action, '/options/set' ) !== false ) {
			$response = burst_rest_api_options_set( $request, $data );
		} elseif ( strpos( $action, '/goals/get' ) !== false ) {
			$response = burst_rest_api_goals_get( $request );
		} elseif ( strpos( $action, '/goals/add' ) !== false ) {
			$response = burst_rest_api_goals_add( $request, $data );
		} elseif ( strpos( $action, '/goals/delete' ) !== false ) {
			$response = burst_rest_api_goals_delete( $request, $data );
		} elseif ( strpos( $action, '/goal_fields/get' ) !== false ) {
			$response = burst_rest_api_goal_fields_get( $request );
		} elseif ( strpos( $action, '/goals/set' ) !== false ) {
			$response = burst_rest_api_goals_set( $request, $data );
		} elseif ( strpos( $action, '/posts/' ) !== false ) {
			$response = burst_get_posts( $request, $data );
		} elseif ( strpos( $action, '/data/' ) ) {
			$request->set_param( 'type', $data_type );
			$response = burst_get_data( $request );
		} elseif ( $do_action ) {
			$request = new WP_REST_Request();
			$request->set_param( 'action', $do_action );
			$response = burst_do_action( $request, $data );
		}
	}

	header( 'Content-Type: application/json' );
	echo json_encode( $response );
	exit;
}

add_action( 'wp_ajax_burst_rest_api_fallback', 'burst_rest_api_fallback' );

function burst_add_option_menu() {
	if ( ! burst_user_can_view() ) {
		return;
	}

	// if track network wide is enabled, show the menu only on the main site
	if ( is_multisite() && get_site_option( 'burst_track_network_wide' ) && burst_is_networkwide_active() ) {
		if ( ! is_main_site() ) {
			return;
		}
	}

    $menu_label = __( 'Statistics', 'burst-statistics' );
	$count       = BURST()->tasks->plusone_count();
	$warning_title  = esc_attr( burst_sprintf( '%d plugin warnings', $count ) );
	if ( $count > 0 ) {
		$warning_title .= ' ' . esc_attr( burst_sprintf( '(%d plus ones)', $count ) );
		$menu_label    .=
			"<span class='update-plugins count-$count' title='$warning_title'>
			<span class='update-count'>
				" . number_format_i18n( $count ) . '
			</span>
		</span>';
	}

	$page_hook_suffix = add_menu_page(
		'Burst Statistics',
		$menu_label,
		'view_burst_statistics',
		'burst',
		'burst_dashboard',
		 burst_url . 'assets/img/burst-wink.svg',
		apply_filters('burst_menu_position', 3)
	);

	add_submenu_page(
		'burst',
		__('Statistics', 'burst-statistics'),
		__('Statistics', 'burst-statistics'),
		'view_burst_statistics',
		'burst#statistics',
		'burst_dashboard'
	);

    add_submenu_page(
        'burst',
        __('Settings', 'burst-statistics'),
        __('Settings', 'burst-statistics'),
        'view_burst_statistics',
        'burst#settings',
        'burst_dashboard'
    );

	if ( !defined( 'burst_pro' ) ) {
		global $submenu;
		if (isset($submenu['burst'])) {
			$class                  = 'burst-link-upgrade';
			$highest_index = count($submenu['burst']);
			$submenu['burst'][] = array(
				__( 'Upgrade to Pro', 'burst-statistics' ),
				'manage_burst_statistics',
				burst_get_website_url('pricing/', ['burst_source' => 'plugin-submenu-upgrade'])
			);
			if ( isset( $submenu['burst'][$highest_index] ) ) {
				if (! isset ($submenu['burst'][$highest_index][4])) $submenu['burst'][$highest_index][4] = '';
				$submenu['burst'][$highest_index][4] .= ' ' . $class;
			}
		}
	}

	add_action( "admin_print_scripts-{$page_hook_suffix}", 'burst_plugin_admin_scripts' );
}
add_action( 'admin_menu', 'burst_add_option_menu' );

function burst_fix_duplicate_menu_item() {
	?>
    <script>
      window.addEventListener("load", () => {
        let burstMain = document.querySelector('li.wp-has-submenu.toplevel_page_burst a.wp-first-item');
        if (burstMain) {
          burstMain.innerHTML = burstMain.innerHTML.replace('<?php esc_html_e(__( 'Statistics', 'burst-statistics'))?>', '<?php esc_html_e(__( 'Dashboard', 'burst-statistics'))?>');
        }
      });
    </script>

	<?php
	/**
	 * Ensure the items are selected in sync with the burst react menu.
	 */
	if(isset($_GET['page']) && $_GET['page']==='burst') {
		?>
        <script>
          const burstSetActive = (obj) => {
            obj.classList.add('current');
            obj.parentNode.classList.add('current');
          }

          window.addEventListener("load", () => {
            let burstMain = document.querySelector('li.wp-has-submenu.toplevel_page_burst a.wp-first-item');
            if (burstMain) {
              burstMain.href = '#';
            }
          });
          //get the hash from the current url
          let burstHash = window.location.hash;
          //strip off anything after a /
          if ( burstHash.indexOf('/') !== -1 ) {
            burstHash = burstHash.substring(0, burstHash.indexOf('/'));
          }
          if ( !burstHash ) {
            let burstMain = document.querySelector('li.wp-has-submenu.toplevel_page_burst a.wp-first-item');
            burstSetActive(burstMain);
          } else {
            let burstMenuItems = document.querySelector('li.wp-has-submenu.toplevel_page_burst').querySelectorAll('a');
            for (const link of burstMenuItems) {
              if (burstHash && link.href.indexOf(burstHash) !== -1) {
                burstSetActive(link);
              } else {
                link.classList.remove('current');
                link.parentNode.classList.remove('current');
              }
            }
          }

          window.addEventListener('click', (e) => {
            const burstTargetHref = e.target && e.target.href;
            let burstIsMainMenu = false;
            let burstIsWpMenu = false;
            if (burstTargetHref && e.target.classList.contains('burst-main')) {
              burstIsMainMenu = true;
            } else if (burstTargetHref && burstTargetHref.indexOf('admin.php')!==-1) {
              burstIsWpMenu = true;
            }
            if (!burstIsWpMenu && !burstIsMainMenu) {
              return;
            }
            if (burstIsWpMenu) {
              if (burstTargetHref && burstTargetHref.indexOf('page=burst') !== -1) {
                const parentElement = e.target.parentNode.parentNode;
                const childLinks = parentElement.querySelectorAll('li, a');
                // Loop through each 'a' element and add the class
                for (const link of childLinks) {
                  link.classList.remove('current');
                }
                e.target.classList.add('current');
                e.target.parentNode.classList.add('current');
              }
            } else {
              //find burstTargetHref in wordpress menu
              let burstMenuItems = document.querySelector('li.wp-has-submenu.toplevel_page_burst').querySelectorAll('a');
              for (const link of burstMenuItems) {
                //check if last character of link.href is '#'
                if (burstTargetHref.indexOf('dashboard')!==-1 && link.href.charAt(link.href.length - 1) === '#'){
                  burstSetActive(link);
                } else if (burstTargetHref && link.href.indexOf(burstTargetHref) !== -1) {
                  burstSetActive(link);
                } else {
                  link.classList.remove('current');
                  link.parentNode.classList.remove('current');
                }
              }
            }
          });
        </script>
		<?php
	}
}
add_action('admin_footer', 'burst_fix_duplicate_menu_item', 1);

function burst_remove_fallback_notice() {
	if ( get_option( 'burst_ajax_fallback_active' ) !== false ) {
		delete_option( 'burst_ajax_fallback_active' );
	}
}

/**
 * Render the settings page
 */
function burst_dashboard() {
	if ( ! burst_user_can_view() ) {
		return;
	}
	?>
	<div id="burst-statistics" class="burst">
		<div class="burst-header-container">
			<div class="burst-header">
				<img class="burst-logo"
					src="<?php echo burst_url . 'assets/img/burst-logo.svg'; ?>"
					alt="Burst Statistics logo"/>
			</div>
		</div>
		<div class="burst-content-area burst-grid burst-dashboard burst-page-placeholder">
			<div class="burst-grid-item  burst-column-2 burst-row-2 "></div>
			<div class="burst-grid-item burst-row-2"></div>
			<div class="burst-grid-item burst-row-2"></div>
			<div class="burst-grid-item  burst-column-2"></div>
		</div>
	</div>
	<div id="burst-statistics-modal"></div>
	<?php
}

add_action( 'rest_api_init', 'burst_settings_rest_route', 1 );
function burst_settings_rest_route() {
	register_rest_route(
		'burst/v1',
		'menu',
		array(
			'methods'             => 'GET',
			'callback'            => 'burst_rest_api_menu',
			'permission_callback' => function () {
				return burst_user_can_manage();
			},
		)
	);

	// setOption
	register_rest_route(
		'burst/v1',
		'options/set',
		array(
			'methods'             => 'POST',
			'callback'            => 'burst_rest_api_options_set',
			'permission_callback' => function () {
				return burst_user_can_manage();
			},
		)
	);

	register_rest_route(
		'burst/v1',
		'fields/get',
		[
			'methods'             => 'GET',
			'callback'            => 'burst_rest_api_fields_get',
			'permission_callback' => function () {
				return burst_user_can_manage();
			},
		]
	);

	register_rest_route(
		'burst/v1',
		'fields/set',
		[
			'methods'             => 'POST',
			'callback'            => 'burst_rest_api_fields_set',
			'permission_callback' => function () {
				return burst_user_can_manage();
			},
		]
	);

	register_rest_route(
		'burst/v1',
		'goals/get',
		[
			'methods'             => 'GET',
			'callback'            => 'burst_rest_api_goals_get',
			'permission_callback' => function () {
				return burst_user_can_view();
			},
		]
	);

	register_rest_route(
		'burst/v1',
		'goals/delete',
		[
			'methods'             => 'POST',
			'callback'            => 'burst_rest_api_goals_delete',
			'permission_callback' => function () {
				return burst_user_can_manage();
			},
		]
	);

	register_rest_route(
		'burst/v1',
		'goals/add_predefined',
		[
			'methods'             => 'POST',
			'callback'            => 'burst_rest_api_goals_add_predefined',
			'permission_callback' => function () {
				return burst_user_can_manage();
			},
		]
	);
	// add_predefined
	register_rest_route(
		'burst/v1',
		'goals/add',
		[
			'methods'             => 'POST',
			'callback'            => 'burst_rest_api_goals_add',
			'permission_callback' => function () {
				return burst_user_can_manage();
			},
		]
	);

	register_rest_route(
		'burst/v1',
		'goals/set',
		[
			'methods'             => 'POST',
			'callback'            => 'burst_rest_api_goals_set',
			'permission_callback' => function () {
				return burst_user_can_manage();
			},
		]
	);

	register_rest_route(
		'burst/v1',
		'data/(?P<type>[a-z\_\-]+)',
		[
			'methods'             => 'GET',
			'callback'            => 'burst_get_data',
			'permission_callback' => function () {
				return burst_user_can_view();
			},
		]
	);

	register_rest_route(
		'burst/v1',
		'do_action/(?P<action>[a-z\_\-]+)',
		[
			'methods'             => 'POST',
			'callback'            => 'burst_do_action',
			'permission_callback' => function () {
				return burst_user_can_view();
			},
		]
	);

	register_rest_route(
		'burst/v1',
		'/posts/',
		[
			'methods'             => 'GET',
			'callback'            => 'burst_get_posts',
			'args'                => [
				'search_input' => [
					'required'          => false,
					'sanitize_callback' => 'sanitize_title',
				],
			],
			'permission_callback' => function () {
				return burst_user_can_manage();
			},
		]
	);
}


/**
 * @param WP_REST_Request $request
 *
 * @return WP_REST_Response | WP_Error
 */
function burst_do_action( $request, $ajax_data = false ) {
	if ( ! burst_user_can_view() ) {
		return new WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', [ 'status' => 403 ] );
	}
	$action = sanitize_title( $request->get_param( 'action' ) );
	$data   = $ajax_data ?: $request->get_params();
	$nonce  = $data['nonce'];
	if ( ! burst_verify_nonce( $nonce, 'burst_nonce' ) ) {
		return new WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', [ 'status' => 400 ] );
	}

	$data = $data['action_data'];
	if ( ! $ajax_data ) {
		burst_remove_fallback_notice();
	}

	switch ( $action ) {
		case 'plugin_actions':
			$data = burst_plugin_actions( $request, $data );
			break;
		case 'tasks':
			$data = BURST()->tasks->get();
			break;
		case 'dismiss_task':
            if ( isset($data['id']) ) {
                $id = sanitize_title( $data['id'] );
                BURST()->tasks->dismiss_task($id);
            }
			break;
		case 'otherpluginsdata':
			$data = burst_other_plugins_data();
			break;
		case 'tracking':
			$data = BURST()->endpoint->get_tracking_status_and_time();
			break;
		default:
			$data = apply_filters( 'burst_do_action', array(), $action, $data );
	}

	if ( ob_get_length() ) {
		ob_clean();
	}

	return new WP_REST_Response(
		[
			'data'            => $data,
			'request_success' => true,
		],
		200
	);
}

/**
 * Process plugin installation or activation actions
 *
 * @param WP_REST_Request $request
 *
 * @return array
 */
function burst_plugin_actions( $request, $data ) {
	if ( ! burst_user_can_manage() ) {
		return array();
	}
	$slug      = sanitize_title( $data['slug'] );
	$action    = sanitize_title( $data['pluginAction'] );
	$installer = new burst_installer( $slug );
	if ( $action === 'download' ) {
		$installer->download_plugin();
	} elseif ( $action === 'activate' ) {
		$installer->activate_plugin();
	}

	return burst_other_plugins_data( $slug );
}

/**
 * Get plugin data for other plugin section
 *
 * @param string $slug
 *
 * @return array
 */
function burst_other_plugins_data( $slug = false ) {
	if ( ! burst_user_can_view() ) {
		return array();
	}
	$plugins = [
		[
			'slug'          => 'all-in-one-wp-security-and-firewall',
			'constant_free' => 'AIO_WP_SECURITY_VERSION',
			'constant_pro'  => false,
			'wordpress_url' => 'https://wordpress.org/plugins/all-in-one-wp-security-and-firewall/',
			'upgrade_url'   => 'https://aiosplugin.com/product/all-in-one-wp-security-and-firewall-premium/?src=plugin-burst-other-plugins',
			'title'         => 'All-In-One Security – Simply secure your site',
		],
		[
			'slug'          => 'updraftplus',
			'constant_free' => 'UPDRAFTPLUS_DIR',
			'constant_pro'  => false,
			'wordpress_url' => 'https://wordpress.org/plugins/updraftplus/',
            'upgrade_url'   => 'https://updraftplus.com/shop/updraftplus-premium/?src=plugin-burst-other-plugins',
			'title'         => 'UpdraftPlus - Back-up & migrate your site with ease',
		],
		[
			'slug'          => 'wp-optimize',
			'constant_free' => 'WPO_VERSION',
			'wordpress_url' => 'https://wordpress.org/plugins/wp-optimize/',
			'upgrade_url'   => 'https://getwpo.com/buy/?src=plugin-burst-other-plugins',
			'title'         => 'WP-Optimize – Easily boost your page speed',
		],
	];

	foreach ( $plugins as $index => $plugin ) {
		$installer = new burst_installer( $plugin['slug'] );
		if ( isset( $plugin['constant_pro'] ) && defined( $plugin['constant_pro'] ) ) {
			$plugins[ $index ]['pluginAction'] = 'installed';
		} elseif ( ! $installer->plugin_is_downloaded() && ! $installer->plugin_is_activated() ) {
			$plugins[ $index ]['pluginAction'] = 'download';
		} elseif ( $installer->plugin_is_downloaded() && ! $installer->plugin_is_activated() ) {
			$plugins[ $index ]['pluginAction'] = 'activate';
		} elseif ( isset( $plugin['constant_pro'] ) ) {
				$plugins[ $index ]['pluginAction'] = 'upgrade-to-pro';
		} else {
			$plugins[ $index ]['pluginAction'] = 'installed';
		}
	}

	if ( $slug ) {
		foreach ( $plugins as $plugin ) {
			if ( $plugin['slug'] === $slug ) {
				return $plugin;
			}
		}
	}

	return $plugins;
}

/**
 * @param WP_REST_Request $request
 *
 * @return WP_Error | WP_REST_Response
 */
function burst_get_data( WP_REST_Request $request ) {
	if ( ! burst_user_can_view() ) {
		return new WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', [ 'status' => 403 ] );
	}
	$nonce = $request->get_param( 'nonce' );
	if ( ! burst_verify_nonce( $nonce, 'burst_nonce' ) ) {
		return new WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', [ 'status' => 400 ] );
	}

	$type = sanitize_title( $request->get_param( 'type' ) );
    //in the database, the UTC time is stored, so we query by the corrected unix time.
	$args = [
		'date_start' => BURST()->statistics->convert_date_to_unix( $request->get_param( 'date_start' ) . ' 00:00:00' ),
		// add 00:00:00 to date,
		'date_end'   => BURST()->statistics->convert_date_to_unix( $request->get_param( 'date_end' ) . ' 23:59:59' ),
		// add 23:59:59 to date
	];
    

    // possible args
    $available_args = ['filters', 'metrics', 'group_by', 'goal_id'];
    // check for args from $request->get_param( 'filters') etc. and add to $args
    foreach ($available_args as $arg) {
        if ($request->get_param($arg)) {
            $args[$arg] = $request->get_param($arg);
        }
    }

	$args['filters']  = isset($args['filters']) ? burst_sanitize_filters( json_decode($args['filters'])) : array();

	switch ( $type ) {
		case 'live-visitors':
			$data = BURST()->statistics->get_live_visitors_data();
			break;
		case 'today':
			$data = BURST()->statistics->get_today_data( $args );
			break;
		case 'goals':
            $args['goal_id'] = $args['goal_id'] ?? 0;
			$data            = BURST()->goal_statistics->get_goals_data( $args );
			break;
		case 'live-goals':
			$args['goal_id'] = $args['goal_id'] ?? 0;
			$data            = BURST()->goal_statistics->get_live_goals_data( $args );
			break;
		case 'insights':
			$data = BURST()->statistics->get_insights_data( $args );
			break;
		case 'compare':
			if ( isset( $args['filters']['goal_id'] ) ) {
				$data = BURST()->statistics->get_compare_goals_data( $args );
			} else {
				$data = BURST()->statistics->get_compare_data( $args );
			}
			break;
		case 'devicestitleandvalue':
			$data = BURST()->statistics->get_devices_title_and_value_data( $args );
			break;
		case 'devicessubtitle':
			$data = BURST()->statistics->get_devices_subtitle_data( $args );
			break;
		case 'datatable':
			$data = BURST()->statistics->get_datatables_data( $args );
			break;
		case 'referrers':
			$data = BURST()->statistics->get_referrers_data( $args );
			break;
		default:
            $data = apply_filters( 'burst_get_data', [], $type, $args, $request );
	}
	if ( ob_get_length() ) {
		ob_clean();
	}

	if ( isset( $data['error'] ) ) {
		return new WP_Error( 'rest_invalid_data', $data['error'], [ 'status' => 400 ] );
	}

	return new WP_REST_Response(
		[
			'data'            => $data,
			'request_success' => true,
		],
		200
	);
}


function burst_rest_api_options_set( $request, $ajax_data = false ) {
	if ( ! burst_user_can_manage() ) {
		return new WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', [ 'status' => 403 ] );
	}
	$data = $ajax_data ?: $request->get_json_params();

	// get the nonce
	$nonce   = $data['nonce'];
	$options = $data['option'];
	if ( ! burst_verify_nonce( $nonce, 'burst_nonce' ) ) {
		return new WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', [ 'status' => 400 ] );
	}

	// sanitize the options
	$option = sanitize_title( $options['option'] );
	$value  = sanitize_text_field( $options['value'] );

	// option should be prefixed with burst_, if not add it
	if ( strpos( $option, 'burst_' ) !== 0 ) {
		$option = 'burst_' . $option;
	}
	update_option( $option, $value );
	if ( ob_get_length() ) {
		ob_clean();
	}

	return new WP_REST_Response(
		[
			'status'          => 'success',
			'request_success' => true,
		],
		200
	);
}

/**
 * List of allowed field types
 *
 * @param $type
 *
 * @return mixed|string
 */
function burst_sanitize_field_type( $type ) {
	$types = array(
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
        'email_reports',
		'user_role_blocklist',
		'license',
	);
	if ( in_array( $type, $types ) ) {
		return $type;
	}

	return 'checkbox';
}

/**
 * @param WP_REST_Request $request
 *
 * @return WP_ERROR|WP_REST_Response
 */
function burst_rest_api_fields_set( $request, $ajax_data = false ) {
	if ( ! burst_user_can_manage() ) {
		return new WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', [ 'status' => 403 ] );
	}

	$data = $ajax_data ?: $request->get_json_params();
	if ( ! $ajax_data ) {
		burst_remove_fallback_notice();
	}
	// get the nonce
	$nonce  = $data['nonce'];
	$fields = $data['fields'];

	if ( ! burst_verify_nonce( $nonce, 'burst_nonce' ) ) {
		return new WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', [ 'status' => 400 ] );
	}

	$config_fields = burst_fields( false );
	$config_ids    = array_column( $config_fields, 'id' );
	foreach ( $fields as $index => $field ) {
		$config_field_index = array_search( $field['id'], $config_ids );
		if ( ! $config_field_index ) {
			unset( $fields[ $index ] );
			continue;
		}
		$type     = burst_sanitize_field_type( $field['type'] );
		$field_id = sanitize_text_field( $field['id'] );
		$value    = burst_sanitize_field( $field['value'], $type, $field_id );

		$field['value']   = $value;
		$fields[ $index ] = $field;
	}

	$options = get_option( 'burst_options_settings', array() );

	// build a new options array
	foreach ( $fields as $field ) {
		$prev_value = isset( $options[ $field['id'] ] ) ? $options[ $field['id'] ] : false;
		do_action( 'burst_before_save_option', $field['id'], $field['value'], $prev_value, $field['type'] );
		$options[ $field['id'] ] = $field['value'];
	}

	if ( ! empty( $options ) ) {
		update_option( 'burst_options_settings', $options );
	}

	foreach ( $fields as $field ) {
		do_action( 'burst_after_save_field', $field['id'], $field['value'], $prev_value, $field['type'] );
	}
	do_action( 'burst_after_saved_fields', $fields );

	$response_data = [
		'success'         => true,
		'request_success' => true,
		'progress'        => BURST()->tasks->get(),
		'fields'          => burst_fields( true ),
	];
	if ( ob_get_length() ) {
		ob_clean();
	}

	return new WP_REST_Response( $response_data, 200 );
}

/**
 * Update a burst option
 *
 * @param string $name
 * @param mixed  $value
 *
 * @return void
 */
function burst_update_option( $name, $value ) {
	if ( ! burst_user_can_manage() && ! wp_doing_cron() ) {
		return;
	}

	$config_fields      = burst_fields( false );
	$config_ids         = array_column( $config_fields, 'id' );
	$config_field_index = array_search( $name, $config_ids );
	if ( $config_field_index === false ) {
		return;
	}

	$config_field       = $config_fields[ $config_field_index ];
	$type = isset( $config_field['type'] ) ? $config_field['type'] : false;
	if ( ! $type ) {
		return;
	}
	$options = get_option( 'burst_options_settings', [] );
	if ( ! is_array( $options ) ) {
		$options = [];
	}
	$prev_value       = $options[ $name ] ?? false;
	$name             = sanitize_text_field( $name );
	$type             = burst_sanitize_field_type( $config_field['type'] );
	$value            = burst_sanitize_field( $value, $type, $name );
	$value            = apply_filters( 'burst_fieldvalue', $value, sanitize_text_field( $name ), $type );
	$options[ $name ] = $value;
	update_option( 'burst_options_settings', $options, true ); // autoload as this is important for front end as well
	do_action( 'burst_after_save_field', $name, $value, $prev_value, $type );
}

/**
 * Get the rest api fields
 *
 * @return WP_ERROR | WP_REST_Response
 */
function burst_rest_api_fields_get( $request ) {

	if ( ! burst_user_can_view() ) {
		return new WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', array( 'status' => 403 ) );
	}

	$nonce = $request->get_param( 'nonce' );
	if ( ! burst_verify_nonce( $nonce, 'burst_nonce' ) ) {
		return new WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', array( 'status' => 400 ) );
	}

	$output = [];
	$fields = burst_fields();
	$menu   = burst_menu();
	foreach ( $fields as $index => $field ) {
		/**
		 * Load data from source
		 */
		if ( isset( $field['data_source'] ) ) {
			$data_source = $field['data_source'];
			if ( is_array( $data_source ) ) {
				$main           = $data_source[0];
				$class          = $data_source[1];
				$function       = $data_source[2];
				$field['value'] = [];
				if ( function_exists( $main ) ) {
					$field['value'] = $main()->$class->$function();
				}
			} elseif ( function_exists( $field['data_source'] ) ) {
				$func           = $field['data_source'];
				$field['value'] = $func();
			}
		}

		$fields[ $index ] = $field;
	}

	// remove empty menu items
	foreach ( $menu as $key => $menu_group ) {
		$menu_group['menu_items'] = burst_drop_empty_menu_items( $menu_group['menu_items'], $fields );
		$menu[ $key ]             = $menu_group;
	}

	$output['fields']          = $fields;
	$output['request_success'] = true;
	$output['progress']        = BURST()->tasks->get();

	$output = apply_filters( 'burst_rest_api_fields_get', $output );
	if ( ob_get_length() ) {
		ob_clean();
	}

	return new WP_REST_Response( $output, 200 );
}

function burst_rest_api_goals_get( $request ) {
	if ( ! burst_user_can_view() ) {
		return new WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', array( 'status' => 403 ) );
	}

	$nonce = $request->get_param( 'nonce' );
	if ( ! burst_verify_nonce( $nonce, 'burst_nonce' ) ) {
		return new WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', array( 'status' => 400 ) );
	}

	$goals = BURST()->goals->get_goals();

	$goals = apply_filters( 'burst_rest_api_goals_get', $goals );

	$predefined_goals = BURST()->goals->get_predefined_goals();
	if ( ob_get_length() ) {
		ob_clean();
	}

	return new WP_REST_Response(
		array(
			'request_success' => true,
			'goals'           => $goals,
			'predefinedGoals' => $predefined_goals,
			'goalFields'      => burst_goal_fields(),
		),
		200
	);
}

/**
 * Get the rest api fields
 *
 * @return \WP_Error | \WP_REST_Response
 */
function burst_rest_api_goal_fields_get( $request ) {
	if ( ! burst_user_can_manage() ) {
		return new WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', array( 'status' => 403 ) );
	}

	$nonce = $request->get_param( 'nonce' );
	if ( ! burst_verify_nonce( $nonce, 'burst_nonce' ) ) {
		return new WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', array( 'status' => 400 ) );
	}

	$goals = apply_filters( 'burst_rest_api_goals_get', BURST()->goals->get_goals() );
	if ( ob_get_length() ) {
		ob_clean();
	}

	$response = new WP_REST_Response(
		array(
			'request_success' => true,
			'goals'           => $goals,
		)
	);
	$response->set_status( 200 );

	return $response;
}


/**
 * @param WP_REST_Request $request
 *
 * @return WP_REST_Response | WP_Error
 */
function burst_rest_api_goals_set( $request, $ajax_data = false ) {
	if ( ! burst_user_can_manage() ) {
		return new WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', array( 'status' => 403 ) );
	}

	$data  = $ajax_data ?: $request->get_json_params();
	$nonce = $data['nonce'];
	$goals = $data['goals'];

	// get the nonce
	if ( ! burst_verify_nonce( $nonce, 'burst_nonce' ) ) {
		return new WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', array( 'status' => 400 ) );
	}

	require_once burst_path . 'goals/class-goal.php';
	foreach ( $goals as $index => $goal_data ) {
		$id = (int) $goal_data['id'];
		unset( $goal_data['id'] );

		$goal = new burst_goal( $id );
		foreach ( $goal_data as $name => $value ) {
			if ( property_exists( $goal, $name ) ) {
				$goal->{$name} = $value;
			}
		}
		$goal->save();

	}
	if ( ob_get_length() ) {
		ob_clean();
	}
	$response = new WP_REST_Response(
		array(
			'request_success' => true,
		)
	);
	$response->set_status( 200 );

	return $response;
}

/**
 * @param WP_REST_Request $request
 *
 * @return WP_REST_Response | WP_Error
 */
function burst_rest_api_goals_delete( $request, $ajax_data = false ) {
	if ( ! burst_user_can_manage() ) {
		return new WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', array( 'status' => 403 ) );
	}
	$data  = $ajax_data ?: $request->get_json_params();
	$nonce = $data['nonce'];
	if ( ! burst_verify_nonce( $nonce, 'burst_nonce' ) ) {
		return new WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', array( 'status' => 400 ) );
	}
	$id = $data['id'];

	require_once burst_path . 'goals/class-goal.php';
	$goal    = new burst_goal( $id );
	$deleted = $goal->delete();

	// get resulting goals, in case the last one was deleted, and a new one was created.
	// ensure at least one goal
	$goals = BURST()->goals->get_goals();
	// if not null return true
	$response_data = array(
		'deleted'         => $deleted !== null,
		'request_success' => true,
	);
	if ( ob_get_length() ) {
		ob_clean();
	}
	$response = new WP_REST_Response( $response_data );
	$response->set_status( 200 );

	return $response;
}

/**
 * @param WP_REST_Request $request
 *
 * @return WP_REST_Response|WP_Error $response
 */
function burst_rest_api_goals_add_predefined( $request, $ajax_data = false ) {
	if ( ! burst_user_can_manage() ) {
		return new WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', array( 'status' => 403 ) );
	}
	$data  = $ajax_data ?: $request->get_json_params();
	$nonce = $data['nonce'];
	if ( ! burst_verify_nonce( $nonce, 'burst_nonce' ) ) {
		return new WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', array( 'status' => 400 ) );
	}
	$id = $data['id'];

	require_once burst_path . 'goals/class-goal.php';
	$goal = new burst_goal();
	$goal = $goal->add_predefined( $id );
	if ( ob_get_length() ) {
		ob_clean();
	}

	if ( ! $goal ) {
		return new WP_Error( 'rest_goal_not_added', 'The predefined goal was not added.', array( 'status' => 400 ) );
	}

	$response = new WP_REST_Response(
		array(
			'request_success' => true,
			'goal'            => $goal,
		)
	);
	$response->set_status( 200 );

	return $response;
}

/**
 * @param WP_REST_Request $request
 *
 * @return WP_REST_Response|WP_Error $response
 */
function burst_rest_api_goals_add( $request, $ajax_data = false ) {
	if ( ! burst_user_can_manage() ) {
		return new WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', array( 'status' => 403 ) );
	}
	$goal = $ajax_data ?: $request->get_json_params();

	if ( ! burst_verify_nonce( $goal['nonce'], 'burst_nonce' ) ) {
		return new WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', array( 'status' => 400 ) );
	}

	require_once burst_path . 'goals/class-goal.php';
	$goal = new burst_goal();
	$goal->save();

	if ( ob_get_length() ) {
		ob_clean();
	}
	$response = new WP_REST_Response(
		array(
			'request_success' => true,
			'goal'            => $goal,
		)
	);
	$response->set_status( 200 );

	return $response;
}

/**
 * @param WP_REST_Request $request
 *
 * @return WP_REST_Response | WP_Error
 */
function burst_rest_api_menu( $request ) {
	if ( ! burst_user_can_manage() ) {
		return new WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', array( 'status' => 403 ) );
	}
	if ( ob_get_length() ) {
		ob_clean();
	}

	return burst_menu();
}

/**
 * Checks if there are field linked to menu_item if not removes menu_item from menu_item array
 *
 * @param $menu_items
 * @param $fields
 *
 * @return array
 */
function burst_drop_empty_menu_items( $menu_items, $fields ) {
	if ( ! burst_user_can_manage() ) {
		return $menu_items;
	}
	$new_menu_items = $menu_items;
	foreach ( $menu_items as $key => $menu_item ) {
		$searchResult = array_search( $menu_item['id'], array_column( $fields, 'menu_id' ) );
		if ( $searchResult === false ) {
			unset( $new_menu_items[ $key ] );
			// reset array keys to prevent issues with react
			$new_menu_items = array_values( $new_menu_items );
		} elseif ( isset( $menu_item['menu_items'] ) ) {
				$updatedValue                         = burst_drop_empty_menu_items( $menu_item['menu_items'], $fields );
				$new_menu_items[ $key ]['menu_items'] = $updatedValue;
		}
	}

	return $new_menu_items;
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
			return (int) $value;
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
			return (int) $value;
		case 'ip_blocklist':
			return burst_sanitize_ip_field( $value );
        case 'email_reports':
            return burst_sanitize_email_reports( $value );
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

/**
 * Sanitize and validate filters for email reports.
 *
 * @param array $email_reports Array of email reports to sanitize and validate.
 *
 * @return array|bool Sanitized and validated array, or false if user can't manage.
 */
function burst_sanitize_email_reports($email_reports) {
	// Check if the current user has the capability to manage the settings.
	if (!burst_user_can_manage()) {
		return false;
	}

	$sanitized_email_reports = [];
    if ( !is_array($email_reports )) {
	    $email_reports = [];
    }
	foreach ($email_reports as $report) {
		// Initialize an array to hold sanitized report.
		$sanitized_report = [];

		// Sanitize the email field.
		if (isset($report['email'])) {
			$sanitized_report['email'] = sanitize_email($report['email']);
		}

		// Validate and sanitize the frequency field.
		if (isset($report['frequency']) && in_array($report['frequency'], ['monthly', 'weekly'], true)) {
			$sanitized_report['frequency'] = $report['frequency'];
		} else {
			$sanitized_report['frequency'] = 'monthly';
		}

		// Add the sanitized report to the array.
		$sanitized_email_reports[] = $sanitized_report;
	}
    // maximum of 10 email reports
    $sanitized_email_reports = array_slice($sanitized_email_reports, 0, 10);
	return $sanitized_email_reports;
}



/**
 * Get user roles for the settings page in Burst
 *
 * @return array
 */
function burst_get_user_roles(): array {
	if ( ! burst_user_can_manage() ) {
		return [];
	}

	global $wp_roles;

	return $wp_roles->get_names();
}

function burst_get_posts( $request, $ajax_data = false ) {
	if ( ! burst_user_can_view() ) {
		return new WP_Error( 'rest_forbidden', 'You do not have permission to perform this action.', array( 'status' => 403 ) );
	}

    $max_post_count = 100;

	global $wpdb;
	$data   = $ajax_data ?: $request->get_params();
	$nonce  = $data['nonce'];
	$search = isset( $data['search'] ) ? $data['search'] : '';

	if ( ! burst_verify_nonce( $nonce, 'burst_nonce' ) ) {
		return new WP_Error( 'rest_invalid_nonce', 'The provided nonce is not valid.', array( 'status' => 400 ) );
	}

	//do full search for string length above 3, but set a cap at 1000
	if ( strlen($search)>3 ) {
		$max_post_count = 1000;
	}

    $resultArray = [];
    $args        = [
        'post_type' => ['post', 'page'],
        'numberposts' => $max_post_count,
        'order'       => 'DESC',
        'orderby'     => 'meta_value_num',
        'meta_query'  => array(
            'key'  => 'burst_total_pageviews_count',
            'type' => 'NUMERIC',
        ),
    ];
    $posts       = get_posts( $args );
    foreach ( $posts as $post ) {
        $page_url      = get_permalink( $post );
        $resultArray[] = array(
            'page_url'   => str_replace( site_url(), '', $page_url),
            'page_id'    => $post->ID,
            'post_title' => $post->post_title,
            'pageviews'  => (int) get_post_meta( $post->ID, 'burst_total_pageviews_count', true ),
        );
    }

    if ( ob_get_length() ) {
        ob_clean();
    }

    return new WP_REST_Response(
        array(
            'request_success' => true,
            'posts'           => $resultArray,
            'max_post_count' => $max_post_count,
        ),
        200
    );

	//}
//
//	// Initialize an empty array for results
//	$resultArray = [];
//    // Base query for wp_posts
//    $posts_query = "
//        SELECT REPLACE(p.guid, %s, '') AS stripped_url, p.post_title, p.ID as page_id, 0 AS pageviews
//        FROM {$wpdb->prefix}posts p
//        LEFT JOIN {$wpdb->prefix}burst_summary s ON p.guid = CONCAT(%s, s.page_url)
//        WHERE p.post_title LIKE %s AND  p.post_status = 'publish'
//        GROUP BY stripped_url, p.post_title, p.ID
//    ";
//
//    // Base query for wp_burst_summary
//    $stats_query = "
//        SELECT s.page_url AS stripped_url, '' AS post_title, 0 as page_id, COUNT(*) AS pageviews
//        FROM {$wpdb->prefix}burst_summary s
//        WHERE s.page_url LIKE %s
//        GROUP BY stripped_url
//    ";
//
//	    // Combine the two queries using UNION and sort by pageviews
//	    $site_url    = get_site_url();
//	    $final_query = $wpdb->prepare(
//		    'SELECT stripped_url, SUM(pageviews) as total_pageviews, MAX(page_id) as page_id, post_title FROM (
//        (' . $posts_query . ') UNION ALL (' . $stats_query . ')
//    ) AS combined
//    GROUP BY stripped_url, post_title
//    ORDER BY total_pageviews DESC
//    LIMIT %d',
//        $site_url,
//        $site_url,
//        '%' . $wpdb->esc_like( $search ) . '%',
//        '%' . $wpdb->esc_like( $search ) . '%',
//        $max_post_count
//    );
//	$results = $wpdb->get_results( $final_query, ARRAY_A );
//    $results = is_array($results) ? $results : [];
//
//	foreach ( $results as $row ) {
//		$page_url      = $row['stripped_url'];
//		$resultArray[] = array(
//			'page_url'   => $page_url,
//			'page_id'    => $row['page_id'] ?? 0,
//			'post_title' => $row['post_title'],
//			'pageviews'  => (int) $row['total_pageviews'],
//		);
//	}
//
//	if ( ob_get_length() ) {
//		ob_clean();
//	}
//	$resultArray = ! empty( $resultArray ) ? $resultArray : [];
//
//	return new WP_REST_Response(
//		array(
//			'request_success' => true,
//			'posts'           => $resultArray,
//			'max_post_count' => $max_post_count,
//		),
//		200
//	);
}

/**
 * If the track_network_wide option is saved, we update the site_option which is used to handle this behaviour.
 *
 * @param $name
 * @param $value
 * @param $prev_value
 * @param $type
 *
 * @return void
 */
function burst_update_for_multisite( $name, $value, $prev_value, $type ) {
	if ( $name === 'track_network_wide' ) {
		update_site_option( 'burst_track_network_wide', (bool) $value );
	}
}
add_action( 'burst_after_save_field', 'burst_update_for_multisite', 10, 4 );



