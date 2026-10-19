<?php
/**
 * Brevo frontend integration functions.
 *
 * Intercepts Brevo (Sendinblue) form submissions on the init action before Brevo
 * terminates execution via wp_send_json(), firing the brevo_form_submit action so
 * goals and form submissions can be recorded.
 *
 * @package Burst
 */

defined( 'ABSPATH' ) || die();

/**
 * Intercept Brevo form submission and fire the brevo_form_submit action.
 */
function burst_maybe_track_brevo_form(): void {
	static $tracked = false;

	if ( $tracked ) {
		return;
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Missing
	if ( ! isset( $_POST['sib_form_action'] ) || 'subscribe_form_submit' !== sanitize_text_field( wp_unslash( $_POST['sib_form_action'] ) ) ) {
		return;
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Missing
	$form_id = isset( $_POST['sib_form_id'] ) ? sanitize_text_field( wp_unslash( $_POST['sib_form_id'] ) ) : '';
	if ( empty( $form_id ) ) {
		return;
	}

	if ( 'oldForm' === $form_id ) {
		$form_id = (string) get_option( 'sib_old_form_id' );
	}

	if ( ! empty( $form_id ) ) {
		$tracked = true;
		// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Third-party integration hook.
		do_action( 'brevo_form_submit', $form_id );
	}
}
add_action( 'init', 'burst_maybe_track_brevo_form', 9 );
