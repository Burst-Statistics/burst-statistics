<?php
defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

/**
 * List of integrations that Burst Statistics supports.
 * Good to know for goals:
 * - The goals should always be user trigger-able, otherwise the goal can not be tracked as it requires a UID at least for now.
 * -
 */
return [
	// Consent plugins.
	'complianz'                        => [
		'constant_or_function' => 'cmplz_version',
		'label'                => 'Complianz GDPR/CCPA',
	],

	'duplicate-post'                   => [
		'constant_or_function' => 'DUPLICATE_POST_CURRENT_VERSION',
		'label'                => 'Yoast Duplicate Post',
		'admin_only'           => true,
	],

	// Pagebuilders.
	'elementor'                        => [
		'constant_or_function' => 'ELEMENTOR_VERSION',
		'label'                => 'Elementor Website Builder',
		'goals'                =>
			[
				[
					'id'          => 'elementor_pro_forms_form_submitted',
					'type'        => 'hook',
					'status'      => 'active',
					'server_side' => true,
					'url'         => '*',
					'hook'        => 'elementor_pro/forms/form_submitted',
				],
			],
	],
	'beaver-builder'                   => [],
	'thrive-architect'                 => [],
	'divi-builder'                     => [],

	// eCommerce plugins.
	'woocommerce'                      => [
		'constant_or_function' => 'WC_VERSION',
		'label'                => 'WooCommerce',
		'goals'                =>
			[
				[
					'id'          => 'woocommerce_add_to_cart',
					'type'        => 'hook',
					'status'      => 'active',
					'server_side' => true,
					'url'         => '*',
					'hook'        => 'woocommerce_add_to_cart',
				],
				[
					'id'          => 'woocommerce_checkout_order_created',
					'type'        => 'hook',
					'status'      => 'active',
					'server_side' => true,
					'url'         => '*',
					'hook'        => 'woocommerce_checkout_order_created',
				],
				[
					'id'                => 'woocommerce_payment_complete',
					'type'              => 'hook',
					'status'            => 'active',
					'server_side'       => true,
					'url'               => '*',
					'hook'              => 'woocommerce_payment_complete',
					'conversion_metric' => 'visitors',
				],
			],
	],
	'easy-digital-downloads'           => [
		'constant_or_function' => 'EDD_PLUGIN_FILE',
		'label'                => 'Easy Digital Downloads',
		'goals'                =>
			[
				[
					'id'                => 'edd_complete_purchase',
					'type'              => 'hook',
					'status'            => 'active',
					'server_side'       => true,
					'url'               => '*',
					'hook'              => 'edd_complete_purchase',
					'conversion_metric' => 'visitors',
				],
			],
	],
	'easy-digital-downloads-recurring' => [
		'constant_or_function' => 'EDD_RECURRING_VERSION',
		'label'                => 'Easy Digital Downloads - Recurring Payments',
		'goals'                => [
			[
				'id'          => 'edd_subscription_post_create',
				'type'        => 'hook',
				'status'      => 'active',
				'server_side' => true,
				'url'         => '*',
				'hook'        => 'edd_subscription_post_create',
			],
			[
				'id'          => 'edd_subscription_cancelled',
				'type'        => 'hook',
				'status'      => 'active',
				'server_side' => true,
				'url'         => '*',
				'hook'        => 'edd_subscription_cancelled',
			],
		],
	],
	'wp-simple-pay'                    => [],
	'charitable'                       => [],
	'sure-cart'                        => [],

	// Contact from plugins.
	'contact-form-7'                   => [
		'constant_or_function' => 'WPCF7_VERSION',
		'label'                => 'Contact Form 7',
		'goals'                =>
			[
				[
					'id'          => 'wpcf7_submit',
					'type'        => 'hook',
					'status'      => 'active',
					'server_side' => true,
					'url'         => '*',
					'hook'        => 'wpcf7_submit',
				],
			],
	],
	'wpforms'                          => [
		'constant_or_function' => 'WPFORMS_VERSION',
		'label'                => 'WPForms',
		'goals'                =>
			[
				[
					'id'          => 'wpforms_process_complete',
					'type'        => 'hook',
					'status'      => 'active',
					'server_side' => true,
					'url'         => '*',
					'hook'        => 'wpforms_process_complete',
				],
			],
	],
	'gravity_forms'                    => [
		'constant_or_function' => 'gravity_form',
		'label'                => 'Gravity Forms',
		'goals'                =>
			[
				[
					'id'          => 'gform_post_submission',
					'type'        => 'hook',
					'status'      => 'active',
					'server_side' => true,
					'url'         => '*',
					'hook'        => 'gform_post_submission',
				],
			],
	],
	'formidable-forms'                 => [
		'constant_or_function' => 'frm_forms_autoloader',
		'label'                => 'Formidable Forms',
		'goals'                =>
			[
				[
					'id'          => 'frm_submit_clicked',
					'type'        => 'clicks',
					'status'      => 'active',
					'server_side' => false,
					'url'         => '*',
					'selector'    => '.frm_button_submit',
				],
			],
	],
	'ninja-forms'                      => [
		'constant_or_function' => 'Ninja_Forms',
		'label'                => 'Ninja Forms',
		'goals'                =>
			[
				[
					'id'          => 'ninja_forms_after_submission',
					'type'        => 'hook',
					'status'      => 'active',
					'server_side' => true,
					'url'         => '*',
					'hook'        => 'ninja_forms_after_submission',
				],
			],
	],
	'happy-forms'                      => [],
	'forminator'                       => [],
	'ws-form'                          => [],
	'everest-forms'                    => [],
	'kaliforms'                        => [],
	'form-maker-web10'                 => [],

	// Lead and CRM plugins.
	'mail-poet'                        => [],
	'mailster'                         => [],
	// No hooks to my knowledge.
	'optinmonster'                     => [],
	'thrive-leads'                     => [],
	'fluentcrm'                        => [],
	'groundhogg'                       => [],
	'mailchimp-for-wp'                 => [],

	// LMS plugins.
	'learndash'                        => [],
	'lifterlms'                        => [],
	'tutor-lms'                        => [],

	// caching plugins.
	'wp-rocket'                        => [
		'constant_or_function' => 'WP_ROCKET_VERSION',
		'label'                => 'WP Rocket',
	],
];
