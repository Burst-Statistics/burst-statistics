import {getPageObjectBySlug} from "./getPageObjectBySlug";
import {wpCli} from "./wpCli";

async function testFor404(page, config, typeKey, iteration = 1 ) {
    if (iteration>4){
        console.log("testFor404 iteration limit reached");
        return false;
    }

    let pageObj = await getPageObjectBySlug('test-tracking-page', config, typeKey);
    let response = await page.goto(pageObj.slug, { waitUntil: 'domcontentloaded' });
    //check if the response is a 404
    if (response?.status() === 404) {
        console.warn(`Page ${pageObj.slug} returned 404, flushing permalinks...`);
        // Flush permalinks via wp-cli
        await wpCli('rewrite flush --hard');
        await new Promise(resolve => setTimeout(resolve, 500));
        let success = await testFor404(page, config, typeKey, ++iteration);
        if (!success) {
            console.error("testFor404 failed after 4 attempts");
            return false;
        }
    }
    console.log("successfully detected ", pageObj.slug);
    return true;
}
export { testFor404 };