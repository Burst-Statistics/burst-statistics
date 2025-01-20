<?php
defined( 'ABSPATH' ) or die();

function burst_menu() {
	$menu_items = [
		[
			'id'    => 'dashboard',
			'title' => __( 'Dashboard', 'burst-statistics' ),
			'default_hidden' => false,
			'menu_items' => [],
			'capabilities' => 'view_burst_statistics',
		],
		[
			'id'    => 'statistics',
			'title' => __( 'Statistics', 'burst-statistics' ),
			'default_hidden' => false,
			'menu_items' => [],
			'capabilities' => 'view_burst_statistics',
		],
		[
			'id'         => 'settings',
			'title'      => __( 'Settings', 'burst-statistics' ),
			'default_hidden' => false,
			'capabilities' => 'manage_burst_statistics',
			'menu_items' => [
				[
					'id'       => 'general',
					'group_id' => 'general',
					'title'    => __( 'General', 'burst-statistics' ),
					'step'     => 1,
					'groups'   => [
						[
							'id'    => 'general',
							'title' => __( 'General', 'burst-statistics' ),
						],
						[
							'id'    => 'email_reports',
							'title' => __( 'Email reports', 'burst-statistics' ),
							'description' => __( 'Get weekly or monthly reports sent to your email.', 'burst-statistics' ),
						],
					],
				],
				[
					'id'       => 'goals',
					'group_id' => 'goals',
					'title'    => __( 'Goals', 'burst-statistics' ),
					'step'     => 1,
					'groups'   => [
						[
							'id'    => 'goals',
							'title' => __( 'Goals', 'burst-statistics' ),
						],
					],
				],
				[
					'id'       => 'data',
					'group_id' => 'archiving',
					'title'    => __( 'Data', 'burst-statistics' ),
					'step'     => 1,
					'groups'   => [
						[
							'id'    => 'data_archiving',
							'title' => __( 'Archiving', 'burst-statistics' ),
						],
						[
							'id'    => 'restore_archives',
							'title' => __( 'Archived Data', 'burst-statistics' ),
							'pro'      => true,
							'upgrade'     => burst_get_website_url('pricing/', [
								'burst_source'   => 'setting-upgrade',
								'burst_content'   => 'data-archiving',
							]),
							'pro_text' => __( "Manage your archived data with %sBurst Pro%s", 'burst-statistics' ),
						],
					],
				],
				[
					'id'       => 'advanced',
					'group_id' => 'tracking',
					'title'    => __( 'Advanced', 'burst-statistics' ),
					'step'     => 1,
					'groups'   => [
						[
							'id'    => 'tracking',
							'title' => __( 'Tracking', 'burst-statistics' ),
						],
						[
							'id'    => 'scripts',
							'title' => __( 'Scripts', 'burst-statistics' ),
						],
					],
				],

			],
		],
	];

	// remove items where capabilities are not met
	foreach ( $menu_items as $key => $menu_item ) {
		if ( ! current_user_can( $menu_item['capabilities'] ) ) {
			unset( $menu_items[ $key ] );
		}
	}

	return apply_filters( 'burst_menu', $menu_items);
}

function burst_migrate_settings( $prev_version ) {


}

add_action( 'burst_upgrade', 'burst_migrate_settings', 10, 1 );

