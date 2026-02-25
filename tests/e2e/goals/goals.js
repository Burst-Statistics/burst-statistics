import {login} from "../helpers/auth";
import {createTestPages} from "../helpers/createTestPages";
import {wpCli} from "../helpers/wpCli";
import {setPermalinkStructure} from "../helpers/setPermalinkStructure";
import {getDebugLog} from "../helpers/getDebugLog";
import {getPageObjectBySlug} from "../helpers/getPageObjectBySlug";
import {updateBurstOption} from "../helpers/updateBurstOption";
import {assertTrackingData} from "../helpers/assertTrackingData";
import {getTableData} from "../helpers/getTableData";
import {activateLicense} from "../helpers/activateLicense";
import {createGoal} from "./createGoal";
import {debugHasError} from "../helpers/debugHasError";
const { test, expect } = require('@playwright/test');

async function runGoalTest(typeKey, config){
        test( `Test ${typeKey} goal`, async ({ page }) => {
            console.log("login to WP");
            await login(page);
            //ensure english locale
            await wpCli('user meta update 1 locale en_US');
            //clear wp_burst_statistics table
            await wpCli('db query "TRUNCATE TABLE wp_burst_statistics"');
            //clear wp_burst_goal_statistics table
            await wpCli('db query "TRUNCATE TABLE wp_burst_goal_statistics"');

            await activateLicense(page);
            console.log("set tracking options");
            await updateBurstOption({
                enable_cookieless_tracking: config.cookieless,
                enable_do_not_track: 0,
                enable_turbo_mode: config.turboMode,
                track_url_change: 0,
                user_role_blocklist:0,
            });
            let trackingStatus = config.beaconEnabled ? 'beacon' : 'rest';
            await wpCli(`option update burst_tracking_status ${trackingStatus}`);
            console.log("set permalinks", config.permalink);
            await setPermalinkStructure(config.permalink, page );

            console.log("create test pages");
            await createTestPages();
            const hookName = typeKey === 'hook' ? 'wpcf7_submit' : '';
            let goalId = await createGoal(
                typeKey,
                'test-tracking-page',
                'class', //class or id
                'burst-test-goal',
                hookName
             );

            let page_1 = await getPageObjectBySlug('test-tracking-page', config, typeKey);

            await page.goto(page_1.slug, { waitUntil: 'domcontentloaded' });
            await page.screenshot({ path: `screenshots/test-goals-page-${typeKey}.png` });
            const cookieless = await page.evaluate(() => {
                return typeof burst !== 'undefined' ? burst.options.cookieless : null;
            });
            if (typeKey==='clicks') {
                await page.click('.burst-test-goal');
            }
            if ( typeKey==='hook') {
                console.log("fill and submit the contact form");
                //submit the contact form
                await page.fill('input[name="your-name"]', 'Test User');
                await page.fill('input[name="your-email"]', 'test@user.com');
                await page.fill('input[name="your-subject"]', 'about goals');
                await page.fill('textarea[name="your-message"]', 'This is a test message.');
                await page.screenshot( { path: 'screenshots/contact-form7-filled.png' } );
                await page.locator('form.wpcf7-form input.wpcf7-submit').click();
                await page.screenshot( { path: 'screenshots/contact-form7-submitted.png' } );
                await page.waitForSelector('text=Thank you for your message. It has been sent.', { timeout: 5000 });
            }
            await page.waitForTimeout(500);
            //if views, we just look at the page.

            let browser_uid = await page.evaluate(async () => {
                return await burst_use_cookies() ? burst_uid() : burst_fingerprint();
            });
            let prefix = parseInt(cookieless) === 1 ? 'f-' : '';
            browser_uid = prefix + browser_uid;
            let data = await getTableData('wp_burst_statistics', { where: "parameters like'%"+typeKey+"' AND uid='"+browser_uid+"'" } );
            let statisticsId = data[0].ID;

            let goalData = await getTableData('wp_burst_goal_statistics', { where: "statistic_id ="+statisticsId+" AND goal_id="+goalId } );
            console.log("goalData", goalData);
            expect(goalData.length).toBe(1);

            const hasErrors = await debugHasError();
            expect(hasErrors).toBe(false);
        });

}
export {runGoalTest}