import {isLoggedIn, login} from "./auth";
import {wpCli} from "./wpCli";

async function setPermalinkStructure(type, page) {
    // const { wpCli } = require('./wpCli');
    const structure = type === 'pretty' ? '/%postname%/' : '';
    const id = type === 'pretty' ? 'permalink-input-post-name' : 'permalink-input-plain';
    await wpCli(`option update permalink_structure "${structure}"`)
    await wpCli('rewrite flush');

    await login(page);
    await page.goto('/wp-admin/options-permalink.php');
    //select the correct option
    const permalinkOption = page.locator(`#${id}`);
    //save
    await permalinkOption.check();

    const saveButton = page.locator('#submit');
    await saveButton.click();
}
export { setPermalinkStructure };