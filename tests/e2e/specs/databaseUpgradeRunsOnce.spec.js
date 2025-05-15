const { test, expect } = require('@playwright/test');
const {login} = require("../helpers/auth");
const {getDebugLog} = require("../helpers/getDebugLog");
const {wpCli} = require("../helpers/wpCli");
test('Check that the database upgrade only runs once', async ({ page }) => {
    await login(page);
    await wpCli('config set BURST_CI_ACTIVE true --type=constant');

    //visit one Burst page
    await page.goto('/wp-admin/admin.php?page=burst', { waitUntil: 'domcontentloaded' });

    const debugLogContents = await getDebugLog();
    //verify that the debugLogContents contains exactly one occurrence of the string "Installing database tables for Burst Statistics"
    const installCount = (debugLogContents.match(/Upgrading database tables for Burst Statistics/g) || []).length;
    expect(installCount).toBe(1);
});