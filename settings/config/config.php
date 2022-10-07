<?php
defined( 'ABSPATH' ) or die();

function burst_menu() {
	$menu_items = [
		[
			"id"    => "dashboard",
			"title" => __( "Dashboard", 'burst-statistics' ),
			'default_hidden' => false,
			'menu_items' => [],
		],
		[
			"id"    => "statistics",
			"title" => __( "Statistics", 'burst-statistics' ),
			'default_hidden' => false,
			'menu_items' => [],
		],
		[
			"id"         => "settings",
			"title"      => __( "Settings", 'burst-statistics' ),
			'default_hidden' => false,
			'menu_items' => [
				[
					'id'       => 'general',
					'group_id' => 'general',
					'title'    => __( 'General', 'burst-statistics' ),
					'step'     => 1,
					'groups'   => [
						[
							'id'    => 'general',
							'title' => __( 'General', 'burst-statistics' ),
						],
					],
				],
				[
					'id'       => 'advanced',
					'group_id' => 'advanced',
					'title'    => __( 'Advanced', 'burst-statistics' ),
					'step'     => 1,
					'groups'   => [
						[
							'id'    => 'advanced',
							'title' => __( 'Advanced', 'burst-statistics' ),
						],
					],
				],
			],
		],
	];


	return $menu_items;
}

function burst_migrate_settings( $prev_version ) {


}

add_action( 'burst_upgrade', 'burst_migrate_settings', 10, 1 );

function burst_fields( $load_values = true ) {

	if ( ! burst_user_can_manage() ) {
		return [];
	}

	$fields = [
		[
			'id'       => 'review_notice_shown',
			'menu_id'  => 'general',
			'group_id' => 'general',
			'type'     => 'hidden',
			'label'    => '',
			'disabled' => false,
			'default'  => false,
		],
		[
			'id'       => 'enable_turbo_mode',
			'menu_id'  => 'general',
			'group_id' => 'general',
			'type'     => 'checkbox',
			'label'    => __( "Enable Turbo mode", 'burst-statistics' ),
			'help'     => [
				'label' => 'default',
				'title' => __( "What is Turbo mode?", 'burst-statistics' ),
				'text'  => __( 'Turbo mode improves pagespeed. When enabled, the script is no longer loaded in the header asynchronously, but is loaded in the footer and deferred. You could lose data from visitors who leave before the page has fully loaded.', 'burst-statistics' ),
			],
			'disabled' => false,
			'default'  => false,
		],
		[
			'id'       => 'enable_cookieless_tracking',
			'menu_id'  => 'general',
			'group_id' => 'general',
			'type'     => 'checkbox',
			'label'    => __( "Enable Cookieless tracking", 'burst-statistics' ),
			'help'     => [
				'label' => 'default',
				'title' => __( "What is Cookieless tracking?", 'burst-statistics' ),
				'text'  => __( '...', 'burst-statistics' ),
			],
			'disabled' => false,
			'default'  => false,
		],
		[
			'id'       => 'ip_blocklist',
			'menu_id'  => 'advanced',
			'group_id' => 'advanced',
			'type'     => 'ip_blocklist',
			'label'    => __( 'Add IPs to blocklist', 'burst-statistics' ),
			'disabled' => false,
			'default'  => false,
		],
	];

	$fields = apply_filters( 'burst_fields', $fields );
	foreach ( $fields as $key => $field ) {
		$field = wp_parse_args( $field, [ 'id'                 => false,
		                                  'visible'            => true,
		                                  'disabled'           => false,
		                                  'new_features_block' => false,
		] );
		//handle server side conditions
		if ( isset( $field['server_conditions'] ) ) {
			if ( ! burst_conditions_apply( $field['server_conditions'] ) ) {
				unset( $fields[ $key ] );
				continue;
			}
		}
		if ( $load_values ) {
			$value          = burst_sanitize_field( burst_get_option( $field['id'], $field['default'] ), $field['type'], $field['id'] );
			$field['value'] = apply_filters( 'burst_field_value_' . $field['id'], $value, $field );
			$fields[ $key ] = apply_filters( 'burst_field', $field, $field['id'] );
		}
	}

	$fields = apply_filters( 'burst_fields_values', $fields );

	return array_values( $fields );
}

