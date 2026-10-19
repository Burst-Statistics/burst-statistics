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

// TimeMe.js should be loaded and running to track time as soon as it is loaded.

/**
 * @typedef {Object} BurstOptions
 * @property {string} privacy_level
 * @property {boolean} cookieless
 * @property {string} pageUrl
 * @property {boolean} beacon_enabled
 * @property {boolean} do_not_track
 * @property {boolean} enable_turbo_mode
 * @property {boolean} track_url_change
 * @property {boolean} track_external_links
 * @property {boolean} enable_custom_events
 * @property {boolean} track_gtag_events
 * @property {number} page_weight_sample_rate
 * @property {number} cookie_retention_days
 * @property {number} page_id
 * @property {boolean} consent_api_active
 * @property {boolean} debug
 */

/**
 * @typedef {Object} BurstState
 * @property {Object} tracking
 * @property {boolean} tracking.isInitialHit
 * @property {boolean} tracking.initialized
 * @property {number} tracking.lastUpdateTimestamp
 * @property {string|null} tracking.currentUrl
 * @property {string} tracking.beacon_url
 * @property {string} tracking.ajaxUrl
 * @property {BurstOptions} options
 * @property {Object} pageWeight
 * @property {boolean} pageWeight.eligible
 * @property {boolean} pageWeight.sampled
 * @property {number|null} pageWeight.bytes
 * @property {string|null} pageWeight.url
 * @property {Object} goals
 * @property {number[]} goals.completed
 * @property {string} goals.scriptUrl
 * @property {Array} goals.active
 * @property {Object} cache
 * @property {string|null} cache.uid
 * @property {string|null} cache.fingerprint
 * @property {boolean|null} cache.isUserAgent
 * @property {boolean|null} cache.isDoNotTrack
 * @property {boolean|null} cache.useCookies
 * @property {Object} [events] Custom events API from events.js, only loaded when custom events are enabled.
 * @property {boolean} isLoaded
 * @property {boolean} should_load_ecommerce
 */

// burst_consent_state() and burst_has_tracking_consent() come from consent.js,
// which gulp prepends to this file's builds.

// Ensure tracking object exists
burst.tracking = burst.tracking || {
  isInitialHit: true,
  initialized: false,
  lastUpdateTimestamp: 0,
  ajaxUrl: '',
  currentUrl: null,
};

burst.should_load_ecommerce = burst.should_load_ecommerce || false;

// Cache fallback normalizations
burst.cache = burst.cache || {
  uid: null,
  fingerprint: null,
  isUserAgent: null,
  isDoNotTrack: null,
  useCookies: null
};

// Normalize goal IDs
if (burst.goals?.active) {
  burst.goals.active = burst.goals.active.map(goal => ({
    ...goal,
    ID: parseInt(goal.ID, 10)
  }));
}
if (burst.goals?.completed) {
  burst.goals.completed = burst.goals.completed.map(id => parseInt(id, 10));
}

// Page rendering promise
const pageIsRendered = new Promise(resolve => {
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', resolve, { once: true });
  } else {
    resolve();
  }
});
// Inject goals script as a regular script tag to avoid CORS issues in headless setups.
// Dynamic import() enforces CORS; a script tag does not.
if (burst.goals?.active?.some(goal => !goal.page_url || goal.page_url === '' || goal.page_url === burst.options.pageUrl)) {
  const script = document.createElement('script');
  script.async = true;
  script.src = burst.goals.scriptUrl;
  document.head.appendChild(script);
}

/**
 * Get a cookie by name
 * @param name
 * @returns {Promise}
 */
const burst_get_cookie = name => {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let c of ca) {
    c = c.trim();
    if (c.indexOf(nameEQ) === 0) {
      // An empty value counts as absent. Browsers that stored an empty burst_uid
      // cookie would otherwise keep reading it back as their identifier.
      const value = c.substring(nameEQ.length);
      if (value) return Promise.resolve(value);
    }
  }
  return Promise.reject(false);
};
/**
 * Set a cookie
 * @param name
 * @param value
 */
const burst_set_cookie = (name, value) => {
  if (!burst_has_tracking_consent() || !value) return;
  const path = '/';
  let domain = '';
  let secure = location.protocol === 'https:' ? ';secure' : '';
  const date = new Date();
  date.setTime(date.getTime() + (burst.options.cookie_retention_days * 86400000));
  const expires = ';expires=' + date.toGMTString();
  if (domain) domain = ';domain=' + domain;
  document.cookie = `${name}=${value};SameSite=Strict${secure}${expires}${domain};path=${path}`;
};
/**
 * Should we use cookies for tracking
 * @returns {boolean}
 */
