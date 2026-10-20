const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { dismissOnboarding } = require('../helpers/dismissOnboarding');

// Free shows Pro pages such as Sales as an upsell on top of mock data; leaving
// such a page must not make the app request Pro-only endpoints, which free does
// not register.

/**
 * Whether a url is a Burst REST request, with pretty or plain permalinks.
 *
 * @param {string} url The request url.
 * @return {boolean} True for burst/v1 REST requests.
 */
function isBurstRestUrl(url) {
    return decodeURIComponent(url).includes('/burst/v1/');
}

/**
 * Track Burst REST requests: the ones in flight and the ones that failed.
 *
 * Side effect: adds request and response listeners to the page.
 *
 * @param {import('@playwright/test').Page} page The page.
 * @return {{ inFlight: Set<import('@playwright/test').Request>, failed: string[] }} Live tracking state.
 */
function trackBurstRequests(page) {
    const inFlight = new Set();
    const failed = [];

    page.on('request', (request) => {
        if (isBurstRestUrl(request.url())) {
            inFlight.add(request);
        }
    });
    page.on('requestfinished', (request) => inFlight.delete(request));
    page.on('requestfailed', (request) => inFlight.delete(request));
    page.on('response', (response) => {
        if (isBurstRestUrl(response.url()) && 400 <= response.status()) {
            failed.push(`${response.status()} ${decodeURIComponent(response.url())} (on ${page.url()})`);
        }
    });

    return { inFlight, failed };
}

/**
 * Wait until no Burst REST request has been in flight for a while.
 *
 * @param {import('@playwright/test').Page}                 page     The page.
 * @param {Set<import('@playwright/test').Request>}         inFlight Requests in flight.
 * @return {Promise<void>}
 */
async function waitForBurstRequestsToSettle(page, inFlight) {
    const quietMs = 1000;
    const deadline = Date.now() + 30000;
    let quietSince = Date.now();

    while (Date.now() < deadline) {
        if (0 < inFlight.size) {
            quietSince = Date.now();
        } else if (Date.now() - quietSince >= quietMs) {
            return;
        }
        await page.waitForTimeout(100);
    }
}

test('leaving any free page does not request endpoints free does not register', async ({ page }) => {
    const { inFlight, failed } = trackBurstRequests(page);

    await login(page);
    await page.goto('/wp-admin/admin.php?page=burst#/', { waitUntil: 'domcontentloaded' });
    await dismissOnboarding(page);

    expect(await page.evaluate(() => Boolean(window.burst_settings.is_pro)), 'this spec runs against the free plugin').toBe(false);

    const menuIds = await page.evaluate(() => window.burst_settings.menu.map((item) => item.id));

    // Sales is the upsell page with a mock-data background; without it the spec covers nothing.
    expect(menuIds).toContain('sales');

    await waitForBurstRequestsToSettle(page, inFlight);

    for (const menuId of menuIds) {
        await page.evaluate((id) => {
            window.location.hash = `#/${id}`;
        }, menuId);
        await waitForBurstRequestsToSettle(page, inFlight);

        // Back to the dashboard: this unmounts the page, which is where an upsell's mock data is switched off.
        await page.evaluate(() => {
            window.location.hash = '#/';
        });
        await waitForBurstRequestsToSettle(page, inFlight);
    }

    expect(failed).toEqual([]);
});
