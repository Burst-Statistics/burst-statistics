/**
 * Active time on page for the tracker. Its one method, take(), returns the
 * time counted since the previous call. Gulp prepends this file to both
 * tracker builds, so it ships inside burst.min.js and adds no request.
 *
 * The rules are those of the TimeMe library it replaced
 * (tests/e2e/specs/timeOnPageParity.spec.js compares the two):
 * - hiding the tab or blurring the window stops the count; showing or
 *   focusing it again restarts it and resets the idle countdown;
 * - 30 seconds without mousemove, keyup, touchstart or scroll stops the
 *   count; activity after that restarts it, activity before only resets the
 *   countdown.
 * The idle cutoff is applied when the time is read, so no interval runs, and
 * the listeners are registered once.
 */
const burstActiveTimer = (() => {
  const idleTimeoutMs = 30000;
  let total = 0;
  let isRunning = false;
  // Start of the stretch not yet added to the total.
  let start = 0;
  let lastActivity = Date.now();

  const isIdle = now => now - lastActivity >= idleTimeoutMs;

  /**
   * Add the running stretch up to now to the total, capped at the idle cutoff.
   * @param {number} now
   */
  const flush = now => {
    if (!isRunning) return;
    total += Math.max(0, Math.min(now, lastActivity + idleTimeoutMs) - start);
    start = now;
  };

  const leave = () => {
    flush(Date.now());
    isRunning = false;
  };

  // A running but idle timer has stopped counting, so it restarts as well.
  const resume = () => {
    const now = Date.now();
    flush(now);
    if (isRunning && !isIdle(now)) return;
    isRunning = true;
    start = now;
    lastActivity = now;
  };

  // Unlike TimeMe, activity never restarts the count in a hidden tab: input
  // cannot reach one, but a script scrolling it can.
  const activity = () => {
    const now = Date.now();
    if (isIdle(now) && document.visibilityState === 'visible') {
      resume();
      return;
    }
    flush(now);
    lastActivity = now;
  };

  // Count from when the HTML arrived, as TimeMe did from the <head>: in turbo
  // mode, or when an optimizer delays scripts, this one runs well after that.
  // Where the browser records visibility changes (Chromium), hidden stretches
  // before this script ran are left out too. Unlike TimeMe, a page opened in
  // the background or prerendered starts once it is shown.
  const responseStart = performance.getEntriesByType?.('navigation')[0]?.responseStart;
  let visibleSince = responseStart || null;
  if (responseStart) {
    for (const entry of performance.getEntriesByType('visibility-state')) {
      if (entry.name === 'visible') {
        // Plain assignment: logical assignment (??=) is ES2021, above the
        // tracker's ES2020 baseline, and older browsers would reject the file.
        if (visibleSince === null) visibleSince = Math.max(entry.startTime, responseStart);
      } else if (visibleSince !== null) {
        // Activity in this stretch cannot be seen either, so it counts at most
        // up to the idle cutoff, as below for the stretch that is still running.
        total += Math.min(idleTimeoutMs, Math.max(0, Math.round(entry.startTime - visibleSince)));
        visibleSince = null;
      }
    }
  }
  if (document.visibilityState === 'visible') {
    isRunning = true;
    // Never later than now: the wall clock and the performance clock can drift apart.
    start = visibleSince === null ? lastActivity : Math.min(lastActivity, Math.round(performance.timeOrigin + visibleSince));
    // The idle countdown starts there too, as TimeMe's did. Activity before this
    // script ran cannot be seen, so a late script counts at most 30 seconds of
    // that stretch until the visitor is active again.
    lastActivity = start;
  }

  ['mousemove', 'keyup', 'touchstart'].forEach(type => document.addEventListener(type, activity, { passive: true }));
  window.addEventListener('scroll', activity, { passive: true });
  window.addEventListener('focus', resume);
  window.addEventListener('blur', leave);
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'visible' ? resume() : leave()));

  return {
    /**
     * Return the active time counted since the previous call, and reset it.
     * @returns {number} Milliseconds.
     */
    take() {
      flush(Date.now());
      const time = total;
      total = 0;
      return time;
    },
  };
})();
