<?php
/**
 * Shared dashboard features available across Burst statistics pages.
 *
 * @package Burst
 */

defined( 'ABSPATH' ) || die();

return [
	[
		'id'          => 'date_range_picker',
		'title'       => __( 'Date range picker', 'burst-statistics' ),
		'description' => __( 'Select predefined or custom date ranges (today, yesterday, last 7 days, last 30 days, month to date, year, or custom range) to filter all metrics across the dashboard.', 'burst-statistics' ),
	],
	[
		'id'          => 'filters',
		'title'       => __( 'Dashboard filters', 'burst-statistics' ),
		'description' => __( 'Filter analytics data across the dashboard by page URL, referrer, goal, device type, operating system, browser, country, and UTM campaign parameters.', 'burst-statistics' ),
	],
	[
		'id'          => 'csv_download',
		'title'       => __( 'CSV download', 'burst-statistics' ),
		'description' => __( 'Download the data of any table directly as a CSV export using the Download CSV button in the table header.', 'burst-statistics' ),
	],
	[
		'id'          => 'share_links',
		'title'       => __( 'Share links', 'burst-statistics' ),
		'description' => __( 'Create secure, passwordless, read-only share links with customizable date ranges and tab permissions to share dashboard metrics with clients or team members.', 'burst-statistics' ),
	],
];
