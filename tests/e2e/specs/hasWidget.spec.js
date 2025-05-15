const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');

test('admin can access WordPress dashboard and see Burst Widget', async ({ page }) => {
    let iteration = 0;
    await login(page);

    const maxTries = 3;
    // await checkIfTrackingTestIsDone();
    console.log("start widget test");
    async function loadDashboard(iteration) {
        if (iteration > maxTries) {
            return;
        }
        await page.goto('/wp-admin/index.php', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500); // allow DOM to settle
    }

    async function checkDashboardContent() {
        const element = page.locator('p.burst-today-list-item-text', { hasText: 'Total Pageviews' });
        return await element.isVisible();
    }

    await loadDashboard(iteration);

    if (!(await checkDashboardContent())) {
        console.log('Widget Element not found on first try — retrying login and dashboard load...', iteration);
        await loadDashboard(++iteration);
    }
    //wait 500ms
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/burst-widget.png' });

    // Final assertion (will fail if not found after retries)
    const TodayVisitorsTotal = page.locator('p.burst-today-list-item-text', { hasText: 'Total Pageviews' });
    await expect(TodayVisitorsTotal).toBeVisible();

});