function burst_blocks() {
	$blocks = [
		'dashboard' => [
			[
				'id'       => 'progress',
				'title'    => __( "Progress", 'burst-statistics' ),
				'controls' => [
					'type' => 'react',
					'data' => 'ProgressHeader',
				],
				'content'  => [ 'type' => 'react', 'data' => 'ProgressBlock' ],
				'footer'   => [ 'type' => 'template', 'data' => 'dashboard/progress-footer.php' ],
				'class'    => 'burst-column-2',
			],
			[
				'id'      => 'today',
				'title'   => __( "Today", 'burst-statistics' ),
				'content'  => [ 'type' => 'react', 'data' => 'TodayBlock' ],
				'footer'  => [ 'type' => 'html', 'data' => '' ],
				'class'   => 'border-to-border',
			],
			[
				'id'       => 'goals',
				'controls' => false,
				'title'    => __( "Goals (Coming soon)", 'burst-statistics' ),
				'content'  => [ 'type' => 'html', 'data' => '' ],
				'footer'   => [ 'type' => 'html', 'data' => '' ],
				'class'    => '',
			],
			[
				'id'       => 'tips-tricks',
				'controls' => false,
				'title'    => __( "Tips & Tricks", 'burst-statistics' ),
				'content'  => [ 'type' => 'template', 'data' => 'dashboard/tips-tricks.php' ],
				'footer'   => [ 'type' => 'template', 'data' => 'dashboard/tips-tricks-footer.php' ],
				'class'    => 'burst-column-2',
			],
			[
				'id'       => 'other-plugins',
				'controls'  => ['type' => 'html', 'data' => '<a class="rsp-logo" href="https://really-simple-plugins.com/"><img src="'.rsssl_url.'assets/img/really-simple-plugins.svg" alt="Really Simple Plugins" /></a>'],
				'title'    => __( "Other Plugins", 'burst-statistics' ),
				'content'  => [ 'type' => 'template', 'data' => 'dashboard/other-plugins.php' ],
				'footer'   => [ 'type' => 'html', 'data' => '' ],
				'class'    => 'burst-column-2 no-border no-background',
			],
		],
		'statistics' => [
			[
				'id'       => 'insights',
				'title'    => __( "Insights", 'burst-statistics' ),
				'content'  => [ 'type' => 'react', 'data' => 'InsightsBlock' ],
				'footer'   => [ 'type' => 'html', 'data' => '' ],
				'class'    => 'burst-column-2',
			],
			[
				'id'       => 'compare',
				'title'    => __( "Compare", 'burst-statistics' ),
				'content'  => [ 'type' => 'react', 'data' => 'CompareBlock' ],
				'footer'   => [ 'type' => 'html', 'data' => '' ],
				'class'    => '',
			],
			[
				'id'       => 'devices',
				'title'    => __( "Devices", 'burst-statistics' ),
				'content'  => [ 'type' => 'react', 'data' => 'DevicesBlock' ],
				'footer'   => [ 'type' => 'html', 'data' => '' ],
				'class'    => '',
			],
			[
				'id'       => 'pages',
				'title'    => __( "Per page", 'burst-statistics' ),
				'content'  => [ 'type' => 'react', 'data' => 'PagesBlock' ],
				'footer'   => [ 'type' => 'html', 'data' => '' ],
				'class'    => ' burst-column-2 border-to-border datatable',
			],
			[
				'id'       => 'referrers',
				'title'    => __( "Referrers", 'burst-statistics' ),
				'content'  => [ 'type' => 'react', 'data' => 'ReferrersBlock' ],
				'footer'   => [ 'type' => 'html', 'data' => '' ],
				'class'    => ' burst-column-2 border-to-border datatable',
			]
		]
	];

	$blocks = apply_filters( 'burst_blocks', $blocks );

	foreach ( $blocks as $page_index => $page ) {
		foreach ( $blocks[$page_index] as $index => $block ) {
			if ( $block['content']['type'] === 'template' ) {
				$template = $block['content']['data'];
				$blocks[ $page_index ][ $index ]['content']['type'] = 'html';
				$blocks[ $page_index ][ $index ]['content']['data'] = burst_get_template( $template );
			}
			if ( $block['footer']['type'] === 'template' ) {
				$template = $blocks[ $page_index ][ $index ]['footer']['data'];
				$blocks[ $page_index ][ $index ]['footer']['type'] = 'html';
				$blocks[ $page_index ][ $index ]['footer']['data'] = burst_get_template( $template );
			}
		}
	}

	return $blocks;
}

/**
 * Render html based on template
 *
 * @param string $template
 *
 * @return string
 */

function burst_get_template( $template ) {
	if ( ! burst_user_can_view() ) {
		return '';
	}
	$html = '';
	$file = trailingslashit( burst_path ) . 'settings/templates/' . $template;
	if ( file_exists( $file ) ) {
		ob_start();
		require $file;
		$html = ob_get_clean();
	}

	return $html;
}


