// TimeMe.js should be loaded and running to track time as soon as it is loaded.
/**
 * @typedef {Object} BurstOptions
 * @property {boolean} enable_cookieless_tracking
 * @property {boolean} beacon_enabled
 * @property {boolean} do_not_track
 * @property {boolean} enable_turbo_mode
 * @property {boolean} track_url_change
 * @property {string} pageUrl
 * @property {boolean} cookieless
 */

/**
 * @typedef {Object} BurstState
 * @property {Object} tracking
 * @property {boolean} tracking.isInitialHit
 * @property {number} tracking.lastUpdateTimestamp
 * @property {string} tracking.beacon_url
 * @property {BurstOptions} options
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
 */

// Ensure tracking object exists
burst.tracking = burst.tracking || {
  isInitialHit: true,
  lastUpdateTimestamp: 0
};

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

// Import goals if applicable
if (burst.goals?.active?.some(goal => !goal.page_url || goal.page_url === '' || goal.page_url === burst.options.pageUrl)) {
  import(burst.goals.scriptUrl).then(goals => goals.default());
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
    if (c.indexOf(nameEQ) === 0) return Promise.resolve(c.substring(nameEQ.length));
  }
  return Promise.reject(false);
};
/**
 * Set a cookie
 * @param name
 * @param value
 */
const burst_set_cookie = (name, value) => {
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
  if (burst.cache.useCookies !== null) return burst.cache.useCookies;
  const result = navigator.cookieEnabled && !burst.options.cookieless;
  burst.cache.useCookies = result;
  return result;
};
/**
 * Enable or disable cookies
 * @returns {boolean}
 */
function burst_enable_cookies() {
  burst.options.cookieless = false;
  if (burst_use_cookies()) {
    burst_uid().then(uid => burst_set_cookie('burst_uid', uid));
  }
}
/**
 * Get or set the user identifier
 * @returns {Promise}
 */
