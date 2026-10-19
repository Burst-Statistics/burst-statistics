/**
 * Script for custom events handling.
 *
 * Enqueued separately from burst.js, and only when custom events are enabled.
 * Both scripts load async, so whichever runs last calls init().
 */

/**
 * @typedef {Object} Events
 *
 * @property {Function} init - Take over burst.event, replay early calls and start automatic capture.
 * @property {Function} event - Trigger a custom event.
 * @property {Function} validateEventName - Validate the event name.
 * @property {Function} validateEventValue - Validate the event value.
 * @property {Function} validateEventProperties - Validate the event properties.
 * @property {Function} hasConsent - Check if the user has consented to tracking.
 * @property {Function} queueEvent - Buffer a validated event for the next request.
 * @property {Function} takeQueue - Hand the buffered events to a request and start a fresh queue.
 * @property {Function} clearQueue - Drop all buffered events.
 * @property {Function} captureGtagEvents - Record events pushed to dataLayer/gtag as custom events.
 * @property {Function} allowGtagParam - Check if a dataLayer/gtag parameter may be stored as a property.
 * @property {number}   MAX_EVENTS_PER_HIT - Most events buffered for one hit, matching what the server stores.
 * @property {Set}      GTAG_PARAM_ALLOWLIST - Standard GA4 / ecommerce parameters stored out of the box.
 * @property {Array}    queue - Validated events waiting for the next hit/update request.
 */

window.burst = window.burst || {};

