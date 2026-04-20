<?php
/**
 * WooCommerce Subscriptions Frontend Integrations
 */

// Exit if accessed directly.
defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

require_once BURST_PATH . 'includes/Integrations/plugins/woocommerce-subscriptions/class-event-listener.php';
use Burst\Integrations\Plugins\WooCommerce_Subscriptions\Event_Listener;

$burst_woocommerce_subscriptions_frontend = new Event_Listener();
$burst_woocommerce_subscriptions_frontend->init();
