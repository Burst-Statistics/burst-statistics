<?php

use Burst\Admin\Reports\DomainTypes\Report_Content_Block;

return [
	Report_Content_Block::MOST_VISITED_PAGES => [
		'title'      => __( 'Most visited pages', 'burst-statistics' ),
		'query_args' => [
			'select'   => [ 'page_url', 'pageviews' ],
			'group_by' => 'page_url',
			'order_by' => 'pageviews DESC',
		],
		'url'        => '#/statistics',
		'header'     => [ __( 'Page', 'burst-statistics' ), __( 'Pageviews', 'burst-statistics' ) ],
	],
	Report_Content_Block::TOP_REFERRERS      => [
		'title'      => __( 'Top referrers', 'burst-statistics' ),
		'query_args' => [
			'select'   => [ 'referrer', 'pageviews' ],
			'group_by' => 'referrer',
			'order_by' => 'pageviews DESC',
		],
		'url'        => '#/statistics',
		'header'     => [ __( 'Referrers', 'burst-statistics' ), __( 'Pageviews', 'burst-statistics' ) ],
	],
	// Country tracking is free; the country code is enriched to a nice name by
	// Geo_Statistics on the burst_mail_report_results filter.
	Report_Content_Block::COUNTRIES          => [
		'title'      => __( 'Countries', 'burst-statistics' ),
		'query_args' => [
			'select'   => [ 'country_code', 'pageviews' ],
			'group_by' => 'country_code',
			'order_by' => 'pageviews DESC',
		],
		'url'        => '#/sources',
		'header'     => [ __( 'Country', 'burst-statistics' ), __( 'Pageviews', 'burst-statistics' ) ],
	],
];
