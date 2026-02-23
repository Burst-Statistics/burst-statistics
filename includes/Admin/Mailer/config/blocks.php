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
];