const burst_use_cookies = () => {
  if (!burst_has_tracking_consent()) {
    return false;
  }
  if (burst.cache.useCookies !== null) return burst.cache.useCookies;
  const result = navigator.cookieEnabled && !burst.options.cookieless && burst.options.privacy_level !== 'private_mode';
  burst.cache.useCookies = result;
  return result;
};
/**
 * Enable or disable cookies
 * @returns {boolean}
 */
function burst_enable_cookies() {
  burst.options.cookieless = false;
  burst.cache.useCookies = null;
  if (burst_use_cookies()) {
    burst_uid().then(uid => burst_set_cookie('burst_uid', uid));
  }
}
/**
 * Get or set the user identifier
 * @returns {Promise}
 */
const burst_uid = () => {
  if (burst.cache.uid) return Promise.resolve(burst.cache.uid);
  return burst_get_cookie('burst_uid').then(cookie_uid => {
    burst.cache.uid = cookie_uid;
    return cookie_uid;
  }).catch(() => {
    const uid = burst_generate_uid();
    burst_set_cookie('burst_uid', uid);
    burst.cache.uid = uid;
    return uid;
  });
};
/**
 * Generate a random string
 *
 * Built with a plain loop on purpose. Legacy libraries that themes still load
 * (Prototype, MooTools) overwrite Array.from with a single-argument version
 * that silently ignores the map callback, which turned this into an empty
 * string and left every visitor on such a site without an identifier.
 *
 * @returns {string}
 */
const burst_generate_uid = () => {
  let uid = '';
  for (let i = 0; i < 32; i++) {
    uid += Math.floor(Math.random() * 16).toString(16); // nosemgrep
  }
  return uid;
};

const burst_fingerprint = () => {
  if (burst.cache.fingerprint !== null) return Promise.resolve(burst.cache.fingerprint);
  const tm = new ThumbmarkJS.Thumbmark({
    // The webgl component renders a shader pattern and hashes the pixels. It
    // costs ~190ms on desktop (4x on mobile) inside the first-interaction long
    // task, while the GPU vendor/renderer strings already live in the cheap
    // `hardware` component and canvas covers rasterization differences. Brave
    // and Firefox also randomize WebGL pixel output per session, so dropping it
    // makes the fingerprint more stable for those visitors.
    // system.applePayVersion reads window.ApplePaySession, which payment
    // scripts define on the checkout page only (the PayPal SDK loads Apple's
    // apple-pay-sdk.js, which installs it in every browser). Including it gives
    // a buyer a new fingerprint on checkout, so the order is attributed to a
    // different visitor than the cart and the cart is never marked converted.
    exclude: ['webgl', 'system.applePayVersion'],

    permissions_to_check: [
      'geolocation',
      'notifications',
      'camera',
      'microphone',
      'gyroscope',
      'accelerometer',
      'magnetometer',
      'ambient-light-sensor',
      'background-sync',
      'persistent-storage'
    ]
  });

  return tm.get().then(result => {
    let baseFingerprint = result.thumbmark;

    const extraEntropy = [
      // Screen details
      screen.availWidth + 'x' + screen.availHeight,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      window.devicePixelRatio || 1,

      // System info
      navigator.hardwareConcurrency || 0,
      navigator.deviceMemory || 0,
      navigator.maxTouchPoints || 0,
      new Date().getTimezoneOffset(),

      // Browser capabilities
      navigator.cookieEnabled ? '1' : '0',
      typeof(Storage) !== 'undefined' ? '1' : '0',
      typeof(indexedDB) !== 'undefined' ? '1' : '0',
      navigator.onLine ? '1' : '0',
      navigator.languages ? navigator.languages.slice(0, 3).join(',') : navigator.language,

      // Platform details
      navigator.platform,
      navigator.oscpu || '',

      navigator.connection ? navigator.connection.effectiveType || '' : '',

      'ontouchstart' in window ? '1' : '0',
      typeof window.orientation !== 'undefined' ? '1' : '0',
      window.screen.orientation ? window.screen.orientation.type || '' : ''
    ].filter(item => item !== '').join('|');

    const combinedData = baseFingerprint + '|' + extraEntropy;

    let hash = 0;
    for (let i = 0; i < combinedData.length; i++) {
      const char = combinedData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
    const finalFingerprint = hashHex + baseFingerprint.substring(8);

    burst.cache.fingerprint = finalFingerprint;
    return finalFingerprint;

  }).catch(error => {
    console.error(error);
    return null;
  });
};

const burst_get_time_on_page = () => {
  if (typeof TimeMe === 'undefined') return Promise.resolve(0);
  const time = TimeMe.getTimeOnCurrentPageInMilliseconds();
  TimeMe.resetAllRecordedPageTimes();
  TimeMe.initialize({ idleTimeoutInSeconds: 30 });
  return Promise.resolve(time);
};
/**
 * Check if this is a user agent
 * @returns {boolean}
 */
const burst_is_user_agent = () => {
  if (burst.cache.isUserAgent !== null) return burst.cache.isUserAgent;
  // GoogleOther and Google-InspectionTool render JavaScript but have no "bot" in their user agent.
  const botPattern = /bot|spider|crawl|slurp|mediapartners|applebot|bing|duckduckgo|yandex|baidu|facebook|twitter|googleother|google-inspectiontool/i;
  const result = botPattern.test(navigator.userAgent);
  burst.cache.isUserAgent = result;
  return result;
};

const burst_is_do_not_track = () => {
  if (burst.cache.isDoNotTrack !== null) return burst.cache.isDoNotTrack;
  if (!burst.options.do_not_track) {
    burst.cache.isDoNotTrack = false;
    return false;
  }
    // check for doNotTrack and globalPrivacyControl headers
  const result =
		"1" === navigator.doNotTrack ||
		"yes" === navigator.doNotTrack ||
		"1" === navigator.msDoNotTrack ||
		"1" === window.doNotTrack ||
		1 === navigator.globalPrivacyControl;
  burst.cache.isDoNotTrack = result;
  return result;
};
/**
 * Debug is enabled by the localized option (BURST_DEBUG) or at runtime by the
 * auto debug window inline flag, which can override a debug value baked into
 * the combined script file.
 * @returns {boolean}
 */
const burst_debug_enabled = () => !!( burst.options.debug || window.burst_debug );

const burst_log_tracking_error = ({ status = 0, error = '', data = {} }) => {
  if ( !burst_debug_enabled() || !burst.tracking.ajaxUrl ) {
    return;
  }

  // Report at most one error per browser session: when tracking is down every
  // pageview fails, and each report is a full admin-ajax request.
  try {
    if ( sessionStorage.getItem( 'burst_error_reported' ) ) {
      return;
    }
    sessionStorage.setItem( 'burst_error_reported', '1' );
  } catch ( e ) {
    // sessionStorage unavailable; report anyway.
  }

  fetch(burst.tracking.ajaxUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      action: 'burst_tracking_error',
      status,
      error,
      data: data
    })
  });
};

