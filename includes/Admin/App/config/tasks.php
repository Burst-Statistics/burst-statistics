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
		'id'                  => 'bf_notice',
		'condition'           => [
			'type'     => 'serverside',
			'function' => 'Burst\Admin\Admin::is_bf()',

		],
		'msg'                 => __( 'Black Friday', 'burst-statistics' ) . ': ' . __( 'Get 40% Off Burst Pro!', 'burst-statistics' ) . ' — ' . __( 'Limited time offer!', 'burst-statistics' ),
		'icon'                => 'sale',
		'url'                 => 'pricing/',
		'dismissible'         => true,
		'plusone'             => true,
		'dismiss_permanently' => true,
	],
	[
		'id'                  => 'cm_notice',
		'condition'           => [
			'type'     => 'serverside',
			'function' => 'Burst\Admin\Admin::is_cm()',
		],
		'msg'                 => __( 'Cyber Monday', 'burst-statistics' ) . ': ' . __( 'Get 40% Off Burst Pro!', 'burst-statistics' ) . ' — ' . __( 'Last chance!', 'burst-statistics' ),
		'icon'                => 'sale',
		'url'                 => 'pricing/',
		'dismissible'         => true,
		'plusone'             => true,
		'dismiss_permanently' => true,
	],
	[
		'id'          => 'leave-feedback',
		'condition'   => [
			'type' => 'activation',
		],
		// @phpstan-ignore-next-line
		'msg'         => $this->sprintf(
		// translators: 1: opening anchor tag to support thread, 2: closing anchor tag.
			__( 'If you have any suggestions to improve our plugin, feel free to %1$sopen a support thread%2$s.', 'burst-statistics' ),
			'<a href="https://wordpress.org/support/plugin/burst-statistics/" target="_blank">',
			'</a>'
		),
		'icon'        => 'completed',
		'dismissible' => true,
	],
	[
		'id'          => 'ecommerce_integration',
		'msg'         => __( 'New in Burst Pro: dedicated sales dashboard for WooCommerce and Easy Digital Downloads.', 'burst-statistics' ),
		'icon'        => 'new',
		'url'         => 'new-feature-woocommerce-insights/',
		'dismissible' => true,
		'plusone'     => false,
	],
	[
		// no condition on this task, as when this issue happens, cron is not working to add the task.
		'id'          => 'cron',
		'msg'         => __( 'Your WordPress cron hasn’t been triggered for over 24 hours. As a result, Burst can’t update first visit and bounce data until it runs again.', 'burst-statistics' ),
		'icon'        => 'warning',
		'url'         => 'instructions/cron-error/',
		'dismissible' => false,
	],
	[
		'id'          => 'malicious_data_removal',
		'condition'   => [
			'type'     => 'serverside',
			'function' => 'wp_option_burst_cleanup_uid_visits',
		],
		// translators: %d is the number of visits detected from a single user in 24 hours.
		'msg'         => sprintf( __( 'Burst has detected an anomalous number of visits (%1$d in 24 hours) from one user with UID %2$s. You can consider removing these hits by using the "fix" button, but if you\'re sure these are valid visits, you can dismiss this notice.', 'burst-statistics' ), (int) get_option( 'burst_cleanup_uid_visits', 0 ), esc_html( (string) get_option( 'burst_cleanup_uid', '' ) ) ),
		'icon'        => 'warning',
		'url'         => 'why-burst-removes-anomalous-visits-and-how-you-can-customize-it/',
		'dismissible' => true,
		'fix'         => 'burst_clean_data',
	],
	[
		'id'          => 'trial_offer_loyal_users',
		'msg'         => __( 'Thanks for using Burst for over a year! To show our appreciation, we have a surprise for you as a loyal user!', 'burst-statistics' ),
		'icon'        => 'sale',
		'url'         => 'thanks-for-using-burst/',
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
		'msg'         => sprintf( __( 'Burst has detected %1$d PHP errors, the last one on %2$s. Detected errors:', 'burst-statistics' ) . ' ' . substr( esc_html( get_option( 'burst_php_error_detected', '' ) ), 0, 500 ), (int) get_option( 'burst_php_error_count', 0 ), date_i18n( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), get_option( 'burst_php_error_time' ) ) ),
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
	[
		'id'                  => 'multi_domain_setup_detected',
		'condition'           => [
			'type'     => 'serverside',
			'function' => 'wp_option_burst_is_multi_domain',
		],
		'msg'                 => __( 'Burst detected multiple domains being used to visit the website. If you want to be able to differentiate between domains, you can enable filtering by domain in the settings.', 'burst-statistics' ),
		'icon'                => 'warning',
		'dismissible'         => true,
		'plusone'             => false,
		'url'                 => 'filtering-by-domain/',
		'dismiss_permanently' => true,
	],
	[
		'id'          => 'filters_in_url',
		'msg'         => __( 'New: save or share your filtered view by simply copying the URL or bookmarking it.', 'burst-statistics' ),
		'icon'        => 'new',
		'dismissible' => true,
		'plusone'     => false,
	],
];
