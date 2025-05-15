const { test, expect } = require('@playwright/test');
const {login} = require("../helpers/auth");
const {wpCli} = require("../helpers/wpCli");
const {debugHasError} = require("../helpers/debugHasError");
test('install free and upgrade to premium', async ({ page }) => {
    await login(page);
    console.log("running upgrade test");
    //deactivate the premium plugin
    await wpCli('plugin deactivate burst-pro');
    await wpCli('plugin install burst-statistics --activate');
    await page.goto('wp-admin/plugins.php');
    //now activate premium again.
    await wpCli('plugin activate burst-pro');
    await page.goto('wp-admin/plugins.php');

    //check if we have any errors in the debug.log
    const hasErrors = await debugHasError();
    expect(hasErrors).toBe(false);
});