/**
 * Send the hit payload to the beacon endpoint with a keepalive fetch.
 *
 * @param {Blob}   blob    The JSON payload as a blob.
 * @param {string} payload The raw JSON payload, reported on failure in debug mode.
 */
const burst_beacon_fetch = (blob, payload) => {
  fetch(burst.tracking.beacon_url, {
    method: 'POST',
    body: blob,
    keepalive: true,
    headers: {
      'Content-Type': 'application/json'
    }
  }).then(response => {
    if (!response.ok && burst_debug_enabled()) {
      burst_log_tracking_error({
        status: 0,
        error: 'sendBeacon failed',
        data: payload
      });
    }
  }).catch(error => {
    if (burst_debug_enabled()) {
      burst_log_tracking_error({
        status: 0,
        error: error?.message || 'sendBeacon failed',
        data: payload
      });
    }
  });
};

/**
 * Send the hit payload to the beacon endpoint.
 *
 * sendBeacon is the default transport: JavaScript-rendering crawlers such as
 * Google's renderer execute fetch() but drop beacons, so a fetch-first
 * transport counts them as visitors. fetch is only used in debug mode, where
 * the response is needed to report errors, or when the beacon was not queued.
 *
 * @param {string} payload The JSON payload.
 */
const burst_beacon_request = (payload) => {
  const blob = new Blob([payload], { type: 'application/json' });
  const canFetch = typeof fetch === 'function';
  if (burst_debug_enabled() && canFetch) {
    burst_beacon_fetch(blob, payload);
    return;
  }

  const isQueued = typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(burst.tracking.beacon_url, blob);
  if (!isQueued && canFetch) {
    burst_beacon_fetch(blob, payload);
  }
};

/**
 * Make a XMLHttpRequest and return a promise
 * @param obj
 * @returns {Promise<unknown>}
 */
const burst_api_request = obj => {
  const payload = JSON.stringify(obj.data || {});
  return new Promise(resolve => {
    if (burst.options.beacon_enabled) {
      burst_beacon_request(payload);
      resolve({ status: 200, data: 'ok' });
    } else {
      const token = Math.random().toString(36).substring(2, 9);// nosemgrep
      wp.apiFetch({
        path: `/burst/v1/track/?token=${token}`,
        keepalive: true,
        method: 'POST',
        data: payload,
      }).then(res => {
        const status = res.status || 200;
        resolve({ status, data: res.data || res });
        if (status !== 200) {
          burst_log_tracking_error({
            status,
            error: 'Non-200 status',
            data: payload
          });
        }
      }).catch(error => {
        resolve({ status: 200, data: 'ok' });
        burst_log_tracking_error({
          status: 0,
          error: error?.message || 'Burst tracking request failed',
          data: payload
        });
      });
    }
  });
};