function burst_fields( $load_values = true ) {

	if ( ! burst_user_can_manage() ) {
		return [];
	}
	$fields = [
		[
			'id'       => 'review_notice_shown',
			'menu_id'  => 'general',
			'group_id' => 'general',
			'type'     => 'hidden',
			'label'    => '',
			'disabled' => false,
			'default'  => false,
		],
		[
			'id'       => 'burst_tour_shown_once',
			'menu_id'  => 'general',
			'group_id' => 'general',
			'type'     => 'hidden',
			'label'    => '',
			'disabled' => false,
			'default'  => false,
		],
		[
			'id'       => 'exclude_bounces',
			'menu_id'  => 'general',
			'group_id' => 'general',
			'type'     => 'hidden',
			'label'    => '',
			'disabled' => false,
			'default'  => false,
		],
		[
			'id'       => 'enable_turbo_mode',
			'menu_id'  => 'general',
			'group_id' => 'general',
			'type'     => 'checkbox',
			'label'    => __( 'Enable Turbo mode', 'burst-statistics' ),
			'help'     => [
				'label' => 'default',
				'title' => __( 'What is Turbo mode?', 'burst-statistics' ),
				'text'  => __( 'Turbo mode improves pagespeed. When enabled, the script is no longer loaded in the header asynchronously, but is loaded in the footer and deferred. You could lose data from visitors who leave before the page has fully loaded.', 'burst-statistics' ),
				'url'   => burst_get_website_url( '/definition/turbo-mode/', [
					'burst_source'   => 'setting-help',
					'burst_content'   => 'turbo-mode',
				] ),
			],
			'disabled' => false,
			'default'  => false,
		],
		[
			'id'       => 'enable_cookieless_tracking',
			'menu_id'  => 'general',
			'group_id' => 'general',
			'type'     => 'checkbox',
			'label'    => __( 'Enable Cookieless tracking', 'burst-statistics' ),
			'help'     => [
				'label' => 'default',
				'title' => __( 'What is Cookieless tracking?', 'burst-statistics' ),
				'text'  => __( "With cookieless tracking enabled, Burst will not use cookies to determine the number of unique visitors. It will use contextual data, like the browser version and device, also called 'fingerprinting'. The latter could be less reliable for some users.", 'burst-statistics' ),
				'url'   => burst_get_website_url( '/definition/what-is-cookieless-tracking/', [
					'burst_source'   => 'setting-help',
					'burst_content'   => 'cookieless-tracking',
				] ),
			],
			'disabled' => false,
			'default'  => false,
		],
		[
			'id'       => 'enable_do_not_track',
			'menu_id'  => 'general',
			'group_id' => 'general',
			'type'     => 'checkbox',
			'label'    => __( "Honor 'Do Not Track' requests", 'burst-statistics' ),
			'disabled' => false,
			'default'  => false,
		],
		[
			'id'          => 'restart_tour',
			'menu_id'     => 'general',
			'group_id'    => 'general',
			'type'        => 'button',
			'url'         => burst_dashboard_url . '#dashboard/tour',
			'button_text' => __( 'Restart', 'burst-statistics' ),
			'label'       => __( 'Restart plugin tour', 'burst-statistics' ),
			'disabled'    => false,
			'default'     => false,
		],
        [
            'id'       => 'dismiss_non_error_notices',
            'menu_id'  => 'general',
            'group_id' => 'general',
            'type'     => 'checkbox',
            'label'    => __( 'Dismiss all notices in your dashboard except critical ones', 'burst-statistics' ),
            'disabled' => false,
            'default'  => false,
        ],
		[
			'id'       => 'email_reports_mailinglist',
			'menu_id'  => 'general',
			'group_id' => 'email_reports',
			'type'     => 'email_reports',
			'label'    => __( 'Email reports', 'burst-statistics' ),
			'disabled' => false,
			'default'  => '',
		],
		[
			'id'          => 'logo_attachment_id',
			'menu_id'     => 'general',
			'group_id'    => 'email_reports',
			'type'        => 'logo_editor',
			'label'       => __( 'Change logo in the email reports', 'burst-statistics' ),
			'pro' => [
				'url' => burst_get_website_url('pricing/', [
					'burst_source'   => 'setting-upgrade',
					'burst_content'   => 'email-reports',
				]),
				'disabled' => false,
			],
			'disabled'    => true,
			'default'     => false,
		],

		[
			'id'       => 'goals',
			'menu_id'  => 'goals',
			'group_id' => 'goals',
			'type'     => 'goals',
			'label'    => __( 'Goals', 'burst-statistics' ),
			'help'     => [
				'label' => 'default',
				'title' => __( 'How to set goals?', 'burst-statistics' ),
				'text'  => __( "To set goals for a website, you need to identify the purpose of the site and the key actions you want visitors to take. Set measurable and achievable goals for each action and track your progress.", 'burst-statistics' ),
				'url'   => burst_get_website_url( 'how-to-set-goals/', [
					'burst_source'   => 'setting-help',
					'burst_content'   => 'goals',
				] ),
			],
			'default' => [],
		],
		[
			'id'       => 'user_role_blocklist',
			'menu_id'  => 'advanced',
			'group_id' => 'tracking',
			'type'     => 'user_role_blocklist',
			'label'    => __( 'Exclude user roles from being tracked', 'burst-statistics' ),
			'help'     => [
				'label' => 'default',
				'title' => __( 'Excluding visitors', 'burst-statistics' ),
				'text'  => __( 'You can exclude visitors by user role and IP address. This will affect new data only.', 'burst-statistics' ),
				'url'   => burst_get_website_url( 'exclude-ip-addresses-from-burst-statistics/', [
					'burst_source'   => 'setting-help',
					'burst_content'   => 'exclude-visitors',
				] ),
			],
			'disabled' => false,
			'default'  => false,
		],
		[
			'id'       => 'ip_blocklist',
			'menu_id'  => 'advanced',
			'group_id' => 'tracking',
			'type'     => 'ip_blocklist',
			'label'    => __( 'Exclude IP address from tracking, separate with a line break', 'burst-statistics' ),
			'disabled' => false,
			'default'  => false,
		],
		[
			'id'       => 'track_url_change',
			'menu_id'  => 'advanced',
			'group_id' => 'tracking',
			'type'     => 'checkbox',
			'label'    => __( "Track URL changes as separate pageviews", 'burst-statistics' ),
			'help'     => [
				'label' => 'default',
				'title' => __( 'Track URL changes as separate pageviews', 'burst-statistics' ),
				'text'  => __('Enable this option to track changes in the URL (such as parameters or fragments) as separate pageviews. This is particularly useful for single-page applications or dynamic websites.', 'burst-statistics'),
			],
			'disabled' => false,
			'default'  => false,
		],

		[
			'id'       => 'combine_vars_and_script',
			'menu_id'  => 'advanced',
			'group_id' => 'scripts',
			'type'     => 'checkbox',
			'label'    => __( 'Merge tracking settings and script', 'burst-statistics' ),
			'help'     => [
				'label' => 'default',
				'title' => __( 'Merge tracking settings and script for optimized delivery', 'burst-statistics' ),
				'text'  => __( 'Boost site speed by merging the Burst settings into the Burst script. This simplifies management and improves loading times, ideal for headless sites or strict security policies.', 'burst-statistics' ),
			],
			'disabled' => false,
			'default'  => false,
		],

		[
			'id'       => 'archive_data',
			'menu_id'  => 'data',
			'group_id' => 'data_archiving',
			'options'  => [

				'none' 	 => __('Don\'t manage',"burst-statistics"),
				'archive' => __('Automatically Archive',"burst-statistics"),
				'delete' => __('Automatically Delete',"burst-statistics"),
			],
			'pro' => [
				'url' => burst_get_website_url('pricing/', [
					'burst_source'   => 'setting-upgrade',
					'burst_content'   => 'data-archiving',
				]),
				'disabled' => false,
			],
			'help'     => [
				'label' => 'default',
				'title' => __( 'Why should I manage old data?', 'burst-statistics' ),
				'text'  => __( 'Managing old data can optimize storage and improve site performance. Choose to archive or delete based on your needs.', 'burst-statistics' ),
				'url'   => burst_get_website_url( 'do-I-need-to-archive-my-data/', [
					'burst_source'   => 'setting-help',
					'burst_content'   => 'data-archiving',
				] ),
			],
			'disabled' => ['archive'],
			'type'     => 'select',
			'label'    => __( 'Choose how to manage old statistics', 'burst-statistics' ),
			// option is string with more than 1 letter
			'comment' => strlen( get_option( 'burst_table_size' ) ) > 1
				? sprintf( _x( 'Burst currently uses %s of your database.', 'e.g. Burst currently uses 10 MB of your database.', "burst-statistics" ), get_option( 'burst_table_size' ) ) : '',
			'default' => false,
		],
		[
			'id'       => 'archive_after_months',
			'menu_id'  => 'data',
			'group_id' => 'data_archiving',
			'min'   	 => 1,
			'type'     => 'number',
			'label'    => __( 'Retain data for how many months?', 'burst-statistics' ),
			'disabled' => false,
			'default'  => 24,
			'react_conditions' => [
				'relation' => 'AND',
				[
					'archive_data' => ['archive', 'delete'],
				],
			],
		],
		[
			'id'       => 'reset',
			'menu_id'  => 'data',
			'group_id' => 'data_archiving',
			'type'     => 'button',
			'warnTitle'     => __( 'Are you sure?', 'burst-statistics' ),
			'warnContent'  => __( 'This will permanently delete all statistics, goals, and goal statistics.', 'burst-statistics' ) . ' ' . __( 'This action can not be undone.', 'burst-statistics' ),
			'warnType' => 'danger', // 'info', 'warning', 'danger
			'action'   => 'reset',
			'button_text'     => __('Reset statistics', 'burst-statistics'),
			'label'    => __( 'Reset statistics', 'burst-statistics' ),
			'comment'   => __( 'This will permanently delete all statistics, goals, and goal statistics.', 'burst-statistics' ),
			'disabled' => false,
			'default'  => false,
		],
		[
			'id'       => 'confirm_delete_data',
			'menu_id'  => 'data',
			'group_id' => 'data_archiving',
			'type'     => 'checkbox',
			'label'    => __( 'Please confirm the deletion, without the possibility to restore.', 'burst-statistics' ),
			'disabled' => false,
			'default'  => false,
			'react_conditions' => [
				'relation' => 'AND',
				[
					'archive_data' => ['delete'],
				],
			],
		],
		[
			'id'       => 'restore_archives',
			'menu_id'  => 'data',
			'group_id' => 'restore_archives',
			'type'     => 'restore_archives',
			'disabled' => false,
			'default'  => false,
		],
	];

	//If the plugin is considered high traffic, summary tables kick in. This can be disabled with this option.
	if ( BURST()->summary->is_high_traffic() || burst_get_option('disable_summary') ) {
		$fields[] = [
			'id'       => 'disable_summary',
			'menu_id'  => 'advanced',
			'group_id' => 'tracking',
			'type'     => 'checkbox',
			'label'    => __( 'Disable the usage of summary tables', 'burst-statistics' ),
			'comment'    => __( 'Using summary tables speeds up the dashboard on higher traffic environments, but can show small differences from the actual data.', 'burst-statistics' ),
			'disabled' => false,
			'default'  => false,
		];
	}

	if ( is_multisite() && burst_is_networkwide_active() && is_main_site() ) {
		$fields[] = [
			'id'       => 'track_network_wide',
			'menu_id'  => 'advanced',
			'group_id' => 'tracking',
			'type'     => 'checkbox',
			'label'    => __( 'Track all hits networkwide, and view them on the dashboard of your main site', 'burst-statistics' ),
			'disabled' => true,
			'pro' => [
				'url' => burst_get_website_url('pricing/', [
					'burst_source'   => 'setting-upgrade',
					'burst_content'   => 'network-wide',
				]),
				'disabled' => false,
			],
			'default'  => false,
		];
	}

	$fields = apply_filters( 'burst_fields', $fields );
	foreach ( $fields as $key => $field ) {
		$field = wp_parse_args( $field, [ 'id'                 => false,
		                                  'visible'            => true,
		                                  'disabled'           => false,
		                                  'new_features_block' => false,
		] );
		if ( $load_values ) {
			$value          = burst_sanitize_field( burst_get_option( $field['id'], $field['default'] ), $field['type'], $field['id'] );
			$field['value'] = apply_filters( 'burst_field_value_' . $field['id'], $value, $field );
			$fields[ $key ] = apply_filters( 'burst_field', $field, $field['id'] );
		}
	}

	$fields = apply_filters( 'burst_fields_values', $fields );

	return array_values( $fields );
}

