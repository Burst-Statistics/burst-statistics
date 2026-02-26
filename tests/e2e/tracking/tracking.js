import {login} from "../helpers/auth";
import {createTestPages} from "../helpers/createTestPages";
import {wpCli} from "../helpers/wpCli";
import {setPermalinkStructure} from "../helpers/setPermalinkStructure";
import {getPageObjectBySlug} from "../helpers/getPageObjectBySlug";
import {updateBurstOption} from "../helpers/updateBurstOption";
import {assertTrackingData} from "../helpers/assertTrackingData";
import {getTableData} from "../helpers/getTableData";
import {debugHasError} from "../helpers/debugHasError";
import {visitPage} from "../helpers/visitPage";
const { test, expect } = require('@playwright/test');

async function runTrackingTest(typeKey, config){
    test.setTimeout(60000); // Set timeout to 60 seconds
    test.describe.serial(`Burst Tracking - ${config.name}`, () => {
        test( 'Test track hit and update hit', async ({ page }) => {
            console.log("login to WP");
            await login(page);
            console.log("set tracking options");
            await updateBurstOption({
                ghost_mode: config.ghostMode,
                enable_cookieless_tracking: config.cookieless,
                enable_do_not_track: 0,
                enable_turbo_mode: config.turboMode,
                track_url_change: 0,
                user_role_blocklist:0,
                combine_vars_and_script: config.combineVarsAndScripts,
            });
            console.log("create test pages");
            await createTestPages();

            let trackingStatus = config.beaconEnabled ? 'beacon' : 'rest';
            console.log("set tracking status", trackingStatus);
            await wpCli(`option update burst_tracking_status ${trackingStatus}`);
            console.log("set permalinks", config.permalink);
            await setPermalinkStructure(config.permalink, page );

            //clear cookies
            console.log("clear cookies");
            await page.context().clearCookies();

            let page_1 = await getPageObjectBySlug('test-tracking-page', config, typeKey);
            let page_2 = await getPageObjectBySlug('test-another-page', config, typeKey);
            const logs = [];

            page.on('console', msg => {
                const text = msg.text();
                const excludedSubstrings = [
                    'JQMIGRATE',
                    'React DevTools',
                    'Automatic fallback to software WebGL has been deprecated', //fingerprinting
                    'GPU stall due to ReadPixels', //fingerprinting
                    'Moment Timezone has no data for',
                ];

                const shouldExclude = excludedSubstrings.some(substring => text.includes(substring));

                if (!shouldExclude) {
                    logs.push(`[${msg.type()}] ${text}`);
                }
            });

            page.on('response', async response => {
                if (response.status() === 404) {
                    console.log(`[404] ${response.url()}`);
                }
            });

            console.log("go to page 1", page_1.slug);
            await visitPage(page, page_1.slug);
            const pageTypeAttribute = config.ghostMode ? 'data-b_type' : 'data-burst_type';
            const pageType = await page.locator('body').getAttribute(pageTypeAttribute);
            const html = await page.content();
            // console.log(html);
            if (pageType) {
                console.log(`Page type is: ${pageType}`);
            } else {
                console.log('page_type attribute not found');
            }

            const beaconEnabled = await page.evaluate(() => {
                return typeof burst !== 'undefined' ? burst.options.beacon_enabled : null;
            });
            const turbomodeEnabled = await page.evaluate(() => {
                return typeof burst !== 'undefined' ? burst.options.enable_turbo_mode : null;
            });
            const cookieless = await page.evaluate(() => {
                return typeof burst !== 'undefined' ? burst.options.cookieless : null;
            });

            if (config.turboMode) {
                expect(parseInt(turbomodeEnabled)).toBe(1);
            } else {
                expect(parseInt(turbomodeEnabled)).toBe(0);
            }
            if (config.beaconEnabled) {
                expect(parseInt(beaconEnabled)).toBe(1);
            } else {
                expect(parseInt(beaconEnabled)).toBe(0);
            }
            if (config.cookieless) {
                expect(parseInt(cookieless)).toBe(1);
            } else {
                expect(parseInt(cookieless)).toBe(0);
            }

            const pageContent = await page.content();
            if (config.combineVarsAndScripts) {
                expect(pageContent).toContain('/timeme.min.js');
                if (config.ghostMode) {
                    //check if the source of the website contains uploads/js/{8-character-random-string}.min.js
                    expect(pageContent).toMatch(/uploads\/js\/[a-z0-9]{8}\.min\.js/);
                } else {
                    //check if the source of the website contains uploads/burst/js/burst.min.js
                    expect(pageContent).toContain('uploads/burst/js/burst.min.js');
                }

            } else {
                let filename = config.cookieless ? 'burst-cookieless.min.js' : 'burst.min.js';
                //check if the source of the website contains assets/js/build/filename
                expect(pageContent).toContain('assets/js/build/'+filename);
                expect(pageContent).toContain('assets/js/timeme/timeme.min.js?');
            }

            let browser_uid = await page.evaluate(async () => {
                return await burst_use_cookies() ? burst_uid() : burst_fingerprint();
            });
            let prefix = parseInt(cookieless) === 1 ? 'f-' : '';
            browser_uid = prefix + browser_uid;
            console.log("browser_uid", browser_uid, "typekey", typeKey, "cookieless", cookieless);
            let data = await getTableData('wp_burst_statistics', { where: "parameters like'%"+typeKey+"' AND uid='"+browser_uid+"'" } );
            console.log("do first assertion on page 1", browser_uid, data);
            assertTrackingData(data, page_1);
            expect(parseInt(data[0].bounce)).toBe(1);

            let session_id = data[0].session_id;
            let uid = data[0].uid;
            let time_on_page = data[0].time_on_page;

            data = await getTableData('wp_burst_sessions', { where: "ID="+parseInt(session_id) } );
            expect(data.length).toBe(1);
            console.log("wp_burst_sessions", data);

            //ensure some time has passed.
            await new Promise(resolve => setTimeout(resolve, 1000));

            //navigate to a blank page, to check if the pagehide event triggers the update hit event
            await visitPage(page, 'about:blank');

            //now check if we still have the data in the database, but time on page should be larger.
            data = await getTableData('wp_burst_statistics', { where: "uid='"+uid+"' AND parameters LIKE '%"+typeKey+"'" } );
            console.log("do update assertion on page 1", browser_uid, data);

            assertTrackingData(data, page_1);

            console.log("compare time on page ", data[0].time_on_page, time_on_page);
            expect(parseInt(data[0].time_on_page)).toBeGreaterThan(parseInt(time_on_page));

            //still a bounce, because no other page was visited, and not enough time has passed yet.
            expect(parseInt(data[0].bounce)).toBe(1);

            //now visit another page, test-another-page, and check if the bounce is set to 0
            await visitPage(page, page_2.slug);

            //we now have two pages for one uid, so we also filter by page_url, to ensure just one result
            let dataPage_1 = await getTableData('wp_burst_statistics', { where: "uid='"+uid+"' AND page_url = '"+page_1.page_url+"' AND parameters = '"+page_1.parameter+"'" } );
            let dataPage_2 = await getTableData('wp_burst_statistics', { where: "uid='"+uid+"' AND page_url = '"+page_2.page_url+"' AND parameters = '"+page_2.parameter+"'" } );
            console.log("do after navigation assertion on page 1", browser_uid, page_1.parameter, dataPage_1);

            assertTrackingData(dataPage_1, page_1);
            expect(data[0].uid).toBe(browser_uid);
            expect(dataPage_1[0].bounce).toBe("0"); //not a bounce anymore
            assertTrackingData(dataPage_2, page_2);
            expect(dataPage_2[0].bounce).toBe("0"); //next page, not a bounce.
            console.log("detected console logs: ", logs);
            expect(logs.length).toBe(0); //no console errors



            if (config.beaconEnabled && !config.cookieless) {
                console.log("clear cookies");
                await page.context().clearCookies();
                await visitPage(page, page_1.slug);
                let new_browser_uid = await page.evaluate(async () => {
                    return await burst_use_cookies() ? burst_uid() : burst_fingerprint();
                });
                new_browser_uid = prefix + new_browser_uid;
                console.log("new browser_uid", new_browser_uid, "typekey", typeKey, "cookieless", cookieless);
                //ensure that we are not a bounce.

                //assert that browser_id is not equal to new_browser_uid
                expect(browser_uid).not.toBe(new_browser_uid);

                await visitPage(page, page_2.slug);

                let new_data = await getTableData('wp_burst_statistics', { where: "parameters like'%"+typeKey+"' AND uid='"+new_browser_uid+"'" } );

                console.log("do first assertion on page 1", new_browser_uid, new_data);

                expect(new_data.length).toBe(2);
                expect(new_data[0].uid).toBe(new_browser_uid);
                expect(parseInt(new_data[0].bounce)).toBe(0); //two pages visited

                console.log("also check if we have the correct session id")
                let new_session_id = new_data[0].session_id;
                //verify that this session id is not equal to the previous session id
                //it should be different from the previous session id
                console.log("session_id", session_id, "new_session_id", new_session_id);
                expect(session_id).not.toBe(new_session_id);

                data = await getTableData('wp_burst_sessions', { where: "ID="+parseInt(new_session_id) } );
                expect(data.length).toBe(1);
                console.log("wp_burst_sessions", data);

                await page.goto('wp-admin/');
                //switch to different tabs, to check for console errors.
                await page.goto('wp-admin/admin.php?page=burst#/statistics?range=today&_=', { waitUntil: 'networkidle' });
                await page.waitForTimeout(500);

                //change the date selection to "today"
                await page.locator('.burst-date-button').click();
                await page.locator('.rdrStaticRanges button').first().click();
                await page.waitForTimeout(1000);

                await page.goto('wp-admin/admin.php?page=burst#/', { waitUntil: 'networkidle' });
                await page.waitForTimeout(500);
            }

            //should still have no console errors.
            console.log("detected console logs: ", logs);
            expect(logs.length).toBe(0);

            //check if we have any errors in the debug.log
            const hasErrors = await debugHasError();
            expect(hasErrors).toBe(false);

        });

    });
}
export {runTrackingTest}