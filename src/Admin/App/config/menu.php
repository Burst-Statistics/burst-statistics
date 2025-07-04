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
	],
	[
		'id'                      => 'settings',
		'title'                   => __( 'Settings', 'burst-statistics' ),
		'default_hidden'          => false,
		'capabilities'            => 'manage_burst_statistics',
		'menu_slug'               => 'burst#/settings/general',
		'show_in_admin'           => true,
		'show_in_plugin_overview' => true,
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
						'id'    => 'email_reports',
						'title' => __( 'Email reports', 'burst-statistics' ),
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
