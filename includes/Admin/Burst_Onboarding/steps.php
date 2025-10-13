<?php
defined( 'ABSPATH' ) || die();
/**
 * Onboarding steps configuration for Burst Statistics.
 * title_upgrade: if a user has done the onboarding in free, this is the title shown when they upgrade to Pro.
 * subtitle_upgrade: if a user has done the onboarding in free, this is the subtitle shown when they upgrade to Pro.
 * first_run_only: if true, the step will only be shown the first time the onboarding is shown.
 * If the user upgrades to Pro, the onboarding will show with only licensing and maybe some new settings/features config.
 *
 * @package Burst
 */
return [
	[
		'id'               => 'intro',
		'type'             => 'intro',
		'title'            => __( 'Take a minute to configure Burst!', 'burst-statistics' ),
		'title_upgrade'    => __( 'Thanks for upgrading to Burst Pro!', 'burst-statistics' ),
		'subtitle'         => __( "In a few steps, we'll help you select the best options and verify whether your website is tracking correctly.", 'burst-statistics' ),
		'subtitle_upgrade' => __( "In a few steps, we'll help you activate your license and configure your Pro features.", 'burst-statistics' ),
		'button'           => [
			'id'    => 'start',
			'label' => __( 'Start onboarding', 'burst-statistics' ),
		],
	],
	[
		'id'       => 'license',
		'type'     => 'license',
		'title'    => __( 'Activate your license', 'burst-statistics' ),
		'subtitle' => __( 'Activate your license to get access to all features, and easy plugin updates!', 'burst-statistics' ),
		'fields'   => [
			[
				'id'    => 'license',
				'type'  => 'license',
				'label' => __( 'Enter your license key', 'burst-statistics' ),
			],
// phpcs:disable
// Uncomment the following lines if for password/email license activation.
//            [
//				'id'    => 'registration_email',
//				'type'  => 'email',
//				'label' => __( 'Enter your e-mail address', 'burst-statistics' ),
//			],
//            [
//				'id'    => 'registration_password',
//				'type'  => 'password',
//				'label' => __( 'Enter password', 'burst-statistics' ),
//			],
//phpcs:enable
		],
		'button'   => [
			'id'    => 'activate',
			'label' => __( 'Activate', 'burst-statistics' ),
		],
	],
	[
		'id'             => 'tracking',
		'type'           => 'tracking',
		'title'          => __( "Let's check if tracking is setup correctly", 'burst-statistics' ),
		'documentation'  => 'https://burst-statistics.com/troubleshoot-tracking/',
		'solutions'      => [
			__( 'Please clear your cache and try again.', 'burst-statistics' ),
			__( 'Please check your security settings.', 'burst-statistics' ),
		],
		'fields'         => [
			[
				'id'   => 'tracking_test',
				'type' => 'tracking_test',
			],
		],
		'button'         => [
			'id'    => 'continue',
			'label' => __( 'Continue', 'burst-statistics' ),
		],
		'first_run_only' => true,
	],
	[
		'id'             => 'exclude_tracking',
		'type'           => 'settings',
		'title'          => __( 'Setup recommended settings', 'burst-statistics' ),
		'subtitle'       => __( 'Excluding data gives a clearer picture of your website visitors.', 'burst-statistics' ),
		'fields'         => [
			[
				'id'      => 'ip_blocklist',
				'type'    => 'checkbox',
				'label'   => '',
				'default' => '',
			],
			[
				'id'      => 'user_role_blocklist',
				'type'    => 'checkbox',
				'label'   => __( 'Exclude administrators from being tracked', 'burst-statistics' ),
				'default' => true,
			],
		],
		'first_run_only' => true,
		'button'         => [
			'id'    => 'save',
			'label' => __( 'Save and continue', 'burst-statistics' ),
		],
	],
	[
		'id'             => 'email',
		'type'           => 'email',
		'first_run_only' => true,
		'title'          => __( 'Receive weekly email reports', 'burst-statistics' ),
		'subtitle'       => __( 'Stay up to date with your website\'s performance.', 'burst-statistics' ),
		'fields'         => [
			[
				'id'      => 'email_reports_mailinglist',
				'type'    => 'email',
				'default' => '',
			],
			[
				'id'                => 'tips_tricks_mailinglist',
				'type'              => 'checkbox',
				'label'             => __( 'Join our mailinglist and get 4 tips to improve conversions.', 'burst-statistics' ),
				'default'           => false,
				'show_privacy_link' => true,
			],
		],
		'button'         =>
			[
				'id'    => 'save',
				'label' => __( 'Save and continue', 'burst-statistics' ),
			],
	],
	[
		'id'             => 'plugins',
		'type'           => 'plugins',
		'first_run_only' => true,
		'title'          => __( 'Recommended for your setup', 'burst-statistics' ),
		'subtitle'       => __( 'Based on your website configuration, we recommend the following plugins:', 'burst-statistics' ),
		'fields'         => [
			[
				'id'    => 'plugins',
				'type'  => 'plugins',
				'label' => __( 'Install TeamUpdraft plugins', 'burst-statistics' ),
			],
		],
		'button'         => [
			'id'    => 'save',
			'label' => __( 'Install and continue', 'burst-statistics' ),
		],
	],
	[
		'id'      => 'completed',
		'type'    => 'completed',
		'title'   => __( 'All done, Awesome!', 'burst-statistics' ),
		'bullets' => [
			[ __( 'See in which country your visitors are', 'burst-statistics' ) ],
			[ __( 'Measure marketing campaigns with UTM tracking', 'burst-statistics' ) ],
			[ __( 'Track multiple goals to measure conversions', 'burst-statistics' ) ],
			[ __( 'Premium support', 'burst-statistics' ) ],
		],
		'button'  => [
			'id'    => 'finish',
			'label' => __( 'Go to the dashboard and explore Burst!', 'burst-statistics' ),
		],
	],
];
