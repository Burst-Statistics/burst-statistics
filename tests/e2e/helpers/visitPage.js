const {wpCli} = require("./wpCli");

async function visitPage (page, slug) {
    await page.goto(slug, { waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({ path: `screenshots/test-tracking-page-${slug}.png` });
    await wpCli(`eval "do_action('burst_recalculate_known_uids_cron');"`);
    await wpCli(`eval "do_action('burst_recalculate_bounces_cron');"`);
    await wpCli(`eval "do_action('burst_recalculate_first_time_visits_cron');"`);
}
module.exports = { visitPage };