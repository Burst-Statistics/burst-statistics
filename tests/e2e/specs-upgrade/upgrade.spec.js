const { test, expect } = require('@playwright/test');
const {login} = require("../helpers/auth");
const {wpCli} = require("../helpers/wpCli");
const {debugHasError} = require("../helpers/debugHasError");
test('install old free and upgrade to current version of free', async ({ page }) => {
    await login(page);
    console.log("running upgrade test");

    await page.goto('wp-admin/plugins.php');

    //deactivate the old one
    await wpCli('plugin deactivate burst-statistics');
    //now activate the new again.

    await wpCli('plugin activate burst-statistics-new');
    await page.goto('wp-admin/plugins.php');
    await page.screenshot({ path: 'screenshots/burst-upgrade-from-old-free-pluginspage.png' });

    await page.goto('/wp-admin/admin.php?page=burst', { waitUntil: 'domcontentloaded' });

    //create a screenshot
    await page.screenshot({ path: 'screenshots/burst-upgrade-from-old-free.png' });
    //check if we have any errors in the debug.log
    const hasErrors = await debugHasError();
    expect(hasErrors).toBe(false);
});