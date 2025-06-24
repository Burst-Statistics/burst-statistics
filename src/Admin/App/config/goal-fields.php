<?php
defined( 'ABSPATH' ) || die();

return [
	[
		'id'      => 'title',
		'type'    => 'hidden',
		'default' => false,
	],
	[
		'id'      => 'status',
		'type'    => 'hidden',
		'default' => false,
	],
	[
		'id'       => 'type',
		'type'     => 'radio-buttons',
		'label'    => __( 'What type of goal do you want to set?', 'burst-statistics' ),
		'options'  => [
			'clicks' => [
				'label'       => __( 'Clicks', 'burst-statistics' ),
				'description' => __( 'Track clicks on element', 'burst-statistics' ),
				'type'        => 'clicks',
				'icon'        => 'mouse',
			],
			'views'  => [
				'label'       => __( 'Views', 'burst-statistics' ),
				'description' => __( 'Track views of element', 'burst-statistics' ),
				'type'        => 'views',
				'icon'        => 'eye',
			],
			'visits' => [
				'label'       => __( 'Visits', 'burst-statistics' ),
				'description' => __( 'Track visits to page', 'burst-statistics' ),
				'type'        => 'visits',
				'icon'        => 'visitors',
			],
			'hook'   => [
				'label'       => __( 'Hook', 'burst-statistics' ),
				'description' => __( 'Track execution of a WordPress hook', 'burst-statistics' ),
				'type'        => 'hook',
				'icon'        => 'hook',
			],
		],
		'disabled' => false,
		'default'  => 'clicks',
	],
	[
		'id'               => 'page_or_website',
		'type'             => 'radio-buttons',
		'label'            => __( 'Do you want to track a specific page or the entire website?', 'burst-statistics' ),
		'options'          => [
			'page'    => [
				'label'       => __( 'Page', 'burst-statistics' ),
				'description' => __( 'Track page specific', 'burst-statistics' ),
				'type'        => 'page',
				'icon'        => 'page',
			],
			'website' => [
				'label'       => __( 'Website', 'burst-statistics' ),
				'description' => __( 'Track on whole site', 'burst-statistics' ),
				'type'        => 'website',
				'icon'        => 'website',
			],
		],
		'disabled'         => false,
		'default'          => 'website',
		'react_conditions' => [
			'type' => [ 'clicks', 'views', 'hook' ],
		],
	],
	[
		'id'               => 'specific_page',
		'type'             => 'select-page',
		'label'            => __( 'Which specific page do you want to track?', 'burst-statistics' ),
		'disabled'         => false,
		'default'          => false,
		'react_conditions' => [
			'page_or_website' => [ 'page' ],
			'type'            => [ 'visits' ],
		],
	],
	[
		'id'               => 'selector',
		'type'             => 'class-id',
		'label'            => __( 'What element do you want to track?', 'burst-statistics' ),
		'disabled'         => false,
		'default'          => '',
		'react_conditions' => [
			'type' => [ 'clicks', 'views' ],
		],
	],
	[
		'id'               => 'hook',
		'type'             => 'hook',
		'label'            => __( 'What hook do you want to track?', 'burst-statistics' ),
		'disabled'         => false,
		'default'          => '',
		'react_conditions' => [
			'type' => [ 'hook' ],
		],
	],
	[
		'id'       => 'conversion_metric',
		'type'     => 'radio-buttons',
		'label'    => __( 'What metric do you want to use to calculate the conversion rate?', 'burst-statistics' ),
		'options'  => [
			'visitors'  => [
				'label' => __( 'Visitors', 'burst-statistics' ),
				'type'  => 'visitors',
				'icon'  => 'visitors',
			],
			'sessions'  => [
				'label' => __( 'Sessions', 'burst-statistics' ),
				'type'  => 'sessions',
				'icon'  => 'sessions',
			],
			'pageviews' => [
				'label' => __( 'Pageviews', 'burst-statistics' ),
				'type'  => 'pageviews',
				'icon'  => 'pageviews',
			],
		],
		'disabled' => false,
		'default'  => 'visitors',
	],
];
