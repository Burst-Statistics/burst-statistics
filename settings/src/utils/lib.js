export const in_array = ( needle, haystack ) => {
  let length = haystack.length;
  for ( let i = 0; i < length; i++ ) {
    if ( haystack[i] == needle ) {
      return true;
    }

  }
  return false;
};

export const burst_get_website_url = ( url = '/', params = {}) => {
  const baseUrl = 'https://burst-statistics.com/';
  url = url.replace( /^\//, '' );

  // make sure the url ends with a slash
  url = url.replace( /\/?$/, '/' );
  const version = burst_settings.burst_pro ? 'pro' : 'free';

  const versionNr = burst_settings.burst_version.replace( /#.*$/, '' );
  const defaultParams = {
    burst_campaign: `burst-${version}-${versionNr}`
  };

  params = Object.assign( defaultParams, params );
  const queryString = new URLSearchParams( params ).toString();
  return baseUrl + url + ( queryString ? '?' + queryString : '' );
};

export const safeDecodeURI = ( uri ) => {

    try {
        return decodeURI( uri );
    } catch ( e ) {
        if ( e instanceof URIError ) {
            console.error( 'Burst: Malformed URI detected:', uri, e );

            // Handle the error: return the original URI, a fallback value, or null
            return uri; // or return uri to keep the original if preferred
        } else {

            // Re-throw if it's an unexpected error
            console.log( 'Burst: Unexpected error on decodeURI:', uri, e );
            return uri;
        }
    }
};


