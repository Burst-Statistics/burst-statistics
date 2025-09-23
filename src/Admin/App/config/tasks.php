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
		'url'         => 'instructions/troubleshoot-tracking/',
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
		'id'          => 'leave-feedback',
		'condition'   => [
			'type' => 'activation',
		],
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
	[
		'id'          => 'cron',
		'condition'   => [
			'type'     => 'serverside',
			'function' => '!(new \Burst\Admin\Cron\Cron() )->cron_active()',
		],
		'msg'         => __( 'Because your cron has not been triggered more than 24 hours, some functionality might not work as expected, like updating the page views counter in a post.', 'burst-statistics' ),
		'icon'        => 'warning',
		'url'         => 'instructions/cron-error/',
		'dismissible' => true,
	],
	[
		'id'          => 'malicous_data_removal',
		'condition'   => [
			'type'     => 'serverside',
			'function' => 'wp_option_burst_cleanup_uid_visits',
		],
		// translators: %d is the number of visits detected from a single user in 24 hours.
		'msg'         => sprintf( __( 'Burst has detected an anomalous number of visits (%d in 24 hours) from one user with UID %s. You can consider removing these hits by using the "fix" button, but if you\'re sure these are valid visits, you can dismiss this notice.', 'burst-statistics' ), (int) get_option( 'burst_cleanup_uid_visits', 0 ), esc_html( (string) get_option( 'burst_cleanup_uid', '' ) ) ),
		'icon'        => 'warning',
		'url'         => 'why-burst-removes-anomalous-visits-and-how-you-can-customize-it/',
		'dismissible' => true,
		'fix'         => 'burst_clean_data',
	],
	[
		'id'          => 'trial_offer_loyal_users',
		'msg'         => __( 'Thanks for using Burst for over a year! To show our appreciation, enjoy 3 months of Burst Pro for free.', 'burst-statistics' ),
		'icon'        => 'sale',
		'url'         => 'checkout/?edd_action=add_to_cart&download_id=889&edd_options[price_id]=102',
		'dismissible' => true,
		'plusone'     => true,
	],
	[
		'id'          => 'php_error_detected',
		'condition'   => [
			'type'     => 'serverside',
			'function' => 'wp_option_burst_php_error_detected',
		],
		// translators: %d: error count, %s time of error.
		'msg'         => sprintf( __( 'Burst has detected %d PHP errors, the last one on %s. Detected errors:', 'burst-statistics' ) . ' ' . substr( esc_html( get_option( 'burst_php_error_detected', '' ) ), 0, 500 ), (int) get_option( 'burst_php_error_count', 0 ), date_i18n( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), get_option( 'burst_php_error_time' ) ) ),
		'icon'        => 'warning',
		'dismissible' => true,
		'url'         => 'how-to-enable-debugging-in-wordpress',
	],
	[
		'id'          => 'missing_tables',
		'condition'   => [
			'type'     => 'serverside',
			'function' => 'wp_option_burst_missing_tables',
		],
		// translators: %d: error count, %s time of error.
		'msg'         => sprintf( __( 'Burst has detecting missing database tables: %s.', 'burst-statistics' ), get_option( 'burst_missing_tables' ) ) . ' ' . __( 'Please deactivate Burst (keep the data!), then activate again, to trigger a database upgrade.', 'burst-statistics' ),
		'icon'        => 'warning',
		'dismissible' => true,
	],
	[
		'id'          => 'pageviews_milestone',
		'condition'   => [
			'type'     => 'serverside',
			'function' => 'Burst\Admin\Milestones::pageviews_milestone_reached()',
		],
		'msg'         => sprintf(
			// translators: %s is the milestone number (compact, e.g. 1k, 10k, 1M).
			__( 'You’ve hit %s pageviews this month!', 'burst-statistics' ),
			( new \Burst\Admin\Milestones() )->format_milestone( get_option( 'burst_current_pageviews_milestone', 0 ) )
		),
		'icon'        => 'milestone',
		'dismissible' => true,
		'plusone'     => false,
	],
	[
		'id'          => 'live_visitors',
		'condition'   => [
			'type' => 'clientside',
		],
		'icon'        => 'insight',
		'dismissible' => false,
		'plusone'     => false,
	],
];
