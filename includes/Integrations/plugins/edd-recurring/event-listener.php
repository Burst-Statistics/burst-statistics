<?php
/**
 * EDD Recurring Frontend Integrations
 */

// Exit if accessed directly.
defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

require_once BURST_PATH . 'includes/Integrations/plugins/edd-recurring/class-event-listener.php';
use Burst\Integrations\Plugins\EDD_Recurring\Event_Listener;

$burst_edd_recurring_common = new Event_Listener();
$burst_edd_recurring_common->init();
