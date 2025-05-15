const {wpCli} = require("./wpCli");

async function getPageIdBySlug(slug) {
    const result = await wpCli(`post list --post_type=page --format=json`);
    const pages = JSON.parse(result);
    const page = pages.find(p => p.post_name === slug);
    return page ? page.ID : 0;
}

module.exports = { getPageIdBySlug };