/** @type {Events} */
window.burst.events = {
	// Capped at what the server stores per hit, so a page that fires events faster
	// than they can be sent, or one whose hits are rejected, can't grow the payload.
	MAX_EVENTS_PER_HIT: 10,

	// Other scalar parameters require the site's custom-parameter opt-in.
	GTAG_PARAM_ALLOWLIST: new Set( [
		'currency', 'coupon', 'shipping', 'tax', 'affiliation', 'payment_type',
		'item_id', 'item_name', 'item_brand', 'item_category', 'item_variant',
		'item_list_id', 'item_list_name', 'price', 'quantity',
		'method', 'content_type', 'content_id', 'search_term',
		'promotion_id', 'promotion_name', 'creative_name', 'creative_slot',
	] ),

	queue: [],

	/**
	 * Take over burst.event from the early bootstrap, replay the calls it queued
	 * and start automatic capture. Runs once, after both this file and burst.js
	 * have loaded, because it needs burst.options and the consent check.
	 */
	init: function () {
		window.burst.event = this.event.bind( this );

		const queued = window.burst.bootstrapEvents ? window.burst.bootstrapEvents.queue : [];
		queued.forEach( ( { name, value, properties } ) => this.event( name, value, properties ) );

		// Decoupled variant for themes/plugins with no load-order concerns.
		document.addEventListener( 'burst_event', ( e ) => {
			if ( e.detail ) {
				this.event( e.detail.name, e.detail.value, e.detail.properties );
			}
		} );

		if ( window.burst.options.track_gtag_events ) {
			this.captureGtagEvents();
		}
	},

	/**
	 * Trigger a custom event.
	 *
	 * @param {string} name - The name of the event.
	 * @param {number} value - The value of the event.
	 * @param {Object} properties - Additional properties for the event.
	 */
	event: function ( name, value, properties ) {
		// Opt-in: the server drops events too, this avoids sending them.
		if ( ! window.burst.options.enable_custom_events ) {
			return;
		}

		if ( ! this.hasConsent() ) {
			return;
		}

		if ( ! this.validateEventName( name ) ) {
			return;
		}

		const event = { name };

		// burst.event(name, properties), the same two-argument form the burst_event
		// action accepts server-side — an object here is properties, not a value.
		if ( value && typeof value === 'object' && ! Array.isArray( value ) && ! properties ) {
			properties = value;
			value = undefined;
		}

		// Checked against undefined, not truthiness, so a value of 0 is kept.
		if ( value !== undefined && this.validateEventValue( value ) ) {
			event.value = value;
		}

		if ( properties && this.validateEventProperties( properties ) ) {
			event.properties = properties;
		}

		this.queueEvent( event );
	},

	/**
	 * Validate the event name.
	 *
	 * @param {string} name - The name of the event.
	 * @returns {boolean} - True if the event name is valid, false otherwise.
	 */
	validateEventName: function ( name ) {
		if ( typeof name !== 'string' || name.trim() === '' ) {
			console.error( 'Event name must be a non-empty string.' );
			return false;
		}

		return true;
	},

	/**
	 * Validate the event value.
	 *
	 * @param {number} value - The value of the event.
	 * @returns {boolean} - True if the event value is valid, false otherwise.
	 */
	validateEventValue: function ( value ) {
		if ( typeof value !== 'number' || ! isFinite( value ) ) {
			console.error( 'Event value must be a finite number.' );
			return false;
		}
		return true;
	},

	/**
	 * Validate the event properties.
	 *
	 * @param {Object} properties - The properties of the event.
	 * @returns {boolean} - True if the event properties are valid, false otherwise.
	 */
	validateEventProperties: function ( properties ) {
		if ( typeof properties !== 'object' || properties === null || Array.isArray( properties ) ) {
			console.error( 'Event properties must be an object.' );
			return false;
		}
		return true;
	},

	/**
	 * Check if the user has consented to tracking.
	 *
	 * @returns {boolean} - True if the user has consented, false otherwise.
	 */
	hasConsent: function () {
		if ( typeof burst_has_tracking_consent === 'function' ) {
			return burst_has_tracking_consent();
		}

		return false;
	},

	/**
	 * Buffer a validated event for the next hit/update request.
	 *
	 * @param {Object} event - The event object containing name, value, and properties.
	 */
	queueEvent: function ( event ) {
		if ( this.queue.length >= this.MAX_EVENTS_PER_HIT ) {
			return;
		}

		this.queue.push( event );
	},

	/**
	 * Hand the buffered events to a request and start a fresh queue: they are
	 * sent once, whether or not the server stores them.
	 *
	 * @returns {Array} - The events to send.
	 */
	takeQueue: function () {
		const events = this.queue;
		this.queue = [];
		return events;
	},

	/**
	 * Drop all buffered events, e.g. when the hit they belong to won't be tracked.
	 */
	clearQueue: function () {
		this.queue = [];
	},

	/**
	 * Record events sent to Google Analytics / Google Tag Manager as custom events.
	 * gtag() is just `dataLayer.push(arguments)`, so intercepting push() catches both
	 * dataLayer.push({event: ...}) and gtag('event', ...).
	 */
	captureGtagEvents: function () {
		// `|| []` (not a bare existence check) so a later-loading GTM snippet reuses this same array.
		window.dataLayer = window.dataLayer || [];
		const originalPush = window.dataLayer.push;
		const events = this;

		window.dataLayer.push = function () {
			for ( let i = 0; i < arguments.length; i++ ) {
				const item = arguments[ i ];
				let name, params;
				if ( item && typeof item === 'object' && typeof item.event === 'string' ) {
					// GTM custom event: dataLayer.push({ event: 'name', ...params }).
					name = item.event;
					params = item;
				} else if ( item && item[ 0 ] === 'event' && typeof item[ 1 ] === 'string' ) {
					// gtag('event', name, params) internally calls dataLayer.push(arguments).
					name = item[ 1 ];
					params = item[ 2 ] || {};
				}

				// Skip GTM's own internal events (gtm.js, gtm.dom, ...) — otherwise gtm.js
				// alone writes a row on every pageview on any GTM-enabled site.
				if ( ! name || name.indexOf( 'gtm.' ) === 0 ) {
					continue;
				}

				let value;
				const properties = {};
				for ( const key in params ) {
					if ( ! Object.prototype.hasOwnProperty.call( params, key ) || key === 'event' ) {
						continue;
					}

					if ( key === 'value' && typeof params[ key ] === 'number' ) {
						value = params[ key ];
						continue;
					}

					if ( events.allowGtagParam( key, params[ key ] ) ) {
						properties[ key ] = params[ key ];
					}
				}
				events.event( name, value, properties );
			}
			return originalPush.apply( this, arguments );
		};
	},

	/**
	 * Check if a pushed dataLayer/gtag parameter may be stored as an event property.
	 *
	 * @param {string} key - Parameter name.
	 * @param {*} value - Parameter value.
	 * @returns {boolean} - True if the parameter may be stored, false otherwise.
	 */
	allowGtagParam: function ( key, value ) {
		// Objects and arrays (GA4's items, GTM4WP's user_data) are never stored, and
		// are dropped here rather than in the beacon payload.
		if ( value === null || typeof value === 'object' || typeof value === 'function' || typeof value === 'undefined' ) {
			return false;
		}

		if ( this.GTAG_PARAM_ALLOWLIST.has( key ) ) {
			return true;
		}

		return !! window.burst.options.track_gtag_custom_parameters;
	}
};

// burst.js calls init() when it loads after this file; initialize now when it loaded first.
if ( window.burst.isLoaded ) {
	window.burst.events.init();
}
