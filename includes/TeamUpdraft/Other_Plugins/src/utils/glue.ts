export const glue = ( path: string ) => {
    const settings =  window[`teamupdraft_onboarding`] || {};
    path = settings.rest_url + path;
    return path.indexOf( '?' ) === -1 ? '?' : '&';
};
