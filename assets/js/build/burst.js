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

// Cast goal IDs to integers in the burst object
if (burst.goals && burst.goals.active) {
  burst.goals.active = burst.goals.active.map(goal => ({
    ...goal,
    ID: parseInt(goal.ID, 10)
  }));
}
if (burst.goals && burst.goals.completed) {
  burst.goals.completed = burst.goals.completed.map(id => parseInt(id, 10));
}

// Set up a promise for when the page is activated,
// which is needed for prerendered pages.
const pageIsRendered = new Promise( ( resolve ) => {
  if ( document.prerendering ) {
    document.addEventListener( 'prerenderingchange', resolve, {once: true});
  } else {
    resolve();
  }
});

/**
 * Setup Goals if they exist for current page
 * @returns {Promise<void>}
 */
const burst_import_goals = async() => {
  const goals = await import( burst.goals.scriptUrl );
  goals.default();
};

// If has goals and a goal has this page_url, import
if ( burst.goals.active && burst.goals.active.length > 0 ) {
  for ( let i = 0; i < burst.goals.active.length; i++ ) {
    if ( '' !== burst.goals.active[i].page_url || burst.goals.active[i].page_url ===
        burst.options.pageUrl ) {
      burst_import_goals();
      break;
    }
  }
}

/**
 * Get a cookie by name
 * @param name
 * @returns {Promise}
 */
let burst_get_cookie = ( name ) => {
  return new Promise( ( resolve, reject ) => {
    name = name + '='; //Create the cookie name variable with cookie name
                       // concatenate with = sign
    let cArr = window.document.cookie.split( ';' ); //Create cookie array by
                                                  // split the cookie by ';'

    //Loop through the cookies and return the cookie value if we find the
    // cookie name
    for ( let i = 0; i < cArr.length; i++ ) {
      let c = cArr[i].trim();

      //If the name is the cookie string at position 0, we found the cookie and
      // return the cookie value
      if ( 0 === c.indexOf( name ) ) {
        resolve( c.substring( name.length, c.length ) );
      }
    }
    reject( false );
  });
};

/**
 * Set a cookie
 * @param name
 * @param value
 */
let burst_set_cookie = ( name, value ) => {
  let cookiePath = '/';
  let domain = '';
  let secure = ';secure';
  let date = new Date();
  let days = burst.options.cookie_retention_days;
  date.setTime( date.getTime() + ( days * 24 * 60 * 60 * 1000 ) );
  let expires = ';expires=' + date.toGMTString();

  if ( 'https:' !== window.location.protocol ) {
    secure = '';
  }

  //if we want to dynamically be able to change the domain, we can use this.
  if ( 0 < domain.length ) {
    domain = ';domain=' + domain;
  }
  document.cookie = name + '=' + value + ';SameSite=Strict' + secure + expires +
      domain + ';path=' + cookiePath;
};

/**
 * Should we use cookies for tracking
 * @returns {boolean}
 */
let burst_use_cookies = () => {
  // Return cached value if available
  if (burst.cache.useCookies !== null) {
    return burst.cache.useCookies;
  }

  const result = navigator.cookieEnabled && !burst.options.cookieless;
  // Cache the result
  burst.cache.useCookies = result;
  return result;
};

/**
 * Enable or disable cookies
 * @returns {boolean}
 */
function burst_enable_cookies() {
  burst.options.cookieless = false;
  if ( burst_use_cookies() ) {
    burst_uid().then( obj => {
      burst_set_cookie( 'burst_uid', obj.uid ); // set uid cookie
    });
  }
}

/**
 * Get or set the user identifier
 * @returns {Promise}
 */
const burst_uid = () => {
  return new Promise((resolve) => {
    // Return cached value if available
    if (burst.cache.uid !== null) {
      resolve(burst.cache.uid);
      return;
    }

    burst_get_cookie('burst_uid').then(cookie_uid => {
      // Cache the result
      burst.cache.uid = cookie_uid;
      resolve(cookie_uid);
    }).catch(() => {
      // if no cookie, generate a uid and set it
      let uid = burst_generate_uid();
      burst_set_cookie('burst_uid', uid);
      // Cache the result
      burst.cache.uid = uid;
      resolve(uid);
    });
  });
};

