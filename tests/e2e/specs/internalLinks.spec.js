const { test, expect } = require('@playwright/test');
const {login} = require("../helpers/auth");
const {debugHasError} = require("../helpers/debugHasError");
const {wpCli} = require("../helpers/wpCli");

test('internal links should point to valid page.', async ({ page }) => {
    await login(page);

    const output = await wpCli('burst get_internal_links', { encoding: 'utf8' });
    const rawUrls = JSON.parse(output);
   console.log(rawUrls);
   //first, test a not existing page in Burst
    await page.goto('wp-admin/admin.php?page=burst#not-existing-page', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.burst-settings-group-block')).not.toBeVisible();

    for (const url of rawUrls) {
        let internalLink = 'wp-admin/admin.php?page=burst'+url;
        console.log("validate link:"+internalLink);
        await page.goto(internalLink, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'screenshots/'+url+'.png' });

        //if url contains 'settings'
        if (url.includes('settings')) {
            const blocks = page.locator('.burst-settings-group-block');
            const count = await blocks.count();
            let oneVisible = false;
            for (let i = 0; i < count; i++) {
                if (await blocks.nth(i).isVisible()) {
                    oneVisible = true;
                    break;
                }
            }

            expect(oneVisible).toBe(true);
        } else if (url.includes('statistics')) {
            await expect(page.getByText('Compare')).toBeVisible();
        }
        //at any rate, we don't want to see the html <p>Not Found</p>
        await expect(page.locator('p:has-text("Not Found")')).not.toBeVisible();

        //switch back to other page
        await page.goto('wp-admin/plugins.php');
    }

});