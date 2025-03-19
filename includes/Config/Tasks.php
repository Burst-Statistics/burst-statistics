<?php
/**
 * condition: [
 *          type: serverside, clientside, activation (if task should be added on activation)
 *          function returning a boolean
 * ]
 * status: open, completed, premium
 */
return [
    [
        'id' => 'ajax_fallback',
        'condition'  => [
            'type' => 'serverside',
            'function' => 'wp_option_burst_ajax_fallback_active',
        ],
        'msg' => __( "Please check if your REST API is loading correctly. Your site currently is using the slower Ajax fallback method to load the settings.", 'burst-statistics' ),
        'icon' => 'warning',
        'url' => burst_get_website_url('instructions/rest-api-error/', [
            'burst_source' => 'notices',
            'burst_content' => 'ajax-fallback'
        ]),
        'dismissible' => true,
        'plusone' => false,
    ],
    [
        'id' => 'tracking-error',
        'condition'  => [
            'type' => 'serverside',
            'function' => 'burst_tracking_status_error',
        ],
        'msg' => __( "Due to your server or website configuration it is not possible to track statistics.", 'burst-statistics' ),
        'url' => burst_get_website_url('instructions/tracking-error/', [
            'burst_source' => 'notices',
            'burst_content' => 'tracking-error'
        ]),
        'plusone' => true,
        'icon' => 'error',
        'dismissible' => false,
    ],
    [
        'id' => 'bf_notice2024',
        'condition'  => [
            'type' => 'serverside',
            'function' => 'BURST()->admin->is_bf',
        ],
        'msg' => __("Black Friday", 'burst-statistics') . ": " . __("Get 40% Off Burst Pro!", 'burst-statistics') . " — " . __("Limited time offer!", 'burst-statistics'),
        'icon' => 'sale',
        'url' => burst_get_website_url('pricing/', [
            'burst_content' => 'black-friday',
            'burst_source' => 'notices',
        ]),
        'dismissible' => true,
        'plusone' => true,
    ],
    [
        'id' => 'cm_notice2024',
        'condition'  => [
            'type' => 'serverside',
            'function' => 'BURST()->admin->is_cm'
        ],
        'msg' => __("Cyber Monday", 'burst-statistics') . ": " . __("Get 40% Off Burst Pro!", 'burst-statistics') . " — " . __("Last chance!", 'burst-statistics'),
        'icon' => 'sale',
        'url' => burst_get_website_url('pricing/', [
            'burst_content' => 'cyber-monday',
            'burst_source' => 'notices',
        ]),
        'dismissible' => true,
        'plusone' => true,
    ],
    [
         'id' => 'new_parameters',
         'condition' => [
            'type' => 'activation',
        ],
        'msg'         => __( "New! Track your UTM Campaigns and URL Parameters! Click on the 'Pages' dropdown in the Statistics tab.", 'burst-statistics' ),
        'icon'        => 'new',
        'url'         => '#statistics',
        'dismissible' => true,
        'plusone'     => false,
    ],
    [
        'id' => 'new_email_reporting',
        'msg'         => __( "New! Send weekly or monthly email reports to multiple recipients.", 'burst-statistics' ),
        'icon'        => 'new',
        'url'         => '#settings',
        'dismissible' => false,
        'plusone'     => false,
    ],
    [
        'id' => 'leave-feedback',
        'msg' => burst_sprintf(
            __( 'If you have any suggestions to improve our plugin, feel free to %sopen a support thread%s.', 'burst-statistics' ),
            '<a href="https://wordpress.org/support/plugin/burst-statistics/" target="_blank">',
            '</a>'),
        'icon' => 'completed',
        'dismissible' => true,
    ],
];