<?php
defined( 'ABSPATH' ) || die();
/**
 * Tasks to show in the admin area.
 * Condition: [
 *          type: serverside, clientside, activation (if task should be added on activation)
 *          function returning a boolean
 * ]
 * status: open, completed, premium
 */
return [
	[
		'id'          => 'ajax_fallback',
		'condition'   => [
			'type'     => 'serverside',
			'function' => 'wp_option_burst_ajax_fallback_active',
		],
		'msg'         => __( 'Please check if your REST API is loading correctly. Your site currently is using the slower Ajax fallback method to load the settings.', 'burst-statistics' ),
		'icon'        => 'warning',
		'url'         => 'instructions/rest-api-error/',
		'dismissible' => true,
		'plusone'     => false,
	],
	[
		'id'          => 'tracking-error',
		'condition'   => [
			'type'     => 'serverside',
			'function' => 'Burst\Frontend\Endpoint::tracking_status_error()',

		],
		'msg'         => __( 'Due to your server or website configuration it is not possible to track statistics.', 'burst-statistics' ),
		'url'         => 'instructions/tracking-error/',
		'plusone'     => true,
		'icon'        => 'error',
		'dismissible' => false,
	],
	[
		'id'          => 'bf_notice2024',
		'condition'   => [
			'type'     => 'serverside',
			'function' => 'Burst\Admin\Admin::is_bf()',

		],
		'msg'         => __( 'Black Friday', 'burst-statistics' ) . ': ' . __( 'Get 40% Off Burst Pro!', 'burst-statistics' ) . ' — ' . __( 'Limited time offer!', 'burst-statistics' ),
		'icon'        => 'sale',
		'url'         => 'pricing/',
		'dismissible' => true,
		'plusone'     => true,
	],
	[
		'id'          => 'cm_notice2024',
		'condition'   => [
			'type'     => 'serverside',
			'function' => 'Burst\Admin\Admin::is_cm()',
		],
		'msg'         => __( 'Cyber Monday', 'burst-statistics' ) . ': ' . __( 'Get 40% Off Burst Pro!', 'burst-statistics' ) . ' — ' . __( 'Last chance!', 'burst-statistics' ),
		'icon'        => 'sale',
		'url'         => 'pricing/',
		'dismissible' => true,
		'plusone'     => true,
	],
	[
		'id'          => 'new_parameters',
		'condition'   => [
			'type' => 'activation',
		],
		'msg'         => __( "New! Track your UTM Campaigns and URL Parameters! Click on the 'Pages' dropdown in the Statistics tab.", 'burst-statistics' ),
		'icon'        => 'new',
		'url'         => '#/statistics',
		'dismissible' => true,
		'plusone'     => false,
	],
	[
		'id'          => 'new_email_reporting',
		'msg'         => __( 'New! Send weekly or monthly email reports to multiple recipients.', 'burst-statistics' ),
		'icon'        => 'new',
		'url'         => '#/settings/general',
		'dismissible' => false,
		'plusone'     => false,
	],
	[
		'id'          => 'leave-feedback',
		// @phpstan-ignore-next-line
		'msg'         => $this->sprintf(
		// translators: 1: opening anchor tag to support thread, 2: closing anchor tag.
			__( 'If you have any suggestions to improve our plugin, feel free to %sopen a support thread%s.', 'burst-statistics' ),
			'<a href="https://wordpress.org/support/plugin/burst-statistics/" target="_blank">',
			'</a>'
		),
		'icon'        => 'completed',
		'dismissible' => true,
	],
	[
		'id'          => 'including_bounces',
		'msg'         => __( 'Statistics are now shown including bounces. Your data has not changed, only the bounces are now included in what you see.', 'burst-statistics' ),
		'icon'        => 'new',
		'url'         => 'statistics-including-bounces/',
		'dismissible' => true,
		'plusone'     => false,
	],
];
