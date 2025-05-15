<?php
defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

return [
	'elementor'                        => [
		'goals' =>
			[
				[
					'id'          => 'elementor_pro_forms_form_submitted',
					'title'       => 'Elementor - ' . __( 'Form Submission', 'burst-statistics' ),
					'description' => __( 'Runs after submitting a form', 'burst-statistics' ),
				],
			],
	],
	'woocommerce'                      => [
		'goals' =>
			[
				[
					'id'          => 'woocommerce_add_to_cart',
					'title'       => 'WooCommerce - ' . __( 'Add to Cart', 'burst-statistics' ),
					'description' => __( "Runs after clicking 'Add to Cart' button ", 'burst-statistics' ),
				],
				[
					'id'          => 'woocommerce_checkout_order_created',
					'title'       => 'WooCommerce - ' . __( 'Order Created', 'burst-statistics' ),
					'description' => __( 'Runs before the payment', 'burst-statistics' ),
				],
				[
					'id'          => 'woocommerce_payment_complete',
					'title'       => 'WooCommerce - ' . __( 'Payment Completed', 'burst-statistics' ),
					'description' => __( 'Runs after completing a payment', 'burst-statistics' ),
				],
			],
	],
	'easy-digital-downloads'           => [
		'goals' =>
			[
				[
					'id'          => 'edd_complete_purchase',
					'title'       => 'Easy Digital Downloads -' . __( 'Purchase', 'burst-statistics' ),
					'description' => __( 'Runs after purchasing an item', 'burst-statistics' ),
				],
			],
	],
	'easy-digital-downloads-recurring' => [
		'goals' => [
			[
				'id'          => 'edd_subscription_post_create',
				'title'       => 'Easy Digital Downloads - ' . __( 'Subscription Created', 'burst-statistics' ),
				'description' => __( 'Runs after creating a subscription', 'burst-statistics' ),
			],
			[
				'id'          => 'edd_subscription_cancelled',
				'title'       => 'Easy Digital Downloads - ' . __( 'Subscription Cancelled', 'burst-statistics' ),
				'description' => __( 'Runs after cancelling a subscription', 'burst-statistics' ),
			],
		],
	],
	// Contact from plugins.
	'contact-form-7'                   => [
		'goals' =>
			[
				[
					'id'          => 'wpcf7_submit',
					'title'       => 'Contact Form 7 - ' . __( 'Submit form', 'burst-statistics' ),
					'description' => __( 'Runs after submitting a form', 'burst-statistics' ),
				],
			],
	],
	'wpforms'                          => [
		'goals' =>
			[
				[
					'id'          => 'wpforms_process_complete',
					'title'       => 'WPForms - ' . __( 'Submit form', 'burst-statistics' ),
					'description' => __( 'Runs after submitting a form', 'burst-statistics' ),
				],
			],
	],
	'gravity_forms'                    => [
		'goals' =>
			[
				[
					'id'          => 'gform_post_submission',
					'title'       => 'Gravity Forms - ' . __( 'Submit form', 'burst-statistics' ),
					'description' => __( 'Runs after submitting a form', 'burst-statistics' ),
				],
			],
	],
	'formidable-forms'                 => [
		'goals' =>
			[
				[
					'id'          => 'frm_submit_clicked',
					'title'       => 'Formidable Forms - ' . __( 'Submit form', 'burst-statistics' ),
					'description' => __( 'Runs after submitting a form', 'burst-statistics' ),
				],
			],
	],
	'ninja-forms'                      => [
		'goals' =>
			[
				[
					'id'          => 'ninja_forms_after_submission',
					'title'       => 'Ninja Forms - ' . __( 'Submit form', 'burst-statistics' ),
					'description' => __( 'Runs after submitting a form', 'burst-statistics' ),
				],
			],
	],
];
