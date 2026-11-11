/**
 * Tracking consent check, shared by burst.js and events-early-bootstrap.js.
 *
 * Not loaded on its own: gulp prepends it to both builds, so the bootstrap can
 * check consent when an event is triggered, before burst.js has loaded. Function
 * declarations, not `const`, because both scripts run on the same page and a
 * repeated top-level `const` throws "Identifier has already been declared".
 */

/**
 * Whether the visitor opted out with the Burst opt-out button.
 *
 * Not burst_get_cookie() from burst.js: that one returns a promise and is
 * declared in a build this file is prepended to, while the consent check has
 * to answer synchronously. A plain substring test rather than a regex plus
 * decodeURIComponent, because this runs for every hit and a malformed value
 * would make decodeURIComponent throw where nothing catches it. The delimiters
 * pin the match to the whole cookie, name and value.
 *
 * @returns {boolean} True when the opt-out cookie is set.
 */
function burst_has_opted_out() {
  return ( '; ' + document.cookie + ';' ).indexOf( '; burst_consent=no;' ) !== -1;
}

/**
 * Whether the WP Consent API actually decides consent on this page.
 *
 * The plugin on its own does not: without a consent management plugin to
 * define a consent type, wp_has_consent() returns true for every category
 * whatever the consent cookies say ("there's no consent management, we should
 * return true to activate all cookies"). Asking it would then overrule the
 * visitor's own choice with a yes they never gave, so that choice decides
 * instead.
 *
 * @returns {boolean} True when a denial through the API would be honoured.
 */
function burst_consent_api_decides() {
  return typeof wp_has_consent === 'function'
    && !! ( window.wp_consent_type || window.wp_fallback_consent_type );
}

/**
 * Get tracking consent state via WP Consent API or consent managers.
 * @returns {'yes' | 'no' | 'undecided'}
 */
function burst_consent_state() {
  if ( typeof wp_has_consent !== 'function' ) {
    // Optional: the early bootstrap runs in <head> before burst.js sets
    // burst.options. It only drops events on a definitive 'no', so 'undecided'
    // and 'yes' are equivalent there and a missing flag must not throw.
    if ( window.burst?.options?.consent_api_active ) {
      return 'undecided';
    }
    // No Consent API: the visitor's own choice from the Burst opt-out button
    // decides. With the API active it owns consent and this cookie is ignored.
    return burst_has_opted_out() ? 'no' : 'yes';
  }

  // Before the check below, because a consent type that is still on its way
  // is not the same as one that will never come.
  if ( window.waitfor_consent_hook && typeof window.wp_consent_type === 'undefined' ) {
    return 'undecided';
  }
  if ( ! burst_consent_api_decides() ) {
    return burst_has_opted_out() ? 'no' : 'yes';
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
