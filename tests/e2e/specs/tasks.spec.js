const { test, expect } = require('@playwright/test');
const {login} = require("../helpers/auth");
const {debugHasError} = require("../helpers/debugHasError");
const {wpCli} = require("../helpers/wpCli");

test('tasks should be executed without errors, all cron jobs should run without errors.', async ({ page }) => {
    await login(page);

    //e.g. all tasks run on daily
    await wpCli('cron event run burst_daily');
    await wpCli('cron event run burst_every_hour');
    await wpCli('cron event run burst_weekly');

    await new Promise(resolve => setTimeout(resolve, 500));

    const hasErrors = await debugHasError();
    expect(hasErrors).toBe(false);
});