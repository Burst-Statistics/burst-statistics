const { test, expect } = require('@playwright/test');
const {login} = require("../helpers/auth");
const {debugHasError} = require("../helpers/debugHasError");
const {wpCli} = require("../helpers/wpCli");

test('wpcli command should work', async ({ page }) => {
    await login(page);

    let response = await wpCli('burst save --enable_turbo_mode=1');
    expect(response).toContain(' Option enable_turbo_mode updated');

    const hasErrors = await debugHasError();
    expect(hasErrors).toBe(false);
});