/**
 * Visitor opt-out button.
 *
 * Loaded only on pages that render the burst/opt-out block or the
 * [burst_opt_out] shortcode. The server sends the button without a state, so a
 * cached page is correct for every visitor: the current state is read here and
 * the label is set from the two labels the button carries.
 *
 * Consent is written where the tracker reads it. With the WP Consent API
 * active that is the API, and the burst_consent cookie is ignored (see
 * burst_consent_state() in assets/js/src/consent.js). Without the API the
 * cookie is the decision. burst_set_cookie() from burst.js cannot be used for
 * it: that one refuses to write without consent, which is exactly the state
 * the opt-out cookie has to record.
 */
( function() {
	const CONSENT_COOKIE = 'burst_consent';
	const UID_COOKIE = 'burst_uid';
	const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

	/**
	 * Write a first-party cookie that outlives the session.
	 *
	 * @param {string} name  Cookie name.
	 * @param {string} value Cookie value.
	 */
	const writeCookie = ( name, value ) => {
		const secure = 'https:' === location.protocol ? ';secure' : '';
		const expires = new Date( Date.now() + ONE_YEAR_MS ).toUTCString();
		document.cookie = `${ name }=${ value };SameSite=Lax${ secure };expires=${ expires };path=/`;
	};

	/**
	 * Remove a cookie. The path has to match the one it was written with.
	 *
	 * @param {string} name Cookie name.
	 */
	const deleteCookie = name => {
		document.cookie = `${ name }=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
	};

	/**
	 * Whether the WP Consent API owns the consent decision on this page.
	 *
	 * The tracker's own test, so the button can never report a state the
	 * tracker does not honour: an API with no consent type behind it answers
	 * yes to everything, and writing the decision there would lose it. The
	 * fallback covers a page the tracker is excluded from, where there is
	 * nothing to disagree with. wp_set_consent comes from the same script as
	 * wp_has_consent, so wherever the API decides there is something to write
	 * to; without it the click has nowhere to go and is left alone.
	 *
	 * @return {boolean} True when consent is set through the API.
	 */
	const apiOwnsConsent = () => ( 'function' === typeof window.burst_consent_api_decides )
		? window.burst_consent_api_decides()
		: 'function' === typeof window.wp_has_consent
			? !! ( window.wp_consent_type || window.wp_fallback_consent_type )
			: !! window.burst?.options?.consent_api_active;

	/**
	 * Whether this visitor is currently opted out of tracking.
	 *
	 * @return {boolean} True when tracking is off for this visitor.
	 */
	const isOptedOut = () => {
		if ( apiOwnsConsent() ) {
			return 'function' !== typeof window.wp_has_consent
				|| ! window.wp_has_consent( 'statistics' );
		}
		// The tracker's own test, so the button can never read the cookie
		// differently than the code that acts on it. It is a global of the
		// tracker build; the fallback covers a page the tracker is excluded
		// from, where there is nothing to disagree with.
		return 'function' === typeof window.burst_has_opted_out
			? window.burst_has_opted_out()
			: ( '; ' + document.cookie + ';' ).indexOf( `; ${ CONSENT_COOKIE }=no;` ) !== -1;
	};

	/**
	 * Show the action the button performs next, on every button on the page.
	 *
	 * All of them, because two placements (a block and a shortcode, or a header
	 * and a footer) share one state: a button left on the old label would do
	 * the opposite of what it says.
	 */
	const syncLabels = () => {
		const label = isOptedOut() ? 'optInLabel' : 'optOutLabel';
		document.querySelectorAll( '.burst-opt-out__button' ).forEach( button => {
			button.textContent = button.dataset[ label ];
		});
		document.querySelectorAll( '.burst-opt-out__status' ).forEach( status => {
			status.textContent = '';
		});
	};

	/**
	 * Drop the identifier the tracker has for this visitor, on opting out.
	 *
	 * Both forms of it: the cookie and the in-memory copy on a cookie site,
	 * and the cached fingerprint on a cookieless or fingerprint site, where no
	 * burst_uid cookie was ever written. Leaving the fingerprint would hand the
	 * next hit the very identifier that was just opted out.
	 */
	const forgetVisitor = () => {
		deleteCookie( UID_COOKIE );
		if ( window.burst?.cache ) {
			window.burst.cache.uid = null;
			window.burst.cache.fingerprint = null;
		}
	};

	/**
	 * Switch tracking off or on and report the new state.
	 *
	 * Tracking stops without a reload because every hit goes through the
	 * consent check. It starts again on the burst_consent_changed event, which
	 * the tracker needs because a page loaded while opted out never registered
	 * its listeners.
	 *
	 * @param {HTMLElement} button The clicked button.
	 */
	const toggle = button => {
		const optedOut = isOptedOut();
		const apiOwns = apiOwnsConsent();

		// Nothing to write the decision to, so the click changes nothing and
		// must not reset the tracker or move the labels either. Checked before
		// any of that happens.
		if ( apiOwns && 'function' !== typeof window.wp_set_consent ) {
			return;
		}

		if ( apiOwns ) {
			window.wp_set_consent( 'statistics', optedOut ? 'allow' : 'deny' );
		} else {
			writeCookie( CONSENT_COOKIE, optedOut ? 'yes' : 'no' );
			document.dispatchEvent( new CustomEvent( 'burst_consent_changed' ) );
		}

		if ( ! optedOut ) {
			forgetVisitor();
		}

		syncLabels();
		const status = button.parentElement?.querySelector( '.burst-opt-out__status' );
		if ( status ) {
			// Announced by the live region, so the change is not silent for a
			// screen reader: the label alone reads as the next action. Neither
			// message claims the visit is counted, which depends on more than
			// this choice (Do Not Track, a blocked role, a bot user agent).
			status.textContent = optedOut
				? button.dataset.optedInStatus
				: button.dataset.optedOutStatus;
		}
	};

	/**
	 * Label every button and listen for anything that changes the state.
	 *
	 * The click is delegated, so a button a theme inserts later works too. The
	 * Consent API event is the other way the state changes: the site's own
	 * banner can grant or withdraw statistics consent while the page is open.
	 */
	const init = () => {
		syncLabels();
		document.addEventListener( 'click', event => {
			const button = event.target.closest?.( '.burst-opt-out__button' );
			if ( button ) {
				toggle( button );
			}
		});
		document.addEventListener( 'wp_listen_for_consent_change', syncLabels );
		document.addEventListener( 'wp_consent_type_defined', syncLabels );
	};

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
}() );
