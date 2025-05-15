const {getPageIdBySlug} = require("./getPageIdBySlug");
async function getPageObjectBySlug(slug, config, typeKey ) {
    let parameter = typeKey;
    let genericSlug = `/${slug}`+'?'+parameter;
    let page_url = config.permalink === 'plain' ? "/" : `/${slug}/`;

    if (config.permalink === 'plain') {
        let pageId = await getPageIdBySlug(slug);
        parameter ="page_id="+pageId+"&"+typeKey;
        genericSlug = `/index.php?p=${pageId}`+'&'+parameter;
    }

    return {
        slug: genericSlug,
        parameter: parameter,
        page_url : page_url,
    }
}
export { getPageObjectBySlug };