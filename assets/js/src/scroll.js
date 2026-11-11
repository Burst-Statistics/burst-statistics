/**
 * Scroll depth and zone dwell time tracking.
 * Concatenated into full builds; omitted from essentials builds.
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

burst.getScrollData = function () {
  burst_update_scroll_metrics();
  return {
    max_scroll: burstMaxScroll,
    dwell_zones: JSON.stringify(burstDwellTimePerZone),
  };
};

/**
 * Forget everything measured so far.
 *
 * Called when tracking starts on a page the visitor had opted out on: the
 * depth they reached and the time they dwelled while opted out may not end up
 * in the hit that follows. Moving the timestamp up is what drops the chunk
 * measured since the last update, which is counted from it.
 */
burst.resetScrollData = function () {
  burstMaxScroll = 0;
  burstLastScrollTimestamp = Date.now();
  for (const zone in burstDwellTimePerZone) {
    burstDwellTimePerZone[zone] = 0;
  }
};
