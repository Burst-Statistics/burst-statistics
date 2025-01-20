// TimeMe.js should be loaded and running to track time as soon as it is loaded.
let burst_track_hit_running = false;
let burst_initial_track_hit = false;
let burst_update_hit_count = 0;
let burst_cookieless_option = burst.options.enable_cookieless_tracking; // User
                                                                        // cookieless
                                                                        // option
// add option to window so a consent plugin can change this value
window.burst_enable_cookieless_tracking = burst.options.enable_cookieless_tracking; // Consent plugin cookieless option
let burst_page_url = window.location.href;
let burst_completed_goals = [];
let burst_goals_script_url = burst.goals_script_url ?
    burst.goals_script_url :
    './burst-goals.js';

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
  const goals = await import( burst_goals_script_url );
  goals.default();
};

// If has goals and a goal has this page_url, import
if ( 0 < burst.goals.length ) {
  for ( let i = 0; i < burst.goals.length; i++ ) {
    if ( '' !== burst.goals[i].page_url || burst.goals[i].page_url ===
        burst_page_url ) {
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
  let days = burst.cookie_retention_days;
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
  if ( ! navigator.cookieEnabled ) {
    return false;
  } // cookies blocked by browser
  if ( burst_cookieless_option && window.burst_enable_cookieless_tracking ) {
    return false;
  } // cookieless is enabled by user or consent plugin
  return true; // cookies are enabled
};

/**
 * Enable or disable cookies
 * @returns {boolean}
 */
function burst_enable_cookies() {
  window.burst_enable_cookieless_tracking = 0;
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
  return new Promise( ( resolve ) => {
    burst_get_cookie( 'burst_uid' ).then( cookie_uid => {
      resolve( cookie_uid );
    }).catch( () => {

      // if no cookie, generate a uid and set it
      let uid = burst_generate_uid();
      burst_set_cookie( 'burst_uid', uid );
      resolve( uid );
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
  return new Promise( ( resolve, reject ) => {
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

    imprint.test( browserTests ).then( function( fingerprint ) {
      resolve( fingerprint );
    }).catch( ( error ) => {
      reject( error );
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
  const botPattern = '(googlebot\/|bot|Googlebot-Mobile|Googlebot-Image|Google favicon|Mediapartners-Google|bingbot|slurp|java|wget|curl|Commons-HttpClient|Python-urllib|libwww|httpunit|nutch|phpcrawl|msnbot|jyxobot|FAST-WebCrawler|FAST Enterprise Crawler|biglotron|teoma|convera|seekbot|gigablast|exabot|ngbot|ia_archiver|GingerCrawler|webmon |httrack|webcrawler|grub.org|UsineNouvelleCrawler|antibot|netresearchserver|speedy|fluffy|bibnum.bnf|findlink|msrbot|panscient|yacybot|AISearchBot|IOI|ips-agent|tagoobot|MJ12bot|dotbot|woriobot|yanga|buzzbot|mlbot|yandexbot|purebot|Linguee Bot|Voyager|CyberPatrol|voilabot|baiduspider|citeseerxbot|spbot|twengabot|postrank|turnitinbot|scribdbot|page2rss|sitebot|linkdex|Adidxbot|blekkobot|ezooms|dotbot|Mail.RU_Bot|discobot|heritrix|findthatfile|europarchive.org|NerdByNature.Bot|sistrix crawler|ahrefsbot|Aboundex|domaincrawler|wbsearchbot|summify|ccbot|edisterbot|seznambot|ec2linkfinder|gslfbot|aihitbot|intelium_bot|facebookexternalhit|yeti|RetrevoPageAnalyzer|lb-spider|sogou|lssbot|careerbot|wotbox|wocbot|ichiro|DuckDuckBot|lssrocketcrawler|drupact|webcompanycrawler|acoonbot|openindexspider|gnam gnam spider|web-archive-net.com.bot|backlinkcrawler|coccoc|integromedb|content crawler spider|toplistbot|seokicks-robot|it2media-domain-crawler|ip-web-crawler.com|siteexplorer.info|elisabot|proximic|changedetection|blexbot|arabot|WeSEE:Search|niki-bot|CrystalSemanticsBot|rogerbot|360Spider|psbot|InterfaxScanBot|Lipperhey SEO Service|CC Metadata Scaper|g00g1e.net|GrapeshotCrawler|urlappendbot|brainobot|fr-crawler|binlar|SimpleCrawler|Livelapbot|Twitterbot|cXensebot|smtbot|bnf.fr_bot|A6-Indexer|ADmantX|Facebot|Twitterbot|OrangeBot|memorybot|AdvBot|MegaIndex|SemanticScholarBot|ltx71|nerdybot|xovibot|BUbiNG|Qwantify|archive.org_bot|Applebot|TweetmemeBot|crawler4j|findxbot|SemrushBot|yoozBot|lipperhey|y!j-asr|Domain Re-Animator Bot|AddThis)';
  let re = new RegExp( botPattern, 'i' );
  let userAgent = navigator.userAgent;

  return re.test( userAgent );
};

let burst_is_do_not_track = () => {
  if ( burst.options.do_not_track ) {

    // check for doNotTrack and globalPrivacyControl headers
    return '1' === navigator.doNotTrack || 'yes' === navigator.doNotTrack ||
        '1' === navigator.msDoNotTrack || '1' === window.doNotTrack || 1 ===
        navigator.globalPrivacyControl;
  }
  return false;
};

/**
 * Make a XMLHttpRequest and return a promise
 * @param obj
 * @returns {Promise<unknown>}
 */
let burst_api_request = obj => {

  // generate a new token every request
  return new Promise( ( resolve, reject ) => {

    // if browser supports sendBeacon use it
    if ( burst.options.beacon_enabled ) {
      const headers = {
        type: 'application/json'
      };
      const blob = new Blob([ JSON.stringify( obj.data ) ], headers );
      window.navigator.sendBeacon( burst.beacon_url, blob );
      resolve( 'ok' );
    } else {
      let burst_token = 'token=' +
          Math.random().toString( 36 ).replace( /[^a-z]+/g, '' ).substring( 0, 7 );

      // if browser supports fetch keepalive, it will use it. Otherwise, it
      // will use a normal XMLHttpRequest
      wp.apiFetch({
        path: '/burst/v1/track/?' + burst_token,
        keepalive: true,
        method: 'POST',
        data: obj.data
      }).then(
          ( res ) => {
            if ( 202 === res.status ) {
              res.json().then(
                  ( data ) => console.warn( data )
              );
            }
          },
          ( error ) => console.log( error )
      );
    }
  });
};

/**
 * Update the tracked hit
 * Mostly used for updating time spent on a page
 * Also used for updating the UID (from fingerprint to a cookie)
 */

async function burst_update_hit( update_uid = false ) {
  await pageIsRendered;
  if ( burst_is_user_agent() ) {
    return;
  }
  if ( burst_is_do_not_track() ) {
    return;
  }
  if ( ! burst_initial_track_hit ) {
    return;
  }

  if ( burst_update_hit_count > 5 ) {
    return;
  }
  burst_update_hit_count++;

  let event = new CustomEvent( 'burst_before_update_hit', {detail: burst});
  document.dispatchEvent( event );

  let data = {
    'fingerprint': false,
    'uid': false,
    'url': location.href,
    'time_on_page': await burst_get_time_on_page(),
    'completed_goals': burst_completed_goals
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

    }); // @todo handle error and send notice to the user. If multiple errors
        // send to backend
  }
}

/**
 * Track a hit
 *
 */
async function burst_track_hit() {
  await pageIsRendered;

  if ( burst_initial_track_hit ) { // if the initial track hit has already been fired, we just update the hit
    burst_update_hit();
    return;
  }
  burst_initial_track_hit = true;

  if ( burst_is_user_agent() ) {
    return;
  }
  if ( burst_is_do_not_track() ) {
    return;
  }
  if ( burst_track_hit_running ) {
    return;
  }

  burst_track_hit_running = true;
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
    'completed_goals': burst_completed_goals
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
  burst_api_request( request_params ).catch( error => {
    burst_track_hit_running = false;
  });

  burst_track_hit_running = false;
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

  // Update hit on visibility change (Navigating away from the page)
  // Supported by most browsers
  document.addEventListener( 'visibilitychange', function() {
    if (
        'hidden' === document.visibilityState ||
        'unloaded' === document.visibilityState

    ) {
      burst_update_hit();
    }
  });

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
    burst_initial_track_hit = false;
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
