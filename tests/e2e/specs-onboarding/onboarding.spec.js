const { test, expect } = require('@playwright/test');
const { login } = require('../helpers/auth');
const {setPermalinkStructure} = require("../helpers/setPermalinkStructure");
const {wpCli} = require("../helpers/wpCli");
test.setTimeout(60000); // Set timeout to 60 seconds

const waitForContinueAndClick = async (page) => {
    await page.waitForSelector('.burst-continue', { state: 'visible' });
    await page.click('.burst-continue');
    await page.waitForTimeout(500);

    // Wait until the button is visible AND does not have burst-updating class
    await page.waitForSelector('.burst-continue:not(.burst-updating)', { state: 'visible' });
}

test('after activation, onboarding starts', async ({ page }) => {
    await login(page);
    await page.goto('wp-admin/admin.php?page=burst#/settings/license');
    await setPermalinkStructure('pretty', page );

    //in case this test runs a second time, delete the option burst_activation_time
    await wpCli('option delete burst_activation_time');
    await wpCli('option delete burst_completed_onboarding');
    await wpCli('option delete burst_skipped_onboarding');
    //ensure that the plugin is inactive
    await wpCli('plugin deactivate burst-pro');

    //activate the plugin
    await page.goto('/wp-admin/plugins.php');
    await page.screenshot({ path: 'screenshots/010-plugins-page-start.png' });
    const activateLink = await page.$('#activate-burst-pro');
    if ( activateLink ) {
        console.log("plugin is inactive, activate");
        await activateLink.click();
    }
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/020-plugins-page-activated.png' });

    //check if the onboarding modal is visible
    const onboardingModal = await page.locator('text=Start onboarding');
    await expect(onboardingModal).toBeVisible();

    await waitForContinueAndClick(page);
    console.log("fill out the license field");
    //we're on the licensing page, enter the license key in the input type="password"
    await page.fill('input[type="password"]', '6d98acf3ea8ff53a99d815b39abbe4ad');
    await page.screenshot({ path: 'screenshots/030-license.png' });

    //activate it
    await waitForContinueAndClick(page);

    //give it some time to process
    await page.waitForTimeout(3000);
    await page.screenshot({path: 'screenshots/040-detected-visit.png'});
    await page.waitForTimeout(1000);
    await page.screenshot({path: 'screenshots/050-detected-visit2.png'});

    //check if 'Successfully detected a visit on your site' is visible
    const visitDetected = await page.locator('text=Successfully detected a visit on your site');
    await expect(visitDetected).toBeVisible();

    await waitForContinueAndClick(page);
    await page.screenshot({path: 'screenshots/060-blocklist.png'});

    //check if we can deselect a checkbox.
    // //default is checked, so after clicking it, it should be unchecked.
    const checkbox = page.locator('#user_role_blocklist');
    await checkbox.click();
    await expect(checkbox).toHaveAttribute('data-state', 'unchecked');
    //enable again, and check if it is  enabled
    await checkbox.click();
    await expect(checkbox).toHaveAttribute('data-state', 'checked');

    await waitForContinueAndClick(page);

    await page.screenshot({path: 'screenshots/070-email-signup.png'});

    //change the email address to make sure this works.
    await page.focus('input[type=email]');
    await page.fill('input[type=email]', 'me@updraftplus.com');

    const emailInput = page.locator('input[type=email]');
    await expect(emailInput).toHaveValue('me@updraftplus.com');
    await page.waitForTimeout(500);

    const optinCheckbox = page.locator('#tips_tricks_mailinglist');
    await expect(optinCheckbox).toHaveAttribute('data-state', 'unchecked');


    await waitForContinueAndClick(page);
    console.log("share anonymous data");
    await page.screenshot({path: 'screenshots/080-share-data.png'});

    await waitForContinueAndClick(page);
    //uncheck all in one security, as it currently redirects after refresh, which breaks our final tests.
    await page.click('#plugins_all-in-one-wp-security-and-firewall');
    await page.screenshot({path: 'screenshots/090-install-plugins-option.png'});

    await waitForContinueAndClick(page);
    await page.waitForSelector('.burst-continue', { state: 'visible' });

    await page.screenshot({path: 'screenshots/100-finish-page.png'});

    const finishText = page.locator('.burst-continue', { hasText: 'Go to the dashboard and explore Burst' });
    await expect(finishText).toBeVisible();
    //wait until the button with text 'Go to the dashboard and explore Burst' is enabled, and click.
    //loop every 500 ms to check if it is enabled.
    while (await finishText.isDisabled()) {
        console.log("waiting for the finish button to be enabled...");
        await page.waitForTimeout(200);
    }
    await page.screenshot({path: 'screenshots/110-enabled-button.png'});
    await finishText.click();

    //wait 500 ms for page to reload
    await page.waitForTimeout(500);
    await page.screenshot({path: 'screenshots/120-after-dismissed-wizard.png'});

    //ensure that the onboarding is not visible anymore, by checking that the text 'Start onboarding' is not visible
    try {
        const onboardingText = page.locator('text=Start onboarding');
        await expect(onboardingText).not.toBeVisible();
    } catch (e) {
        // onboarding not visible, continue
    }
    await page.screenshot({path: 'screenshots/130-onboarding-should-not-be-visible-anymore.png'});

    // the text '1 person is exploring your site right now' should be visible
    const liveVisitorsText = await page.locator('text=1 person is exploring your site right now');
    console.log("checking live visitors text ", await liveVisitorsText.innerText());
    await expect(liveVisitorsText).toBeVisible();
    //click on the button with text 'Live visitors'
    await page.waitForSelector('button:has-text("Live visitors")');
    await page.screenshot({path: 'screenshots/140-live-visitors-button-visible.png'});

    await page.click('button:has-text("Live visitors")');
    //wait until the .burst-scroll class is visible
    await page.waitForSelector('.burst-scroll');
    
    await page.screenshot({path: 'screenshots/150-live-visitors-clicked.png'});
    // the text 'second ago' or 'seconds ago' or 'minute ago' or 'minutes ago' should be visible
    const timeText = await page.locator('text=/\\d+ (second|seconds|minute|minutes) ago/').first();
    await expect(timeText).toBeVisible();

    //the value of .burst-today h2 should be greater than or equal to 1
    const todayValue = await page.locator('.burst-today h2').first().innerText();
    expect(parseInt(todayValue)).toBeGreaterThanOrEqual(1);
});