function burst_goal_fields() {
	$goals = [
		[
			'id'       => 'title',
			'type'     => 'hidden',
			'default'  => false,
		],
		'status' => [
			'id'       => 'status',
			'type'     => 'hidden',
			'default'  => false,
		],

		[
			'id'       => 'type',
			'type'     => 'radio-buttons',
			'label'    => __( 'What type of goal do you want to set?', 'burst-statistics' ),
			'options'  => [
				'clicks' => [
					'label' => __('Clicks', 'burst-statistics'),
			          'description' => __('Track clicks on element', 'burst-statistics'),
			          'type' => 'clicks',
			          'icon' => 'mouse',
					  'server_side' => false,
				],
				'views'  => [
					'label'       => __( 'Views', 'burst-statistics' ),
					'description' => __( 'Track views of element', 'burst-statistics' ),
					'type'        => 'views',
					'icon'        => 'eye',
					'server_side' => false,
				],
				'visits' => [
					'label'       => __( 'Visits', 'burst-statistics' ),
					'description' => __( 'Track visits to page', 'burst-statistics' ),
					'type'        => 'visits',
					'icon'        => 'visitors',
					'server_side' => true,
				],
				'hook' => [
					'label'       => __( 'Hook', 'burst-statistics' ),
					'description' => __( 'Track execution of a WordPress hook', 'burst-statistics' ),
					'type'        => 'hook',
					'icon'        => 'hook',
					'server_side' => true,
				],
			],
			'disabled' => false,
			'default'  => 'clicks',
		],
		[
			'id'               => 'page_or_website',
			'type'             => 'radio-buttons',
			'label'            => __( 'Do you want to track a specific page or the entire website?', 'burst-statistics' ),
			'options'          => [
				'page'    => [
					'label'       => __( 'Page', 'burst-statistics' ),
					'description' => __( 'Track page specific', 'burst-statistics' ),
					'type'        => 'page',
					'icon'        => 'page',
				],
				'website' => [
					'label'       => __( 'Website', 'burst-statistics' ),
					'description' => __( 'Track on whole site', 'burst-statistics' ),
					'type'        => 'website',
					'icon'        => 'website',
				],
			],
			'disabled'         => false,
			'default'          => 'website',
			'react_conditions' => [
				'relation' => 'AND',
				[
					'type' => ['clicks', 'views', 'hook'],
				],
			],
		],
		[
			'id'               => 'specific_page',
			'type'             => 'select-page',
			'label'            => __( 'Which specific page do you want to track?', 'burst-statistics' ),
			'disabled'         => false,
			'default'          => false,
			'react_conditions' => [
				'relation' => 'OR',
				[
					'page_or_website' => ['page'],
					'type' => ['visits'],
				],
			],
		],
		[
			'id'               => 'attribute',
			'type'             => 'hidden',
			'default'          => 'class',
			'react_conditions' => [
				'relation' => 'AND',
				[
					'type'=> ['clicks', 'views'],
				],
			],
		],
		[
			'id'               => 'attribute_value',
			'type'             => 'class-id',
			'label'            => __( 'What element do you want to track?', 'burst-statistics' ),
			'disabled'         => false,
			'default'          => '',
			'react_conditions' => [
				'relation' => 'AND',
				[
					'type'=> ['clicks', 'views'],
				],
			],
		],
		[
			'id'               => 'hook',
			'type'             => 'hook',
			'label'            => __( 'What hook do you want to track?', 'burst-statistics' ),
			'disabled'         => false,
			'default'          => '',
			'react_conditions' => [
				'relation' => 'AND',
				[
					'type'=> ['hook'],
				],
			],
		],
		[
			'id'               => 'conversion_metric',
			'type'             => 'radio-buttons',
			'label'            => __( 'What metric do you want to use to calculate the conversion rate?', 'burst-statistics' ),
			'options'          => [
				'visitors'    => [
					'label'       => __( 'Visitors', 'burst-statistics' ),
					'type'        => 'visitors',
					'icon'        => 'visitors',
				],
				'sessions' => [
					'label'       => __( 'Sessions', 'burst-statistics' ),
					'type'        => 'sessions',
					'icon'        => 'sessions',
				],
				'pageviews' => [
					'label'       => __( 'Pageviews', 'burst-statistics' ),
					'type'        => 'pageviews',
					'icon'        => 'pageviews',
				],
			],
			'disabled'         => false,
			'default'          => 'visitors',
		],
	];

	return apply_filters( 'burst_goal_fields', $goals );
}
