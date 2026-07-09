/**
 * Determine how we can glue the query string to the URL.
 * E.g. in plain permalinks we might already have a `?` in the URL.
 * @param path
 */
export const glue = ( path: string ) => {
    const settings =  window[`teamupdraft_onboarding`] || {};
    path = settings.rest_url + path;
    return path.indexOf( '?' ) === -1 ? '?' : '&';
};
