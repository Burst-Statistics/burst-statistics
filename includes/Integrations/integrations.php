<?php
defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

/**
 * List of integrations that Burst Statistics supports.
 * Good to know for goals:
 * - The goals should always be user trigger-able, otherwise the goal can not be tracked as it requires a UID at least for now.
 *
 * Integration properties:
 * - php_scripts: Array containing script locations
 *   - admin_scripts: Array of file names to load only in admin context
 *   - frontend_scripts: Array of file names to load only in frontend context
 * - category: One of 'ecommerce', 'forms', 'page_builders', 'consent', 'performance', 'other'.
 * - status: Id of the short description of what the integration does, shown in the
 *   settings UI. Mapped to a translatable label at display time (see
 *   Integrations_Settings::translate_integration_status()).
 * - wporg_slug: WordPress.org plugin slug used to fetch the plugin icon. Only set this
 *   for plugins that are actually hosted in the wp.org repository; premium-only plugins
 *   omit it so no icon request is made for them.
 * - wporg_icon: Icon file name on the wp.org CDN, for plugins whose icon is not the
 *   default icon-128x128.png (e.g. a .jpg or .gif variant).
 */
return [
	// Consent plugins.
	'complianz'                  => [
		'constant_or_function' => 'cmplz_version',
		'label'                => 'Complianz GDPR/CCPA',
		'category'             => 'consent',
		'status'               => 'enhances_consent_compatibility',
		'wporg_slug'           => 'complianz-gdpr',
		'php_scripts'          => [
			'admin_scripts'    => [],
			'frontend_scripts' => [ 'frontend.php' ],
		],
	],
	'duplicate-post'             => [
		'constant_or_function' => 'DUPLICATE_POST_CURRENT_VERSION',
		'label'                => 'Yoast Duplicate Post',
		'category'             => 'other',
		'status'               => 'prevents_duplicate_tracking_data',
		'wporg_slug'           => 'duplicate-post',
		'php_scripts'          => [
			'admin_scripts'    => [ 'admin.php' ],
			'frontend_scripts' => [],
		],
	],
	// Pagebuilders.
	'elementor'                  => [
		'constant_or_function' => 'ELEMENTOR_VERSION',
		'label'                => 'Elementor Website Builder',
		'category'             => 'page_builders',
		'status'               => 'tracks_form_and_popup_submissions',
		'wporg_slug'           => 'elementor',
		'wporg_icon'           => 'icon-128x128.gif',
		'php_scripts'          => [
			'admin_scripts'    => [],
			'frontend_scripts' => [],
		],
		'goals'                =>
			[
				[
					'id'   => 'elementor_pro_forms_form_submitted',
					'type' => 'hook',
					'hook' => 'elementor_pro/forms/form_submitted',
				],
				[
					'id'       => 'submit_button_click',
					'type'     => 'clicks',
					'selector' => '.elementor-field-type-submit .elementor-button',
				],
			],
	],
	// eCommerce plugins.
	'woocommerce'                => [
		'constant_or_function'       => 'WC_VERSION',
		'label'                      => 'WooCommerce',
		'category'                   => 'ecommerce',
		'status'                     => 'tracks_sales_and_revenue',
		'load_ecommerce_integration' => true,
		'wporg_slug'                 => 'woocommerce',
		'php_scripts'                => [
			'admin_scripts'    => [],
			'frontend_scripts' => [ 'frontend.php' ],
		],
		'goals'                      =>
			[
				[
					'id'   => 'woocommerce_add_to_cart',
					'type' => 'hook',
					'hook' => 'woocommerce_add_to_cart',
				],
				[
					'id'   => 'woocommerce_checkout_order_created',
					'type' => 'hook',
					'hook' => 'woocommerce_checkout_order_created',
				],
				[
					'id'   => 'woocommerce_payment_complete',
					'type' => 'hook',
					'hook' => 'woocommerce_payment_complete',
				],
				[
					'id'       => 'woocommerce_add_to_cart_click',
					'type'     => 'clicks',
					'selector' => '.add_to_cart_button',
				],
				[
					'id'       => 'woocommerce_click_checkout_button',
					'type'     => 'clicks',
					'selector' => '.wc-block-cart__submit-button',
				],
			],
	],
	'woocommerce-payments'       => [
		'constant_or_function' => 'WCPAY_PLUGIN_FILE',
		'label'                => 'WooCommerce Payments',
		'category'             => 'ecommerce',
		'status'               => 'tracks_woocommerce_payments_transactions',
		'wporg_slug'           => 'woocommerce-payments',
		'required_plugins'     => [
			'woocommerce',
		],
		'php_scripts'          => [
			'admin_scripts'    => [],
			'frontend_scripts' => [ 'frontend.php' ],
		],
	],
	'easy-digital-downloads'     => [
		'constant_or_function'       => 'EDD_PLUGIN_FILE',
		'label'                      => 'Easy Digital Downloads',
		'category'                   => 'ecommerce',
		'status'                     => 'tracks_sales_and_revenue',
		'load_ecommerce_integration' => true,
		'wporg_slug'                 => 'easy-digital-downloads',
		'php_scripts'                => [
			'admin_scripts'    => [],
			'frontend_scripts' => [ 'frontend.php' ],
		],
		'goals'                      =>
			[
				[
					'id'   => 'edd_complete_purchase',
					'type' => 'hook',
					'hook' => 'edd_complete_purchase',
				],
				[
					'id'       => 'edd_add_to_cart',
					'type'     => 'clicks',
					'selector' => '.edd-add-to-cart',
				],
				[
					'id'       => 'edd_go_to_checkout',
					'type'     => 'clicks',
					'selector' => '.edd_go_to_checkout',
				],
				[
					'id'       => 'edd_click_purchase',
					'type'     => 'clicks',
					'selector' => '#edd-purchase-button',
				],
			],
	],
	// Duplicate of easy-digital-downloads, kept for behavioural comparison pending cleanup.
	'easy-digital-downloads-pro' => [
		'constant_or_function'       => 'EDD_PLUGIN_FILE',
		'label'                      => 'Easy Digital Downloads',
		'category'                   => 'ecommerce',
		'status'                     => 'tracks_sales_and_revenue',
		'load_ecommerce_integration' => true,
		'php_scripts'                => [
			'admin_scripts'    => [],
			'frontend_scripts' => [ 'frontend.php' ],
		],
		'goals'                      =>
			[
				[
					'id'   => 'edd_complete_purchase',
					'type' => 'hook',
					'hook' => 'edd_complete_purchase',
				],
				[
					'id'       => 'edd_add_to_cart',
					'type'     => 'clicks',
					'selector' => '.edd-add-to-cart',
				],
				[
					'id'       => 'edd_go_to_checkout',
					'type'     => 'clicks',
					'selector' => '.edd_go_to_checkout',
				],
				[
					'id'       => 'edd_click_purchase',
					'type'     => 'clicks',
					'selector' => '#edd-purchase-button',
				],
			],
	],
	'edd-multi-currency'         => [
		'constant_or_function' => 'EDD_MULTI_CURRENCY_FILE',
		'label'                => 'Easy Digital Downloads - Multi Currency',
		'category'             => 'ecommerce',
		'status'               => 'tracks_multi_currency_transactions',
		'required_plugins'     => [
			'easy-digital-downloads',
		],
		'php_scripts'          => [
			'admin_scripts'    => [],
			'frontend_scripts' => [ 'frontend.php' ],
		],
	],
	'give-wp'                    => [
		'constant_or_function' => 'GIVE_VERSION',
		'label'                => 'Give - Donation Plugin',
		'category'             => 'ecommerce',
		'status'               => 'tracks_donations',
		'wporg_slug'           => 'give',
		'wporg_icon'           => 'icon-128x128.jpg',
		'php_scripts'          => [
			'admin_scripts'    => [],
			'frontend_scripts' => [],
		],
		'goals'                => [
			[
				'id'       => 'give_click_donation_open_modal',
				'type'     => 'clicks',
				'selector' => '.givewp-donation-form-modal__open',
			],
			[
				'id'       => 'give_click_donation',
				'type'     => 'clicks',
				'selector' => '.givewp-donation-form__steps-button-next',
			],
			[
				'id'   => 'give_donation_hook',
				'type' => 'hook',
				'hook' => 'give_process_donation_after_validation',
			],
		],
	],
	// Contact form plugins.
	'contact-form-7'             => [
		'constant_or_function' => 'WPCF7_VERSION',
		'label'                => 'Contact Form 7',
		'category'             => 'forms',
		'status'               => 'tracks_form_submissions',
		'wporg_slug'           => 'contact-form-7',
		'php_scripts'          => [
			'admin_scripts'    => [],
			'frontend_scripts' => [],
		],
		'goals'                =>
			[
				[
					'id'   => 'wpcf7_submit',
					'type' => 'hook',
					'hook' => 'wpcf7_submit',
				],
				[
					'id'       => 'wpcf7_submit_click',
					'type'     => 'clicks',
					'selector' => '.wpcf7-submit',
				],
			],
	],
	'wpforms'                    => [
		'constant_or_function' => 'WPFORMS_VERSION',
		'label'                => 'WPForms',
		'category'             => 'forms',
		'status'               => 'tracks_form_submissions',
		'wporg_slug'           => 'wpforms-lite',
		'php_scripts'          => [
			'admin_scripts'    => [],
			'frontend_scripts' => [],
		],
		'goals'                =>
			[
				[
					'id'   => 'wpforms_process_complete',
					'type' => 'hook',
					'hook' => 'wpforms_process_complete',
				],
				[
					'id'       => 'wpforms_click_submit',
					'type'     => 'clicks',
					'selector' => '.wpforms-submit',
				],
			],
	],
	'fluentform'                 => [
		'constant_or_function' => 'FLUENTFORM',
		'label'                => 'Fluent Forms',
		'category'             => 'forms',
		'status'               => 'tracks_form_submissions',
		'wporg_slug'           => 'fluentform',
		'goals'                =>
			[
				[
					'id'   => 'fluentform_submission_inserted',
					'type' => 'hook',
					'hook' => 'fluentform/submission_inserted',
				],
				[
					'id'       => 'fluentforms_click_submit',
					'type'     => 'clicks',
					'selector' => '.ff-btn-submit',
				],
			],
	],
	'happy-forms'                => [
		'constant_or_function' => 'HAPPYFORMS_VERSION',
		'label'                => 'Happyforms',
		'category'             => 'forms',
		'status'               => 'tracks_form_submissions',
		'wporg_slug'           => 'happyforms',
		'goals'                =>
			[
				[
					'id'   => 'happyforms_submission_success',
					'type' => 'hook',
					'hook' => 'happyforms_submission_success',
				],
			],
	],
	'ws-form'                    => [
		'constant_or_function' => 'WS_FORM_VERSION',
		'label'                => 'WS Form',
		'category'             => 'forms',
		'status'               => 'tracks_form_submissions',
		'wporg_slug'           => 'ws-form',
		'wporg_icon'           => 'icon-256x256.jpg',
		'php_scripts'          => [
			'admin_scripts'    => [],
			'frontend_scripts' => [],
		],
		'goals'                =>
			[
				[
					'id'   => 'wsf_submit',
					'type' => 'hook',
					'hook' => 'wsf_submit',
				],
			],
	],
	'gravity_forms'              => [
		'constant_or_function' => 'gravity_form',
		'label'                => 'Gravity Forms',
		'category'             => 'forms',
		'status'               => 'tracks_form_submissions',
		'php_scripts'          => [
			'admin_scripts'    => [],
			'frontend_scripts' => [],
		],
		'goals'                =>
			[
				[
					'id'   => 'gform_post_submission',
					'type' => 'hook',
					'hook' => 'gform_post_submission',
				],
				[
					'id'       => 'gform_click_submit',
					'type'     => 'clicks',
					'selector' => 'input[type="submit"].gform_button',
				],
			],
	],
	'formidable-forms'           => [
		'constant_or_function' => 'frm_forms_autoloader',
		'label'                => 'Formidable Forms',
		'category'             => 'forms',
		'status'               => 'tracks_form_submissions',
		'wporg_slug'           => 'formidable',
		'php_scripts'          => [
			'admin_scripts'    => [],
			'frontend_scripts' => [],
		],
		'goals'                =>
			[
				[
					'id'       => 'frm_submit_clicked',
					'type'     => 'clicks',
					'selector' => '.frm_button_submit',
				],
			],
	],
	'ninja-forms'                => [
		'constant_or_function' => 'Ninja_Forms',
		'label'                => 'Ninja Forms',
		'category'             => 'forms',
		'status'               => 'tracks_form_submissions',
		'wporg_slug'           => 'ninja-forms',
		'php_scripts'          => [
			'admin_scripts'    => [],
			'frontend_scripts' => [],
		],
		'goals'                =>
			[
				[
					'id'   => 'ninja_forms_after_submission',
					'type' => 'hook',
					'hook' => 'ninja_forms_after_submission',
				],
			],
	],
	// Caching plugins.
	'wp-rocket'                  => [
		'constant_or_function' => 'WP_ROCKET_VERSION',
		'label'                => 'WP Rocket',
		'category'             => 'performance',
		'status'               => 'enhances_caching_compatibility',
		'php_scripts'          => [
			'admin_scripts'    => [],
			'frontend_scripts' => [ 'frontend.php' ],
		],
	],
	'woocommerce-subscriptions'  => [
		'constant_or_function'       => 'WC_Subscriptions',
		'load_ecommerce_integration' => true,
		'required_plugins'           => [
			'woocommerce',
		],
		'label'                      => 'WooCommerce Subscriptions',
		'category'                   => 'ecommerce',
		'status'                     => 'tracks_signups_and_renewals',
		'php_scripts'                => [
			'admin_scripts'    => [ 'admin.php' ],
			'frontend_scripts' => [ 'event-listener.php' ],
		],
	],
	'edd-recurring'              => [
		'constant_or_function'       => 'EDD_RECURRING_VERSION',
		'load_ecommerce_integration' => true,
		'label'                      => 'Easy Digital Downloads - Recurring Payments',
		'category'                   => 'ecommerce',
		'status'                     => 'tracks_recurring_payments',
		'required_plugins'           => [
			'easy-digital-downloads',
		],
		'php_scripts'                => [
			'admin_scripts'    => [ 'admin.php' ],
			'frontend_scripts' => [ 'event-listener.php' ],
		],
		'goals'                      => [
			[
				'id'   => 'edd_subscription_post_create',
				'type' => 'hook',
				'hook' => 'edd_subscription_post_create',

			],
			[
				'id'   => 'edd_subscription_cancelled',
				'type' => 'hook',
				'hook' => 'edd_subscription_cancelled',
			],
		],
	],
	'subscriben'                 => [
		'constant_or_function'       => 'SUBSCRIBEN_VERSION',
		'load_ecommerce_integration' => true,
		'required_plugins'           => [
			'woocommerce',
		],
		'label'                      => 'Subscriben - WooCommerce Subscription Management',
		'category'                   => 'ecommerce',
		'status'                     => 'tracks_woocommerce_subscription_management',
		'php_scripts'                => [
			'admin_scripts'    => [ 'admin.php' ],
			'frontend_scripts' => [ 'event-listener.php' ],
		],
	],
];