/**
 * Scroll depth and zone dwell time tracking
 */
let burstMaxScroll = 0;
let burstLastScrollTimestamp = Date.now();
let burstCurrentZone = '0_25';
const burstDwellTimePerZone = {
  '0_25': 0,
  '25_50': 0,
  '50_75': 0,
  '75_100': 0,
};

function burst_update_scroll_metrics() {
  const now = Date.now();
  const elapsedMs = Math.max(0, now - burstLastScrollTimestamp);
  burstLastScrollTimestamp = now;

  if (document.visibilityState === 'visible' && elapsedMs > 0 && elapsedMs < 300000) {
    if (burstDwellTimePerZone[burstCurrentZone] !== undefined) {
      burstDwellTimePerZone[burstCurrentZone] += elapsedMs;
    }
  }

  const docHeight = Math.max(
    document.body?.scrollHeight || 0,
    document.documentElement?.scrollHeight || 0,
    document.body?.offsetHeight || 0,
    document.documentElement?.offsetHeight || 0
  );
  const winHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
  const scrollTop = window.scrollY || window.pageYOffset || document.documentElement?.scrollTop || 0;

  let currentPercent = 0;
  if (docHeight > winHeight) {
    currentPercent = Math.min(100, Math.max(0, Math.round((scrollTop / (docHeight - winHeight)) * 100)));
  } else {
    currentPercent = 100;
  }

  if (currentPercent > burstMaxScroll) {
    burstMaxScroll = currentPercent;
  }

  if (currentPercent < 25) {
    burstCurrentZone = '0_25';
  } else if (currentPercent < 50) {
    burstCurrentZone = '25_50';
  } else if (currentPercent < 75) {
    burstCurrentZone = '50_75';
  } else {
    burstCurrentZone = '75_100';
  }
}

let burstScrollTicking = false;
function burst_handle_scroll() {
  if (!burstScrollTicking) {
    window.requestAnimationFrame(() => {
      burst_update_scroll_metrics();
      burstScrollTicking = false;
    });
    burstScrollTicking = true;
  }
}

