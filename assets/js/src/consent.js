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
