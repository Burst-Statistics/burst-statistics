/**
 * Page weight sampling: picks a share of pageviews, measures what the initial
 * load transferred once the network has gone quiet, and hands the sample to
 * the exit hit (or an SPA navigation flush) for delivery.
 *
 * Concatenated into full builds; omitted from essentials builds.
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
    await burst.pageIsRendered;
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