/**
 * Generate a random string
 * @returns {string}
 */
let burst_generate_uid = () => {
  let uid = '';
  for ( let i = 0; 32 > i; i++ ) {
    uid += Math.floor( Math.random() * 16 ).toString( 16 );
  }
  return uid;
};

/**
 * Generate a fingerprint
 * @returns {Promise}
 */
const burst_fingerprint = () => {
  return new Promise((resolve, reject) => {
    // Return cached value if available
    if (burst.cache.fingerprint !== null) {
      resolve(burst.cache.fingerprint);
      return;
    }

    let browserTests = [
      'availableScreenResolution',
      'canvas',
      'colorDepth',
      'cookies',
      'cpuClass',
      'deviceDpi',
      'doNotTrack',
      'indexedDb',
      'language',
      'localStorage',
      'pixelRatio',
      'platform',
      'plugins',
      'processorCores',
      'screenResolution',
      'sessionStorage',
      'timezoneOffset',
      'touchSupport',
      'userAgent',
      'webGl'
    ];

    imprint.test(browserTests).then(function(fingerprint) {
      // Cache the result
      burst.cache.fingerprint = fingerprint;
      resolve(fingerprint);
    }).catch((error) => {
      reject(error);
    });
  });
};

let burst_get_time_on_page = () => {
  return new Promise( ( resolve ) => {

    // wait for timeMe.js to be loaded
    if ( 'undefined' === typeof TimeMe ) {
      resolve( 0 ); // return 0 if timeMe.js is not (yet) loaded
    }

    let current_time_on_page = TimeMe.getTimeOnCurrentPageInMilliseconds();

    // reset time on page
    TimeMe.resetAllRecordedPageTimes();
    TimeMe.initialize({
      idleTimeoutInSeconds: 30 // seconds
    });
    resolve( current_time_on_page );

  });
};

/**
 * Check if this is a user agent
 * @returns {boolean}
 */
let burst_is_user_agent = () => {
  // Return cached value if available
  if (burst.cache.isUserAgent !== null) {
    return burst.cache.isUserAgent;
  }

  const botPattern = '(googlebot\/|bot|Googlebot-Mobile|Googlebot-Image|Google favicon|Mediapartners-Google|bingbot|slurp|java|wget|curl|Commons-HttpClient|Python-urllib|libwww|httpunit|nutch|phpcrawl|msnbot|jyxobot|FAST-WebCrawler|FAST Enterprise Crawler|biglotron|teoma|convera|seekbot|gigablast|exabot|ngbot|ia_archiver|GingerCrawler|webmon |httrack|webcrawler|grub.org|UsineNouvelleCrawler|antibot|netresearchserver|speedy|fluffy|bibnum.bnf|findlink|msrbot|panscient|yacybot|AISearchBot|IOI|ips-agent|tagoobot|MJ12bot|dotbot|woriobot|yanga|buzzbot|mlbot|yandexbot|purebot|Linguee Bot|Voyager|CyberPatrol|voilabot|baiduspider|citeseerxbot|spbot|twengabot|postrank|turnitinbot|scribdbot|page2rss|sitebot|linkdex|Adidxbot|blekkobot|ezooms|dotbot|Mail.RU_Bot|discobot|heritrix|findthatfile|europarchive.org|NerdByNature.Bot|sistrix crawler|ahrefsbot|Aboundex|domaincrawler|wbsearchbot|summify|ccbot|edisterbot|seznambot|ec2linkfinder|gslfbot|aihitbot|intelium_bot|facebookexternalhit|yeti|RetrevoPageAnalyzer|lb-spider|sogou|lssbot|careerbot|wotbox|wocbot|ichiro|DuckDuckBot|lssrocketcrawler|drupact|webcompanycrawler|acoonbot|openindexspider|gnam gnam spider|web-archive-net.com.bot|backlinkcrawler|coccoc|integromedb|content crawler spider|toplistbot|seokicks-robot|it2media-domain-crawler|ip-web-crawler.com|siteexplorer.info|elisabot|proximic|changedetection|blexbot|arabot|WeSEE:Search|niki-bot|CrystalSemanticsBot|rogerbot|360Spider|psbot|InterfaxScanBot|Lipperhey SEO Service|CC Metadata Scaper|g00g1e.net|GrapeshotCrawler|urlappendbot|brainobot|fr-crawler|binlar|SimpleCrawler|Livelapbot|Twitterbot|cXensebot|smtbot|bnf.fr_bot|A6-Indexer|ADmantX|Facebot|Twitterbot|OrangeBot|memorybot|AdvBot|MegaIndex|SemanticScholarBot|ltx71|nerdybot|xovibot|BUbiNG|Qwantify|archive.org_bot|Applebot|TweetmemeBot|crawler4j|findxbot|SemrushBot|yoozBot|lipperhey|y!j-asr|Domain Re-Animator Bot|AddThis)';
  const re = new RegExp(botPattern, 'i');
  const result = re.test(navigator.userAgent);
  // Cache the result
  burst.cache.isUserAgent = result;
  return result;
};

