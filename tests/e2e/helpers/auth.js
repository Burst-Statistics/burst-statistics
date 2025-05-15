async function login(page, username = 'admin', password = 'password') {
    //check if we're already logged in.
    await page.goto('/wp-admin/index.php');
    const loggedIn = await page.evaluate(() => {
        return document.querySelector('#wp-admin-bar-my-account') !== null;
    });

    if (loggedIn){
        return;
    }

    await page.goto('/wp-login.php', { waitUntil: 'domcontentloaded' });
    let timeout = 3000;

    await page.waitForSelector('#user_login', { state: 'visible', timeout });
    await page.focus('#user_login');
    await page.fill('#user_login', username);

    await page.focus('#user_pass');
    await page.fill('#user_pass', password);
    await page.click('#wp-submit');
    // try {
    //     await page.fill('#user_login', username);
    //     await page.fill('#user_pass', password);
    //     await page.click('#wp-submit');
    // } catch (err) {
    //     //reload the page
    //     console.log("error on first try, reload and try again");
    //     await page.reload();
    //     await page.waitForTimeout(1000); // allow DOM to settle
    //     page.fill('#user_login', username);
    //     page.fill('#user_pass', password);
    //     await page.click('#wp-submit');
    // }

}


async function logout(page){
    await page.context().clearCookies();
}

async function isLoggedIn(page) {
    const cookies = await page.context().cookies();
    let loggedInCookie = cookies.find(c => c.name === 'is-logged-in');
    if ( !loggedInCookie ) {
        return false;
    }
    console.log("cookie is-logged-in", c);
    return loggedInCookie.value === '1';
}
module.exports = { login, logout, isLoggedIn };

async function safeFill(page, selector, value) {
    let timeout = 5000;
    let retries = 1;

    try {
        await Promise.race([
            page.fill(selector, value),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
        ]);
    } catch (err) {
        if (attempt === retries) {
            throw new Error(`Failed to fill ${selector} after ${retries + 1} attempts: ${err.message}`);
        }
        console.warn(`Retrying fill for ${selector} (attempt ${attempt + 1})`);
    }
}