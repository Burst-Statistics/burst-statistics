const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { dismissOnboarding } = require('../helpers/dismissOnboarding');
const { debugHasError } = require('../helpers/debugHasError');

// The Engagement tab is a free feature. Loading it runs the reading engagement
// query, which selects avg_max_scroll: the metric must be allowed and resolve
// to SQL in free as well as in Pro, and the request must not leave errors in
// debug.log.
//
// The CI site runs on plain permalinks, so the REST request is sent as
// index.php?rest_route=%2Fburst%2Fv1%2Fdata%2Freading_engagement&...: apiFetch
// percent-encodes the rest_route value. Match on the decoded URL so the check
// works for pretty and plain permalinks alike.
const isReadingEngagementResponse = (response) =>
    decodeURIComponent(response.url()).includes('burst/v1/data/reading_engagement');

test('admin can open the Engagement tab and the reading engagement block loads', async ({ page }) => {
    await login(page);

    const engagementRequest = page.waitForResponse(isReadingEngagementResponse, { timeout: 30000 });
    await page.goto('/wp-admin/admin.php?page=burst#/engagement', { waitUntil: 'domcontentloaded' });
    await dismissOnboarding(page);

    const block = page.locator('[data-tour="engagement-block"]');
    await expect(block).toBeVisible({ timeout: 15000 });

    const response = await engagementRequest;
    expect(response.ok()).toBe(true);

    const hasErrors = await debugHasError();
    expect(hasErrors).toBe(false);
});
