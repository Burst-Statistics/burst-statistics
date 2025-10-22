async function dismissOnboarding (page) {
    //dismiss the onboarding modal if it appears
    try {
        await page.locator('.burst-skip').waitFor({ state: 'visible', timeout: 1000 });
        await page.click('.burst-skip');
    } catch (e) {
        // onboaring not visible, continue
    }
}
module.exports = { dismissOnboarding };