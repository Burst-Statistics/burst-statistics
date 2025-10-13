<?php

return [
	[
		'title'    => __( 'Most visited pages', 'burst-statistics' ),
		'select'   => [ 'page_url', 'pageviews' ],
		'group_by' => 'page_url',
		'order_by' => 'pageviews DESC',
		'url'      => '#/statistics',
	],
	[
		'title'    => __( 'Top referrers', 'burst-statistics' ),
		'select'   => [ 'referrer', 'pageviews' ],
		'group_by' => 'referrer',
		'order_by' => 'pageviews DESC',
		'url'      => '#/statistics',
	],
];
