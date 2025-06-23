 
  export const get_website_url = ( url = '/', params = {}) => {
    url = url.replace( /^\//, '' );
  
    // make sure the url ends with a slash
    url = url.replace( /\/?$/, '/' );
    const onboardingData = window[`teamupdraft_onboarding`] || {}
    const version = onboardingData.is_pro ? 'pro' : 'free';
    const prefix = onboardingData.prefix || 'teamupdraft';
    const versionNr = onboardingData.version;
    const defaultParams = {
      burst_campaign: `${prefix}-${version}-${versionNr}`
    };
  
    params = Object.assign( defaultParams, params );
    const queryString = new URLSearchParams( params ).toString();
    return  url + ( queryString ? '?' + queryString : '' );
  };
  
  
  