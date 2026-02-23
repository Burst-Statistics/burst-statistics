<?php

defined( 'ABSPATH' ) || die();

return [
	[
		'id'                      => 'dashboard',
		'title'                   => __( 'Dashboard', 'burst-statistics' ),
		'default_hidden'          => false,
		'menu_items'              => [],
		'capabilities'            => 'view_burst_statistics',
		'menu_slug'               => 'burst',
		'show_in_admin'           => true,
		'show_in_plugin_overview' => true,
	],
	[
		'id'             => 'statistics',
		'title'          => __( 'Insights', 'burst-statistics' ),
		'default_hidden' => true,
		'menu_items'     => [],
		'capabilities'   => 'view_burst_statistics',
		'menu_slug'      => 'burst#/statistics',
		'show_in_admin'  => true,
		'shareable'      => true,
	],
	[
		'id'             => 'sources',
		'title'          => __( 'Sources', 'burst-statistics' ),
		'default_hidden' => false,
		'menu_items'     => [],
		'capabilities'   => 'view_burst_statistics',
		'menu_slug'      => 'burst#/sources',
		'show_in_admin'  => true,
		'pro'            => true,
		'shareable'      => true,
	],
	[
		'id'                      => 'reporting',
		'title'                   => __( 'Reporting', 'burst-statistics' ),
		'default_hidden'          => false,
		'capabilities'            => 'manage_burst_statistics',
		'menu_slug'               => 'burst#/reporting/reports',
		'show_in_admin'           => true,
		'show_in_plugin_overview' => true,
		'location'                => 'right',
		'menu_items'              => [
			[
				'id'       => 'reports',
				'group_id' => 'reports',
				'title'    => __( 'Reports', 'burst-statistics' ),
				'groups'   => [
					[
						'id'    => 'reports',
						'title' => __( 'Reports', 'burst-statistics' ),
					],
				],
			],
			[
				'id'       => 'customization',
				'group_id' => 'customization',
				'title'    => __( 'Customization', 'burst-statistics' ),
				'groups'   => [
					[
						'id'    => 'customization',
						'title' => __( 'Customization', 'burst-statistics' ),
					],
				],
			],
			[
				'id'       => 'logs',
				'group_id' => 'logs',
				'title'    => __( 'Logs', 'burst-statistics' ),
				'groups'   => [
					[
						'id'    => 'logs',
						'title' => __( 'Logs', 'burst-statistics' ),
					],
				],
			],
		],
	],
	[
		'id'                      => 'settings',
		'title'                   => __( 'Settings', 'burst-statistics' ),
		'default_hidden'          => false,
		'capabilities'            => 'manage_burst_statistics',
		'menu_slug'               => 'burst#/settings/general',
		'show_in_admin'           => true,
		'show_in_plugin_overview' => true,
		'location'                => 'right',
		'menu_items'              => [
			[
				'id'       => 'general',
				'group_id' => 'general',
				'title'    => __( 'General', 'burst-statistics' ),
				'groups'   => [
					[
						'id'    => 'general',
						'title' => __( 'General', 'burst-statistics' ),
					],
					[
						'id'    => 'anonymous_usage_data',
						'title' => __( 'Anonymous usage data', 'burst-statistics' ),
					],
				],
			],
			[
				'id'       => 'goals',
				'group_id' => 'goals',
				'title'    => __( 'Goals', 'burst-statistics' ),
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
				'groups'   => [
					[
						'id'    => 'data_archiving',
						'title' => __( 'Archiving', 'burst-statistics' ),
					],
					[
						'id'    => 'restore_archives',
						'title' => __( 'Archived Data', 'burst-statistics' ),
						'pro'   => [
							'url'  => 'pricing/',
							'text' => __( 'With Pro, you can archive old data to keep your dashboard clean and restore it anytime when needed. No more lost data. No more clutter. Just seamless control.', 'burst-statistics' ),
						],
					],
					[
						'id'    => 'import_export_settings',
						'title' => __( 'Manage settings', 'burst-statistics' ),
					],
				],
			],
			[
				'id'       => 'advanced',
				'group_id' => 'tracking',
				'title'    => __( 'Advanced', 'burst-statistics' ),
				'groups'   => [
					[
						'id'    => 'tracking',
						'title' => __( 'Tracking exclusions', 'burst-statistics' ),
					],
					[
						'id'    => 'data_collection',
						'title' => __( 'Tracking behavior', 'burst-statistics' ),
					],
					[
						'id'    => 'scripts',
						'title' => __( 'Scripts', 'burst-statistics' ),
					],
					[
						'id'    => 'beta',
						'title' => __( 'Beta', 'burst-statistics' ),
					],
				],
			],
			[
				'id'           => 'secret',
				'group_id'     => 'secret',
				'title'        => __( 'Secret', 'burst-statistics' ),
				'hidden'       => true,
				'capabilities' => 'manage_burst_statistics',
				'groups'       => [
					[
						'id'    => 'secret',
						'title' => __( 'Secret Settings', 'burst-statistics' ),
					],
				],
			],

		],
	],
];
