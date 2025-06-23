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
					'id'   => 'elementor_pro_forms_form_submitted',
					'type' => 'hook',
					'hook' => 'elementor_pro/forms/form_submitted',
				],
			],
	],
	// eCommerce plugins.
	'woocommerce'                      => [
		'constant_or_function' => 'WC_VERSION',
		'label'                => 'WooCommerce',
		'goals'                =>
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
	'easy-digital-downloads'           => [
		'constant_or_function' => 'EDD_PLUGIN_FILE',
		'label'                => 'Easy Digital Downloads',
		'goals'                =>
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
	'easy-digital-downloads-recurring' => [
		'constant_or_function' => 'EDD_RECURRING_VERSION',
		'label'                => 'Easy Digital Downloads - Recurring Payments',
		'goals'                => [
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
	'give-wp'                          => [
		'constant_or_function' => 'GIVE_VERSION',
		'label'                => 'Give - Donation Plugin',
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
	// Contact from plugins.
	'contact-form-7'                   => [
		'constant_or_function' => 'WPCF7_VERSION',
		'label'                => 'Contact Form 7',
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
	'wpforms'                          => [
		'constant_or_function' => 'WPFORMS_VERSION',
		'label'                => 'WPForms',
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
	'happy-forms'                      => [
		'constant_or_function' => 'HAPPYFORMS_VERSION',
		'label'                => 'Happyforms',
		'goals'                =>
			[
				[
					'id'   => 'happyforms_submission_success',
					'type' => 'hook',
					'hook' => 'happyforms_submission_success',
				],
			],
	],
	'ws-form'                          => [
		'constant_or_function' => 'WS_FORM_VERSION',
		'label'                => 'WS Form',
		'goals'                =>
			[
				[
					'id'   => 'wsf_submit',
					'type' => 'hook',
					'hook' => 'wsf_submit',
				],
			],
	],
	'gravity_forms'                    => [
		'constant_or_function' => 'gravity_form',
		'label'                => 'Gravity Forms',
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
	'formidable-forms'                 => [
		'constant_or_function' => 'frm_forms_autoloader',
		'label'                => 'Formidable Forms',
		'goals'                =>
			[
				[
					'id'       => 'frm_submit_clicked',
					'type'     => 'clicks',
					'selector' => '.frm_button_submit',
				],
			],
	],
	'ninja-forms'                      => [
		'constant_or_function' => 'Ninja_Forms',
		'label'                => 'Ninja Forms',
		'goals'                =>
			[
				[
					'id'   => 'ninja_forms_after_submission',
					'type' => 'hook',
					'hook' => 'ninja_forms_after_submission',
				],
			],
	],
	// caching plugins.
	'wp-rocket'                        => [
		'constant_or_function' => 'WP_ROCKET_VERSION',
		'label'                => 'WP Rocket',
	],
];
