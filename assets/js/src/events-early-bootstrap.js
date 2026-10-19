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
