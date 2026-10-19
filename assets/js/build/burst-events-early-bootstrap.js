/**
 * Tracking consent check, shared by burst.js and events-early-bootstrap.js.
 *
 * Not loaded on its own: gulp prepends it to both builds, so the bootstrap can
 * check consent when an event is triggered, before burst.js has loaded. Function
 * declarations, not `const`, because both scripts run on the same page and a
 * repeated top-level `const` throws "Identifier has already been declared".
 */

/**
 * Get tracking consent state via WP Consent API or consent managers.
 * @returns {'yes' | 'no' | 'undecided'}
 */
function burst_consent_state() {
  if ( typeof wp_has_consent !== 'function' ) {
    // Optional: the early bootstrap runs in <head> before burst.js sets
    // burst.options. It only drops events on a definitive 'no', so 'undecided'
    // and 'yes' are equivalent there and a missing flag must not throw.
    return window.burst.options?.consent_api_active ? 'undecided' : 'yes';
  }

  if ( window.waitfor_consent_hook && typeof window.wp_consent_type === 'undefined' ) {
    return 'undecided';
  }
  return wp_has_consent( 'statistics' ) ? 'yes' : 'no';
}

/**
 * Check if tracking consent is granted via WP Consent API or consent managers.
 * @returns {boolean}
 */
function burst_has_tracking_consent() {
  return burst_consent_state() === 'yes';
}

/**
 * Script for early bootstrap events.
 *
 * Turbo mode loads our main script later in the footer, but for plugin's script who wants to trigger the events before the main script is loaded.
 */

/**
 * @typedef {Object} BootstrapEvents
 *
 * @property {Function} event - Trigger a custom event.
 * @property {Array}    queue - Queue of events to be triggered when the main script is loaded.
 */


window.burst = window.burst || {};

/** @type {BootstrapEvents} */
window.burst.bootstrapEvents = {
	queue: [],

	event: function ( name, value, properties ) {
		// burst_consent_state() comes from consent.js, which gulp prepends to this build.
		if ( 'no' === burst_consent_state() ) {
			return;
		}

		// We need to push any events to the queue without checking burst.options.enable_custom_events as it will again be attached to main script.
		this.queue.push({ name, value, properties });
	}
};

// For early bootstrap, we attach burst.bootstrapEvents.event to burst.event so that any events triggered before the main script is loaded are queued and replayed later.
// Bound, because callers invoke it as burst.event(), where `this` would be window.burst.
window.burst.event = window.burst.bootstrapEvents.event.bind( window.burst.bootstrapEvents );
