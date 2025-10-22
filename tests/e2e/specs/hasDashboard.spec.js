const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const { wpCli } = require('../helpers/wpCli');
const { dismissOnboarding } = require('../helpers/dismissOnboarding');
test('admin can access Burst Dashboard and see its contents', async ({ page }) => {
  // await checkIfTrackingTestIsDone();
  console.log("start dashboard test ")
  await login(page);
  await page.goto('/wp-admin/plugins.php');
  await page.screenshot({ path: 'screenshots/plugins.php.png' });

  let iteration = 0;
  async function loadDashboard(iteration) {
    if (iteration > 3) {
      return;
    }
    await wpCli('user meta update 1 locale en_US');
    // await wpCli('rewrite flush --hard');
    await page.goto('/wp-admin/admin.php?page=burst', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500); // allow DOM to settle
    await dismissOnboarding(page);
  }

  async function checkDashboardContent() {
    const element = page.locator('p.burst-today-list-item-text', { hasText: 'Total pageviews' });
    return await element.isVisible();
  }

  // Initial load and check
  await loadDashboard(iteration);

  if (!(await checkDashboardContent())) {
    console.log('Dashboard Element not found on first try — retrying login and dashboard load...', iteration);
    await loadDashboard(iteration+1);
  }
  await page.screenshot({ path: 'screenshots/dashboard.png' });

  // Final assertion (will fail the test if still not there)
  const TodayVisitorsTotal = page.locator('p.burst-today-list-item-text', { hasText: 'Total Pageviews' });
  await expect(TodayVisitorsTotal).toBeVisible();

});