let burst_is_do_not_track = () => {
  // Return cached value if available
  if (burst.cache.isDoNotTrack !== null) {
    return burst.cache.isDoNotTrack;
  }

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
  
  // Cache the result
  burst.cache.isDoNotTrack = result;
  return result;
};

/**
 * Make a XMLHttpRequest and return a promise
 * @param obj
 * @returns {Promise<unknown>}
 */
let burst_api_request = obj => {
  return new Promise((resolve, reject) => {
    if (burst.options.beacon_enabled) {
      const headers = { type: 'application/json' };
      const blob = new Blob([JSON.stringify(obj.data)], headers);
      const success = window.navigator.sendBeacon(burst.beacon_url, blob);
      if (!success) {
        reject(new Error('Beacon request failed'));
      } else {
        resolve({ status: 200, data: 'ok' });
      }
    } else {
      const burst_token = 'token=' + Math.random().toString(36).replace(/[^a-z]+/g, '').substring(0, 7);
      wp.apiFetch({
        path: '/burst/v1/track/?' + burst_token,
        keepalive: true,
        method: 'POST',
        data: obj.data
      })
      .then(res => {
        if (!res) {
          throw new Error('No response received from server');
        }
        
        // Handle both REST API and admin-ajax responses
        const status = res.status || 200;
        const data = res.data || res;
        
        if (status === 202 || status === 200) {
          return { status, data };
        }
        
        throw new Error(`Unexpected status: ${status}`);
      })
      .then(response => {
        console.log('Burst API request completed successfully:', response);
        resolve(response);
      })
      .catch(error => {
        console.error('Burst API request failed:', error);
        // Don't reject the promise, just log the error and resolve with a default response
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

async function burst_update_hit( update_uid = false, force = false ) {
  await pageIsRendered;
  if ( burst_is_user_agent() ) {
    return;
  }
  if ( burst_is_do_not_track() ) {
    return;
  }
  if ( burst.tracking.isInitialHit ) {
    burst_track_hit();
    return;
  }

  // Prevent updates if less than 300ms has passed since last update
  if (!force && Date.now() - burst.tracking.lastUpdateTimestamp < 300) {
    return;
  }

  if ( !force ) {
    return;
  }
 

  let event = new CustomEvent( 'burst_before_update_hit', {detail: burst});
  document.dispatchEvent( event );

  let data = {
    'fingerprint': false,
    'uid': false,
    'url': location.href,
    'time_on_page': await burst_get_time_on_page(),
    'completed_goals': burst.goals.completed
  };

  if ( update_uid ) {

    // add both the uid and the fingerprint to the data
    // this way we can update the fingerprint with the uid
    // this is useful for consent plugins
    data.uid = await burst_uid();
    data.fingerprint = await burst_fingerprint();
  } else if ( burst_use_cookies() ) {
    data.uid = await burst_uid();
  } else {
    data.fingerprint = await burst_fingerprint();
  }
  if ( 0 < data.time_on_page || false !== data.uid ) {
    await burst_api_request({
      data: JSON.stringify( data )
    }).catch( error => {
      // @todo handle error and send notice to the user. If multiple errors send to backend
    });
    burst.tracking.lastUpdateTimestamp = Date.now(); // Update the timestamp after successful request
  }
}

/**
 * Track a hit
 *
 */
async function burst_track_hit() {
  await pageIsRendered;

  if ( ! burst.tracking.isInitialHit ) { // if the initial track hit has already been fired, we just update the hit
    burst_update_hit();
    return;
  }

  if ( burst_is_user_agent() ) {
    return;
  }
  if ( burst_is_do_not_track() ) {
    return;
  }

  burst.tracking.isInitialHit = false;

  // Prevent updates if less than 300ms has passed since last update
  const now = Date.now();
  if (now - burst.tracking.lastUpdateTimestamp < 300) {
    return;
  }

  let event = new CustomEvent( 'burst_before_track_hit', {detail: burst});
  document.dispatchEvent( event );

  // add browser data to the hit
  let data = {
    'uid': false,
    'fingerprint': false,
    'url': location.href,
    'referrer_url': document.referrer,
    'user_agent': navigator.userAgent || 'unknown',
    'device_resolution': window.screen.width * window.devicePixelRatio + 'x' +
        window.screen.height * window.devicePixelRatio,
    'time_on_page': await burst_get_time_on_page(),
    'completed_goals': burst.goals.completed
  };

  if ( burst_use_cookies() ) {
    data.uid = await burst_uid();
  } else {
    data.fingerprint = await burst_fingerprint();
  }

  event = new CustomEvent( 'burst_track_hit', {detail: data});
  document.dispatchEvent( event );

  let request_params = {
    method: 'POST',
    data: JSON.stringify( data )
  };
  await burst_api_request( request_params ).catch( error => {
    // Error handling if needed
  });

  burst.tracking.lastUpdateTimestamp = now;
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

  // Initial track hit
  let turbo_mode = burst.options.enable_turbo_mode;
  if ( turbo_mode ) { // if turbo mode is enabled, we track the hit after the whole page has loaded
    if ( 'loading' !== document.readyState ) {
      burst_track_hit();
    } else {
      document.addEventListener( 'load', burst_track_hit );
    }
  } else { // if default, we track the hit immediately
    burst_track_hit();
  }


  // Don't debounce, because when navigating away we need to track this hit immediately
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden' || document.visibilityState === 'unloaded') {
      burst_update_hit();
    }
  };

  document.addEventListener( 'visibilitychange', handleVisibilityChange );

  // This is a fallback for Safari
  document.addEventListener( 'pagehide', burst_update_hit );

  // Add event so other plugins can add their own events
  document.addEventListener( 'burst_fire_hit', function() {
    burst_track_hit();
  });

  //for Single Page Applications, we listen to the url changes as well.
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  const handleUrlChange = () => {
    if ( ! burst.options.track_url_change ) {
      return;
    }
    burst.tracking.isInitialHit = true;
    burst_track_hit();
  };

  history.pushState = function( state, title, url ) {
    originalPushState.apply( history, arguments );
    handleUrlChange();
  };

  history.replaceState = function( state, title, url ) {
    originalReplaceState.apply( history, arguments );
    handleUrlChange();
  };

  window.addEventListener( 'popstate', handleUrlChange );

  // add event so other plugins can add their own events
  document.addEventListener( 'burst_enable_cookies', function() {
    burst_enable_cookies();
    burst_update_hit( true );
  });
}

// Listen for consent changes for wp consent api
document.addEventListener( 'wp_listen_for_consent_change', function( e ) {
  var changedConsentCategory = e.detail;
  for ( var key in changedConsentCategory ) {
    if ( changedConsentCategory.hasOwnProperty( key ) ) {
      if ( 'statistics' === key && 'allow' === changedConsentCategory[key]) {
        burst_init_events();
      }
    }
  }
});

if ( 'function' !== typeof wp_has_consent ) {

  // no wp consent api available, just track the hit
  burst_init_events();
} else {

  // wp consent api is available, check if there is consent for statistics
  if ( wp_has_consent( 'statistics' ) ) {
    burst_init_events();
  }
}