function burst_init_scroll_tracker() {
  burstLastScrollTimestamp = Date.now();
  burst_update_scroll_metrics();
  window.addEventListener('scroll', burst_handle_scroll, { passive: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', burst_init_scroll_tracker, { once: true });
} else {
  burst_init_scroll_tracker();
}

/**
 * Page weight sampling: picks a share of pageviews, measures what the initial
 * load transferred once the network has gone quiet, and hands the sample to
 * the exit hit (or an SPA navigation flush) for delivery.
 */
burst.pageWeight = {

  /** Whether this pageview was picked for sampling. */
  eligible: false,

  /** Whether a sample has already been handed to a hit. */
  sampled: false,

  /** Measured bytes, or null until the quiet-period snapshot runs. */
  bytes: null,

  /** The URL the bytes were measured on. */
  url: null,

  /**
   * Decide whether this pageview is sampled and prepare the browser for it.
   */
  init() {
    const sampleRate = Math.min(1, Math.max(0, Number(burst.options.page_weight_sample_rate) || 0));
    // Purely client-side: a server-computed forced-eligibility flag would get
    // baked into any full-page cache (Rocket/LiteSpeed/Varnish) and served
    // statically to every subsequent visitor regardless of the page's real
    // measurement state, so eligibility is decided fresh per browser instead.
    this.eligible = Math.random() < sampleRate; // nosemgrep

    // Only a sampled pageview reads the resource entries, so only it needs a
    // buffer larger than the default 250; everyone else keeps the site's own size.
    if (this.eligible && performance?.setResourceTimingBufferSize) {
      performance.setResourceTimingBufferSize(1000);
    }
  },

  /**
   * Whether this pageview still wants a page weight sample: it was picked for
   * sampling and nothing has delivered one yet. Re-checked around every wait,
   * because an SPA navigation can end sampling for this pageview mid-flight.
   *
   * @returns {boolean}
   */
  isWanted() {
    return this.eligible && !this.sampled;
  },

  /**
   * Whether a measured sample is sitting here undelivered. Delivery has exactly
   * two chances — the exit hit and an SPA navigation flush — and both ask this,
   * so it is spelled once.
   *
   * The bytes check is a loose != null on purpose: a strict !== null lets
   * undefined through. The exit hit then reports { url: this.url } with the url
   * also undefined, which overwrites location.href and costs that hit its time
   * on page.
   *
   * @returns {boolean}
   */
  hasUndelivered() {
    return this.isWanted() && this.bytes != null;
  },

  /**
   * Measure after completed resource entries have been quiet for three seconds.
   * Resource Timing does not expose a reliable count of every pending request,
   * so late-starting resources remain part of the documented lower bound.
   *
   * @param {Function} [onSampleStored] Called once a snapshot has been stored.
   */
  async measureAfterQuietPeriod(onSampleStored) {
    if (!this.isWanted()) {
      return;
    }

    // A prerendered page loads fully while document.visibilityState is still
    // 'hidden', so a sample stored during prerender would trip the hidden-send
    // path: its exit hit races the create hit (both parked on this same
    // promise) and can reach the server first, and it would measure pages the
    // visitor never activates. Arm the quiet period only on a page that is
    // being rendered for real; on a normal load the promise is already
    // resolved and this changes nothing.
    await pageIsRendered;
    if (!this.isWanted()) {
      return;
    }

    const quietPeriodMs = 3000;
    const maxWaitMs = 15000;
    let quietTimer = null;
    let maxWaitTimer = null;
    let observer = null;
    let measurementQueued = false;

    const cleanup = () => {
      if (quietTimer !== null) {
        clearTimeout(quietTimer);
      }

      if (maxWaitTimer !== null) {
        clearTimeout(maxWaitTimer);
      }
      observer?.disconnect();
    };

    const measure = () => {
      if (measurementQueued) {
        return;
      }

      measurementQueued = true;

      cleanup();

      // Re-checked after the wait: a URL change can have ended sampling for this
      // pageview while the quiet period was still running.
      if (!this.isWanted()) {
        return;
      }

      // Snapshot page weight and URL at the quiet moment; delivery happens with
      // the exit hit, so no extra request is needed. Use currentUrl instead of
      // location.href so URL changes via pushState/replaceState don't associate
      // bytes measured for the original pageview with the new URL.
      const bytes = this.readBytes();
      if (bytes !== null) {
        this.bytes = bytes;
        this.url = burst.tracking.currentUrl;
        // A sample can arrive after an exit hit has already gone out: a tab
        // opened in the background is hidden from the start, so its exit hit
        // leaves before the quiet period and carries nothing. Closing that tab
        // without ever focusing it never resets the one-shot latch, and pagehide
        // is the sample's last chance — so reset the latch here, where there is
        // new information to send.
        onSampleStored?.();
      }
    };

    const resetQuietTimer = () => {
      if (quietTimer !== null) {
        clearTimeout(quietTimer);
      }
      quietTimer = setTimeout(measure, quietPeriodMs);
    };

    if (typeof PerformanceObserver === 'function') {
      try {
        observer = new PerformanceObserver((list) => {
          if (list.getEntries().length > 0) {
            resetQuietTimer();
          }
        });
        observer.observe({ type: 'resource' });
      } catch {
        observer = null;
      }
    }

    resetQuietTimer();
    maxWaitTimer = setTimeout(measure, maxWaitMs);
  },

  /**
   * Read initial page weight (navigation + resource transfer sizes) now. Returns
   * null when Resource Timing has no navigation entry to anchor the measurement.
   * Called for the quiet-period snapshot.
   *
   * @returns {number|null}
   */
  readBytes() {
    const nav = performance.getEntriesByType('navigation')[0];
    if (!nav) return null;

    return nav.transferSize +
      performance.getEntriesByType('resource')
        .reduce((total, resource) => total + (resource.transferSize || 0), 0);
  },

  /**
   * Hand the undelivered sample to the hit being sent, once.
   *
   * @returns {{page_weight_bytes?: number}} The hit data to merge in.
   */
  takeSample() {
    // Only the quiet-period snapshot is trusted: it captures initial page weight
    // after load, not the whole visit's transfers (lazy-loaded images, infinite
    // scroll, video). A visit that exits before the quiet period fires has no
    // reliable weight (the load may still be in flight), so it contributes no
    // sample rather than an undercount that would drag the per-URL average down.
    if (!this.hasUndelivered()) {
      return {};
    }

    this.sampled = true;

    return {
      page_weight_bytes: this.bytes
    };
  },

  /**
   * End sampling for this pageview: an SPA navigation is not a page load, so
   * the pages it shows are never sampled.
   */
  reset() {
    this.eligible = false;
    this.bytes = null;
    this.url = null;
  },
};

burst.pageWeight.init();

/**
 * Update the tracked hit
 * Mostly used for updating time spent on a page
 * Also used for updating the UID (from fingerprint to a cookie)
 */
async function burst_update_hit(
	update_uid = false,
	force = false,
	extraData = {},
	include_page_weight = false,
) {
	await pageIsRendered;
	if (burst_is_user_agent() || burst_is_do_not_track() || !burst_has_tracking_consent()) {
		burst.events?.clearQueue();
		return;
	}
	if (burst.tracking.isInitialHit) {
		burst_track_hit(extraData);
		return;
	}

	// If we don't force the update, we only update the hit if 300ms have passed since the last update
	if (!force && Date.now() - burst.tracking.lastUpdateTimestamp < 300) return;

	document.dispatchEvent(
		new CustomEvent("burst_before_update_hit", { detail: burst }),
	);

	const [time, id] = await Promise.all([
		burst_get_time_on_page(),
		burst.options.privacy_level === 'private_mode'
			? Promise.resolve(update_uid ? [false, false] : false)
			: update_uid
				? Promise.all([burst_uid(), burst_fingerprint()])
				: burst_use_cookies()
					? burst_uid()
					: burst_fingerprint(),
	]);

	burst_update_scroll_metrics();

	const data = {
		fingerprint: update_uid ? id[1] : burst_use_cookies() ? false : id,
		uid: update_uid ? id[0] : burst_use_cookies() ? id : false,
		url: location.href,
		time_on_page: time,
		max_scroll: burstMaxScroll,
		dwell_zones: JSON.stringify(burstDwellTimePerZone),
		completed_goals: burst.goals.completed,
		should_load_ecommerce: burst.should_load_ecommerce,
		...(include_page_weight ? burst.pageWeight.takeSample() : {}),
		...extraData,
	};

	if (time > 0 || data.uid !== false || data.page_weight_bytes !== undefined) {
		// Take the queue only once a request is going out, so an event triggered
		// while it is in flight goes with the next hit. Sent once, never resent.
		data.events = burst.events?.takeQueue() ?? [];
		await burst_api_request({ data: data });
		burst.tracking.lastUpdateTimestamp = Date.now();
	}
}
/**
 * Track a hit
 *
 */
async function burst_track_hit(extraData = {}) {
  const isInitialHit = burst.tracking.isInitialHit;
  burst.tracking.isInitialHit = false;
  await pageIsRendered;
  if ( !isInitialHit ) {
    burst_update_hit(false, false, extraData);
    return;
  }
  if (burst_is_user_agent() || burst_is_do_not_track() || !burst_has_tracking_consent()) {
    burst.tracking.isInitialHit = true;
    burst.events?.clearQueue();
    return;
  }

  // Restore the flag when throttled, as the consent guard above does: returning
  // with the flag already cleared would turn the next hit into an update and
  // permanently lose this page's create hit.
  if (Date.now() - burst.tracking.lastUpdateTimestamp < 300) {
    burst.tracking.isInitialHit = true;
    return;
  }

  document.dispatchEvent(new CustomEvent('burst_before_track_hit', { detail: burst }));

  const [time, id] = await Promise.all([
    burst_get_time_on_page(),
    burst.options.privacy_level === 'private_mode'
      ? Promise.resolve(false)
      : burst_use_cookies() ? burst_uid() : burst_fingerprint()
  ]);

  //wait for body document to resolve.
  let attempts = 0;
  const maxAttempts = 200; // 200 * 2ms = 400ms max, 2ms should be enough to get the body in almost all cases.
  while ( !document.body && attempts++ < maxAttempts ) {
    await new Promise(resolve => setTimeout(resolve, 2));
  }

  if ( !document.body ) {
    console.warn('Burst: missing page_id attribute, not able to resolve body element.');
  }

  burst_update_scroll_metrics();

  const burstSearchParams = new URLSearchParams(location.search);
  const data = {
    uid: burst_use_cookies() ? id : false,
    fingerprint: burst_use_cookies() ? false : id,
    url: location.href,
    referrer_url: document.referrer,
    user_agent: navigator.userAgent || 'unknown',
    device_resolution: `${window.screen.width * window.devicePixelRatio}x${window.screen.height * window.devicePixelRatio}`,
    time_on_page: time,
    max_scroll: burstMaxScroll,
    dwell_zones: JSON.stringify(burstDwellTimePerZone),
    completed_goals: burst.goals.completed,
    // Taken before burst_track_hit is dispatched, so events a listener triggers go with the next hit.
    events: burst.events?.takeQueue() ?? [],
    page_id: document.body?.dataset?.burst_id ?? document.body?.dataset?.b_id ?? 0,
    page_type: document.body?.dataset?.burst_type ?? document.body?.dataset?.b_type ?? '',
    should_load_ecommerce: burst.should_load_ecommerce,
    search_term: burstSearchParams.get('s') || '',
    ...extraData,
  };

  document.dispatchEvent(new CustomEvent('burst_track_hit', { detail: data }));
  await burst_api_request({ method: 'POST', data: data });
  burst.tracking.lastUpdateTimestamp = Date.now();
}
/**
 * Initialize events
 * @returns {Promise<void>}
 *
 * More information on why we just use visibilitychange instead of beforeunload
 * to update the hits:
 * https://www.igvita.com/2015/11/20/dont-lose-user-and-app-state-use-page-visibility/
 *     https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event
 *     https://xgwang.me/posts/you-may-not-know-beacon/#the-confusion
 *
 */
function burst_init_events() {
  burst.tracking.currentUrl = location.href;

  // The single exit delivery path: with the page-weight sample no longer sent
  // by its own beacon, the exit hit carries both time-on-page and the sample.
  // Registered for visibilitychange AND pagehide so iOS Safari and bfcache
  // navigations (which can skip visibilitychange) still flush — the two can
  // both fire for the same exit, so a one-shot latch stops that from sending
  // the hit twice. The latch resets whenever the page becomes visible again
  // (tab switch back, or pageshow for a page restored from bfcache), so every
  // later hide still sends its update, and when a page weight snapshot lands
  // after an exit hit has gone out (see resetExitHit below).

  let exitHitSent = false;
  // Clears the latch so exactly one more exit hit can go out. Every reset of
  // the latch goes through here; also passed to the page weight snapshot, which
  // cannot see this closure.
  const resetExitHit = () => {
    exitHitSent = false;
  };

  const sendExitHit = () => {
    if (exitHitSent) {
      return;
    }
    exitHitSent = true;
    const includePageWeight = burst.pageWeight.hasUndelivered();
    // The sample is reported against the URL it was actually measured on
    // (snapshotted alongside the bytes), not wherever location.href points by
    // the time the visitor leaves — see burst.pageWeight.measureAfterQuietPeriod().
    const extraData = includePageWeight ? { url: burst.pageWeight.url } : {};
    // Args: (update_uid=false, force, extraData, include_page_weight).
    // includePageWeight is passed as BOTH force and include_page_weight: when a
    // sample is still undelivered we must bypass the 300ms update throttle so
    // the exit hit is guaranteed to carry it (this is the sample's only
    // delivery path). With no pending sample, force stays false and this is a
    // normal best-effort time-on-page update, subject to the throttle.
    burst_update_hit(false, includePageWeight, extraData, includePageWeight);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden' || document.visibilityState === 'unloaded') {
      sendExitHit();
    } else if (document.visibilityState === 'visible') {
      resetExitHit();
    }
  };

  const processUrlChange = async () => {
    // Same-URL history updates (scroll restoration, UTM strippers doing a
    // same-path replaceState) are not navigations: resetting here would drop
    // this pageview's sample, which now has only the exit hit to ride on.
    if (burst.tracking.currentUrl === location.href) {
      return;
    }

    const previousUrl = burst.tracking.currentUrl;
    const currentUrl = location.href;
    burst.tracking.currentUrl = currentUrl;

    // Flush the finished page's snapshot to a final update hit attributed to
    // the old URL (page weight is queued server-side per page_url) before
    // eligibility resets. Awaited so it lands as an update while isInitialHit
    // is still false — flipping it first would turn this into a new track hit.
    // Skipped when the quiet-period snapshot has not run yet: there is no
    // sample to deliver, so a forced update would only cost a request.
    if (burst.pageWeight.hasUndelivered()) {
      // The flush stamps lastUpdateTimestamp; put the previous value back so
      // the 300ms throttle in burst_track_hit() does not swallow the new
      // page's create hit sent right below.
      const lastUpdateBeforeFlush = burst.tracking.lastUpdateTimestamp;
      await burst_update_hit(false, true, { url: previousUrl }, true);
      if (burst.tracking.currentUrl !== currentUrl) {
        return;
      }
      burst.tracking.lastUpdateTimestamp = lastUpdateBeforeFlush;
    }

    burst.pageWeight.reset();

    burst.tracking.isInitialHit = true;
    burst_track_hit();
  };

  // A single navigation often arrives as several history calls in one task: a
  // router pushes '/a' and immediately canonicalizes it to '/a/'. Each call
  // re-arms isInitialHit and sends its own create hit, and the 300ms throttle
  // in burst_track_hit() cannot stop the second because it is checked after an
  // await — both runs read the same pre-navigation timestamp — so the pageview
  // is counted twice. Coalescing to one run per task collapses the burst, and
  // the run then reads the URL the router settled on rather than the transient
  // one.
  let urlChangeQueued = false;
  const handleUrlChange = () => {
    // SPA tracking off: the URL changed but Burst keeps the same pageview, so
    // page-weight sampling for the original load must continue — do not reset.
    if (!burst.options.track_url_change) {
      return;
    }

    if (urlChangeQueued) {
      return;
    }

    urlChangeQueued = true;

    Promise.resolve().then(() => {
      urlChangeQueued = false;
      processUrlChange();
    });
  };

  const getExternalLinkUrl = (anchorElement) => {
		const href = anchorElement?.getAttribute?.("href");
		if (!href || href.startsWith("#")) return false;

		let targetUrl;
		try {
			targetUrl = new URL(anchorElement.href, window.location.href);
		} catch (error) {
			return false;
		}

		if (!["http:", "https:"].includes(targetUrl.protocol)) return false;
		if (targetUrl.origin === window.location.origin) return false;

		return targetUrl.href;
	};

	const shouldWaitForNavigation = (event, anchorElement) => {
		if (event.defaultPrevented) return false;
		if (event.button !== 0) return false;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return false;
		if (anchorElement.hasAttribute("download")) return false;

		const linkTarget = (
			anchorElement.getAttribute("target") || ""
		).toLowerCase();
		return !linkTarget || linkTarget === "_self";
	};

  // Handle external link clicks for Elementor loading animations/lazy loading
  const handleExternalLinkClick = (e) => {
    const target = e.target.closest("a[href]");
    if (!target) return;

    if (!burst.options.track_external_links) return;

		const externalLinkUrl = getExternalLinkUrl(target);
		if (!externalLinkUrl) return;

		const trackingPayload = {
			external_link_url: externalLinkUrl,
		};

		if (burst.options.beacon_enabled || !shouldWaitForNavigation(e, target)) {
			burst_update_hit(false, true, trackingPayload);
			return;
		}

    e.preventDefault();
		const fallbackTimeoutMs = 250;
		let didNavigate = false;
		const navigate = () => {
			if (didNavigate) return;
			didNavigate = true;
			window.location.assign(target.href);
		};

		setTimeout(navigate, fallbackTimeoutMs);
		burst_update_hit(false, true, trackingPayload).finally(navigate);

    return;
  };

  // Attach event handlers
  if (burst.options.enable_turbo_mode) {
    if (document.readyState !== 'loading') {
      burst_track_hit();
    } else {
      // Note: 'load' does not fire on document (only on window), so listen for
      // DOMContentLoaded, which fires as soon as parsing completes - the same
      // moment a deferred script would have run.
      document.addEventListener('DOMContentLoaded', burst_track_hit, { once: true });
    }
  } else {
    burst_track_hit();
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', sendExitHit);
  // A bfcache restore can be followed by a later, genuine exit — let that one
  // send again.
  window.addEventListener('pageshow', resetExitHit);
  if (document.readyState === 'complete') {
    burst.pageWeight.measureAfterQuietPeriod(() => {
      resetExitHit();
      if (document.visibilityState === 'hidden') {
        sendExitHit();
      }
    });
  } else {
    window.addEventListener('load', () => burst.pageWeight.measureAfterQuietPeriod(() => {
      resetExitHit();
      if (document.visibilityState === 'hidden') {
        sendExitHit();
      }
    }), { once: true });
  }
  document.addEventListener('click', handleExternalLinkClick, true); // Use capture phase to ensure we catch the event
  document.addEventListener('burst_fire_hit', () => burst_track_hit());
  document.addEventListener('burst_enable_cookies', () => {
    burst_enable_cookies();
    burst_update_hit(true);
  });

  const originalPushState = history.pushState;
  history.pushState = function () {
    originalPushState.apply(this, arguments);
    handleUrlChange();
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function () {
    originalReplaceState.apply(this, arguments);
    handleUrlChange();
  };

  window.addEventListener('popstate', handleUrlChange);
}

const burst_maybe_init = () => {
  if (burst_consent_state() !== 'yes') return;
  if (burst.tracking.initialized) {
    burst_track_hit();
    return;
  }
  // no double listeners
  burst.tracking.initialized = true;
  burst_init_events();
};

document.addEventListener('wp_consent_type_defined', burst_maybe_init);
document.addEventListener('wp_listen_for_consent_change', e => {
  const detail = e.detail;
  const isAllowed = (detail && (detail.statistics === 'allow' || detail['statistics'] === 'allow'))
    || (typeof wp_has_consent === 'function' && wp_has_consent('statistics'));
  if (isAllowed) {
    burst.cache.useCookies = null;
    burst_maybe_init();
  }
});

// events.js loads async next to this script and needs burst.options and the
// consent check: whichever of the two loads last initializes it.
burst.isLoaded = true;
if (burst.options.enable_custom_events) {
  burst.events?.init();
} else {
  // Disabled: events.js isn't loaded, so keep burst.event() calls from throwing.
  burst.event = () => {
    if (burst.options.debug) {
      console.warn('Burst: custom events are not enabled, the event was not recorded.');
    }
  };
}

burst_maybe_init();

window.burst_uid = burst_uid;
window.burst_use_cookies = burst_use_cookies;
window.burst_fingerprint = burst_fingerprint;
window.burst_update_hit = burst_update_hit;
