<?php
/**
 * Subscriben Frontend Integrations
 */

// Exit if accessed directly.
defined( 'ABSPATH' ) || die( 'you do not have access to this page!' );

require_once BURST_PATH . 'includes/Integrations/plugins/subscriben/class-event-listener.php';

use Burst\Integrations\Plugins\Subscriben\Event_Listener;

$burst_subscriben_frontend = new Event_Listener();
$burst_subscriben_frontend->init();
