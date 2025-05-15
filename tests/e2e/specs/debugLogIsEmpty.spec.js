const { test, expect } = require('@playwright/test');
const {login} = require("../helpers/auth");
const {debugHasError} = require("../helpers/debugHasError");

test('debug.log should not contain errors', async ({ page }) => {
    await login(page);
    const hasErrors = await debugHasError();
    expect(hasErrors).toBe(false);
});