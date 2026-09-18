const { test, expect } = require('@playwright/test');
const {login} = require("../helpers/auth");
const {debugHasError} = require("../helpers/debugHasError");

// Playwright runs spec files in alphabetical order (one worker in CI). The
// "zz-" prefix keeps this check last, so the log covers everything the other
// specs in this directory touched instead of only the login.
test('debug.log should not contain errors', async ({ page }) => {
    await login(page);
    const hasErrors = await debugHasError();
    expect(hasErrors).toBe(false);
});