const burst_uid = () => {
  if (burst.cache.uid !== null) return Promise.resolve(burst.cache.uid);
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
 * @returns {string}
 */
const burst_generate_uid = () => {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
};

const burst_fingerprint = () => {
  if (burst.cache.fingerprint !== null) return Promise.resolve(burst.cache.fingerprint);
  const tests = [
    'availableScreenResolution', 'canvas', 'colorDepth', 'cookies', 'cpuClass', 'deviceDpi', 'doNotTrack',
    'indexedDb', 'language', 'localStorage', 'pixelRatio', 'platform', 'plugins', 'processorCores',
    'screenResolution', 'sessionStorage', 'timezoneOffset', 'touchSupport', 'userAgent', 'webGl'
  ];
  return imprint.test(tests).then(fingerprint => {
    burst.cache.fingerprint = fingerprint;
    return fingerprint;
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
  const botPattern = /bot|spider|crawl|slurp|mediapartners|applebot|bing|duckduckgo|yandex|baidu|facebook|twitter/i;
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
  const result = '1' === navigator.doNotTrack || 
                 'yes' === navigator.doNotTrack ||
                 '1' === navigator.msDoNotTrack || 
                 '1' === window.doNotTrack || 
                 1 === navigator.globalPrivacyControl;    
  burst.cache.isDoNotTrack = result;
  return result;
};
/**
 * Make a XMLHttpRequest and return a promise
 * @param obj
 * @returns {Promise<unknown>}
 */
const burst_api_request = obj => {
  return new Promise(resolve => {
    if (burst.options.beacon_enabled) {
      const blob = new Blob([JSON.stringify(obj.data)], { type: 'application/json' });
      navigator.sendBeacon(burst.tracking.beacon_url, blob);
      resolve({ status: 200, data: 'ok' });
    } else {
      const token = Math.random().toString(36).substring(2, 9);
      wp.apiFetch({
        path: `/burst/v1/track/?token=${token}`,
        keepalive: true,
        method: 'POST',
        data: obj.data
      }).then(res => {
        const status = res.status || 200;
        resolve({ status, data: res.data || res });
      }).catch(() => {
        resolve({ status: 200, data: 'ok' });
      });
    }
  });
};
/**
 * Update the tracked hit
 * Mostly used for updating time spent on a page
 * Also used for updating the UID (from fingerprint to a cookie)
 */
async function burst_update_hit(update_uid = false, force = false) {
  await pageIsRendered;
  if (burst_is_user_agent() || burst_is_do_not_track()) return;
  if (burst.tracking.isInitialHit) {
    burst_track_hit();
    return;
  }

  if (!force && Date.now() - burst.tracking.lastUpdateTimestamp < 300) return;

  document.dispatchEvent(new CustomEvent('burst_before_update_hit', { detail: burst }));

  const [time, id] = await Promise.all([
    burst_get_time_on_page(),
    update_uid ? Promise.all([burst_uid(), burst_fingerprint()]) : (burst_use_cookies() ? burst_uid() : burst_fingerprint())
  ]);

  const data = {
    fingerprint: update_uid ? id[1] : (burst_use_cookies() ? false : id),
    uid: update_uid ? id[0] : (burst_use_cookies() ? id : false),
    url: location.href,
    time_on_page: time,
    completed_goals: burst.goals.completed
  };

  if (time > 0 || data.uid !== false) {
    await burst_api_request({ data: JSON.stringify(data) });
    burst.tracking.lastUpdateTimestamp = Date.now();
  }
}
/**
 * Track a hit
 *
 */
async function burst_track_hit() {
  await pageIsRendered;
  if (!burst.tracking.isInitialHit) {
    burst_update_hit();
    return;
  }
  if (burst_is_user_agent() || burst_is_do_not_track()) return;

  burst.tracking.isInitialHit = false;
  if (Date.now() - burst.tracking.lastUpdateTimestamp < 300) return;

  document.dispatchEvent(new CustomEvent('burst_before_track_hit', { detail: burst }));

  const [time, id] = await Promise.all([
    burst_get_time_on_page(),
    burst_use_cookies() ? burst_uid() : burst_fingerprint()
  ]);

  const data = {
    uid: burst_use_cookies() ? id : false,
    fingerprint: burst_use_cookies() ? false : id,
    url: location.href,
    referrer_url: document.referrer,
    user_agent: navigator.userAgent || 'unknown',
    device_resolution: `${window.screen.width * window.devicePixelRatio}x${window.screen.height * window.devicePixelRatio}`,
    time_on_page: time,
    completed_goals: burst.goals.completed
  };

  document.dispatchEvent(new CustomEvent('burst_track_hit', { detail: data }));
  await burst_api_request({ method: 'POST', data: JSON.stringify(data) });
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
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden' || document.visibilityState === 'unloaded') {
      burst_update_hit();
    }
  };

  const handleUrlChange = () => {
    if (!burst.options.track_url_change) return;
    burst.tracking.isInitialHit = true;
    burst_track_hit();
  };

  // Handle external link clicks for Elementor loading animations/lazy loading
  const handleExternalLinkClick = (e) => {
    const target = e.target.closest('a');
    if (!target) return;
    
    // Check if this element is part of a goal
    const isGoalElement = burst.goals?.active?.some(goal => {
      if (goal.type !== 'clicks') return false;
      const selector = goal.attribute === 'id' ? `#${goal.attribute_value}` : `.${goal.attribute_value}`;
      return target.closest(selector);
    });

    // Only update hit if it's not a goal element, as the goal will be tracked by the goal tracker
    if (!isGoalElement) {
      burst_update_hit(false, false);
    }
  };

  // Attach event handlers
  if (burst.options.enable_turbo_mode) {
    if (document.readyState !== 'loading') {
      burst_track_hit();
    } else {
      document.addEventListener('load', burst_track_hit);
    }
  } else {
    burst_track_hit();
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('pagehide', () => burst_update_hit());
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

document.addEventListener('wp_listen_for_consent_change', e => {
  const changed = e.detail;
  if (changed.statistics === 'allow') {
    burst_init_events();
  }
});

if (typeof wp_has_consent !== 'function') {
  burst_init_events();
} else if (wp_has_consent('statistics')) {
  burst_init_events();
}
