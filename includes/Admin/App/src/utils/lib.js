import { addQueryArgs, buildQueryString, safeDecodeURI as wpSafeDecodeURI } from '@wordpress/url';

export const burst_get_website_url = ( url = '/', params = {}) => {
  const baseUrl = 'https://burst-statistics.com/';
  // Remove leading slash if present
  url = url.replace( /^\//, '' );

  // Make sure the url ends with a slash
  url = url.replace( /\/?$/, '/' );
  const version = burst_settings.is_pro ? 'pro' : 'free';
  const versionNr = burst_settings.burst_version.replace( /#.*$/, '' );

  const defaultParams = {
    utm_campaign: `burst-${version}-${versionNr}`
  };

  // Merge default params with provided params, but force our default utm_campaign with the version.
  const { utm_campaign, ...cleanParams } = params;
  const mergedParams = { ...defaultParams, ...cleanParams };
  // Add or override utm_source if burst_settings.installed_by is not empty
  if ( burst_settings.installed_by.length>0 ) {
    mergedParams.utm_source = 'onboarding-'+burst_settings.installed_by;
  }
  // Use WordPress addQueryArgs utility to handle URL parameters properly
  return addQueryArgs(baseUrl + url, mergedParams);
};

/**
 * Safely decodes a URI using WordPress's safeDecodeURI utility.
 * Falls back to the original URI if decoding fails.
 *
 * @param {string} uri - The URI to decode.
 * @return {string} The decoded URI or the original URI if decoding fails.
 */
export const safeDecodeURI = ( uri ) => {
  // Use WordPress's safeDecodeURI utility which has built-in error handling
  return wpSafeDecodeURI(uri);
};