<?php
/**
 * Subscriben Admin Integrations
 */

// Exit if accessed directly.
defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

add_filter( 'burst_subscription_integrations_enabled', '__return_true' );
