<?php

defined( 'ABSPATH' ) || die();

return [
	[
		'id'                      => 'dashboard',
		'title'                   => __( 'Overview', 'burst-statistics' ),
		'description'             => __( 'High-level dashboard overview showing key statistics, visitor metrics, and recent performance at a glance.', 'burst-statistics' ),
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
		'description'    => __( 'Detailed insights into visitors, pageviews, bounce rates, and traffic trends over time.', 'burst-statistics' ),
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
		'description'    => __( 'Analyze where your traffic comes from, including search engines, social media, referrers, and UTM campaigns.', 'burst-statistics' ),
		'default_hidden' => false,
		'menu_items'     => [],
		'capabilities'   => 'view_burst_statistics',
		'menu_slug'      => 'burst#/sources',
		'show_in_admin'  => true,
		'shareable'      => true,
	],
	[
		'id'             => 'engagement',
		'title'          => __( 'Engagement', 'burst-statistics' ),
		'description'    => __( 'Measure visitor engagement with time on page, scroll depth, and page weight.', 'burst-statistics' ),
		'default_hidden' => false,
		'menu_items'     => [],
		'capabilities'   => 'view_burst_statistics',
		'menu_slug'      => 'burst#/engagement',
		'show_in_admin'  => true,
		'shareable'      => true,
	],
	[
		'id'                      => 'goals',
		'title'                   => __( 'Goals', 'burst-statistics' ),
		'description'             => __( 'Track custom conversion goals, set up goal triggers, and view goal conversion metrics.', 'burst-statistics' ),
		'default_hidden'          => false,
		'menu_items'              => [],
		'capabilities'            => 'manage_burst_statistics',
		'menu_slug'               => 'burst#/goals',
		'show_in_admin'           => true,
		'show_in_plugin_overview' => true,
	],
	[
		'id'                      => 'reporting',
		'title'                   => __( 'Reporting', 'burst-statistics' ),
		'description'             => __( 'Configure and schedule automated email and Slack reports, customize report metrics, and view report logs.', 'burst-statistics' ),
		'default_hidden'          => false,
		'capabilities'            => 'manage_burst_statistics',
		'menu_slug'               => 'burst#/reporting/reports',
		'show_in_admin'           => true,
		'show_in_plugin_overview' => true,
		'location'                => 'left',
		'menu_items'              => [
			[
				'id'          => 'reports',
				'group_id'    => 'reports',
				'icon'        => 'graph',
				'title'       => __( 'Reports', 'burst-statistics' ),
				'description' => __( 'Manage scheduled reports and delivery frequencies.', 'burst-statistics' ),
				'groups'      => [
					[
						'id'    => 'reports',
						'title' => __( 'Reports', 'burst-statistics' ),
					],
				],
			],
			[
				'id'          => 'customization',
				'group_id'    => 'customization',
				'icon'        => 'pencil',
				'title'       => __( 'Customization', 'burst-statistics' ),
				'description' => __( 'Customize report appearance, metrics, and email settings.', 'burst-statistics' ),
				'groups'      => [
					[
						'id'    => 'customization',
						'title' => __( 'Customization', 'burst-statistics' ),
					],
					[
						'id'    => 'email',
						'title' => __( 'Email', 'burst-statistics' ),
					],
				],
			],
			[
				'id'          => 'logs',
				'group_id'    => 'logs',
				'icon'        => 'file',
				'title'       => __( 'Logs', 'burst-statistics' ),
				'description' => __( 'View logs of sent reports and delivery statuses.', 'burst-statistics' ),
				'groups'      => [
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
		'description'             => __( 'Configure Burst tracking options, privacy levels, data archiving, integrations, notifications, and advanced settings.', 'burst-statistics' ),
		'default_hidden'          => false,
		'capabilities'            => 'manage_burst_statistics',
		'menu_slug'               => 'burst#/settings/general',
		'show_in_admin'           => true,
		'show_in_plugin_overview' => true,
		'location'                => 'right',
		'icon'                    => 'cog',
		'menu_items'              => [
			[
				'id'          => 'general',
				'group_id'    => 'general',
				'icon'        => 'cog',
				'title'       => __( 'General', 'burst-statistics' ),
				'description' => __( 'Configure general tracking behavior, Turbo mode, Essentials mode, privacy levels, and anonymous data collection.', 'burst-statistics' ),
				'groups'      => [
					[
						'id'    => 'general',
						'title' => __( 'General', 'burst-statistics' ),
					],
					[
						'id'    => 'privacy',
						'title' => __( 'Privacy', 'burst-statistics' ),
					],
					[
						'id'    => 'anonymous_usage_data',
						'title' => __( 'Usage data and benchmarks', 'burst-statistics' ),
					],
				],
			],
			[
				'id'          => 'data',
				'group_id'    => 'archiving',
				'icon'        => 'hard-drive',
				'title'       => __( 'Data', 'burst-statistics' ),
				'description' => __( 'Manage data archiving, restore archives, import historical statistics, and export analytics backups.', 'burst-statistics' ),
				'groups'      => [
					[
						'id'    => 'data_archiving',
						'title' => __( 'Archiving', 'burst-statistics' ),
					],
					[
						'id'    => 'restore_archives',
						'title' => __( 'Archived data', 'burst-statistics' ),
						'pro'   => [
							'url'  => 'pricing/',
							'text' => __( 'With Pro, you can archive old data to keep your dashboard clean and restore it anytime when needed. No more lost data, no more clutter.', 'burst-statistics' ),
						],
					],
					[
						'id'    => 'import_data',
						'title' => __( 'Import data', 'burst-statistics' ),
						'pro'   => [
							'url'  => 'pricing/',
							'text' => __( 'With Pro, you can import historical analytics data from Google Analytics, WP Statistics, Matomo, Plausible, Fathom and more.', 'burst-statistics' ),
						],
					],
					[
						'id'    => 'export_data',
						'title' => __( 'Export data', 'burst-statistics' ),
						'pro'   => [
							'url'  => 'pricing/',
							'text' => __( 'With Pro, you can export a full, performant, chunked backup of all your Burst Statistics tables and options.', 'burst-statistics' ),
						],
					],
					[
						'id'    => 'import_export_settings',
						'title' => __( 'Manage settings', 'burst-statistics' ),
					],
				],
			],
			[
				'id'          => 'features',
				'group_id'    => 'features',
				'icon'        => 'zap',
				'title'       => __( 'Features', 'burst-statistics' ),
				'description' => __( 'Enable or disable features such as external link tracking, scroll depth, bounce rate tracking, and smart update timing.', 'burst-statistics' ),
				'groups'      => [
					[
						'id'    => 'features',
						'title' => __( 'Features', 'burst-statistics' ),
					],
					[
						'id'    => 'smart_update_timing',
						'title' => __( 'Smart update timing', 'burst-statistics' ),
					],
				],
			],
			[
				'id'          => 'notifications',
				'group_id'    => 'notifications',
				'icon'        => 'bell',
				'title'       => __( 'Notifications', 'burst-statistics' ),
				'description' => __( 'Configure traffic spike and drop alerts, email recipients, Slack notifications, and dashboard notices.', 'burst-statistics' ),
				'groups'      => [
					[
						'id'          => 'alerts',
						'title'       => __( 'Alerts', 'burst-statistics' ),
						'description' => __( 'Burst checks your site once a day and tells you when something needs your attention.', 'burst-statistics' ),
					],
					[
						'id'    => 'email',
						'title' => __( 'Email', 'burst-statistics' ),
					],
					[
						'id'    => 'slack',
						'title' => __( 'Slack', 'burst-statistics' ),
						'pro'   => [
							'url'   => 'pricing/',
							'title' => __( 'Get alerts and reports in Slack', 'burst-statistics' ),
							'text'  => __( 'With Pro, traffic spikes, traffic drops, tracking problems and story reports go straight to your Slack channel.', 'burst-statistics' ),
						],
					],
					[
						'id'    => 'dashboard_notices',
						'title' => __( 'Dashboard notices', 'burst-statistics' ),
					],
				],
			],
			[
				'id'          => 'advanced',
				'group_id'    => 'tracking',
				'icon'        => 'sliders-vertical',
				'title'       => __( 'Advanced', 'burst-statistics' ),
				'description' => __( 'Configure user role and IP exclusions, data collection cookies, script loading methods, and beta features.', 'burst-statistics' ),
				'groups'      => [
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
						'title' => __( 'Secret settings', 'burst-statistics' ),
					],
				],
			],

		],
	],
];
