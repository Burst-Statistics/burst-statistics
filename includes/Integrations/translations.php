<?php
defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );
/**
 * We load the translations later, and only for admins.
 * If we load it earlier, it will cause PHP warnings from WordPress.
 */
return [
	'elementor'                        => [
		'goals' =>
			[
				[
					'id'    => 'elementor_pro_forms_form_submitted',
					'title' => 'Elementor - ' . __( 'Form Submission', 'burst-statistics' ),
				],
			],
	],
	'woocommerce'                      => [
		'goals' =>
			[
				[
					'id'    => 'woocommerce_add_to_cart',
					'title' => 'WooCommerce - ' . __( 'Add to Cart', 'burst-statistics' ),
				],
				[
					'id'    => 'woocommerce_checkout_order_created',
					'title' => 'WooCommerce - ' . __( 'Order Created', 'burst-statistics' ),
				],
				[
					'id'    => 'woocommerce_payment_complete',
					'title' => 'WooCommerce - ' . __( 'Payment Completed', 'burst-statistics' ),
				],
				[
					'id'    => 'woocommerce_add_to_cart_click',
					'title' => 'WooCommerce - ' . __( 'Add to cart button', 'burst-statistics' ),
				],
				[
					'id'    => 'woocommerce_click_checkout_button',
					'title' => 'WooCommerce - ' . __( 'Checkout button', 'burst-statistics' ),
				],
			],
	],
	'easy-digital-downloads'           => [
		'goals' =>
			[
				[
					'id'    => 'edd_complete_purchase',
					'title' => 'Easy Digital Downloads - ' . __( 'Purchase', 'burst-statistics' ),
				],
				[
					'id'    => 'edd_add_to_cart',
					'title' => 'Easy Digital Downloads - ' . __( 'Add to cart', 'burst-statistics' ),
				],
				[
					'id'    => 'edd_go_to_checkout',
					'title' => 'Easy Digital Downloads - ' . __( 'Go to checkout', 'burst-statistics' ),
				],
				[
					'id'    => 'edd_click_purchase',
					'title' => 'Easy Digital Downloads - ' . __( 'Purchase button', 'burst-statistics' ),
				],
			],
	],
	'easy-digital-downloads-recurring' => [
		'goals' => [
			[
				'id'    => 'edd_subscription_post_create',
				'title' => 'Easy Digital Downloads - ' . __( 'Subscription Created', 'burst-statistics' ),
			],
			[
				'id'    => 'edd_subscription_cancelled',
				'title' => 'Easy Digital Downloads - ' . __( 'Subscription Cancelled', 'burst-statistics' ),
			],
		],
	],
	'give-wp'                          => [
		'goals' => [
			[
				'id'    => 'give_click_donation_open_modal',
				'title' => 'Give - ' . __( 'Open donation modal', 'burst-statistics' ),
			],
			[
				'id'    => 'give_click_donation',
				'title' => 'Give - ' . __( 'Donation button', 'burst-statistics' ),
			],
			[
				'id'    => 'give_donation_hook',
				'type'  => 'clicks',
				'title' => 'Give - ' . __( 'Donation completed', 'burst-statistics' ),
			],
		],
	],
	// Contact from plugins.
	'contact-form-7'                   => [
		'goals' =>
			[
				[
					'id'    => 'wpcf7_submit',
					'title' => 'Contact Form 7 - ' . __( 'Form submitted', 'burst-statistics' ),
				],
				[
					'id'    => 'wpcf7_submit_click',
					'title' => 'Contact Form 7 - ' . __( 'Submit button clicked', 'burst-statistics' ),
				],
			],
	],
	'wpforms'                          => [
		'goals' =>
			[
				[
					'id'    => 'wpforms_process_complete',
					'title' => 'WPForms - ' . __( 'Submit form', 'burst-statistics' ),
				],
				[
					'id'    => 'wpforms_click_submit',
					'title' => 'WPForms - ' . __( 'Submit form', 'burst-statistics' ),
				],
			],
	],
	'ws-form'                          => [
		'goals' =>
			[
				[
					'id'    => 'wsf_submit',
					'title' => 'WS Forms - ' . __( 'Submit form', 'burst-statistics' ),

				],
			],
	],
	'happy-forms'                      => [
		'constant_or_function' => 'HAPPYFORMS_VERSION',
		'label'                => 'Happyforms',
		'goals'                =>
			[
				[
					'id'    => 'happyforms_submission_success',
					'title' => 'Happyforms - ' . __( 'Submit form', 'burst-statistics' ),
				],
			],
	],
	'gravity_forms'                    => [
		'goals' =>
			[
				[
					'id'    => 'gform_post_submission',
					'title' => 'Gravity Forms - ' . __( 'Submit form', 'burst-statistics' ),
				],
				[
					'id'    => 'gform_click_submit',
					'title' => 'Gravity Forms - ' . __( 'Submit form', 'burst-statistics' ),
				],
			],
	],
	'formidable-forms'                 => [
		'goals' =>
			[
				[
					'id'    => 'frm_submit_clicked',
					'title' => 'Formidable Forms - ' . __( 'Submit form', 'burst-statistics' ),
				],
			],
	],
	'ninja-forms'                      => [
		'goals' =>
			[
				[
					'id'    => 'ninja_forms_after_submission',
					'title' => 'Ninja Forms - ' . __( 'Submit form', 'burst-statistics' ),
				],
			],
	],
];
