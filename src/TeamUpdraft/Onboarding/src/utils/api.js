import apiFetch from '@wordpress/api-fetch';
import {glue} from './glue';

/**
 * Generic API handler for onboarding actions
 * @param {string} action - The action to perform
 * @param {Object} data - Data to send with the request
 * @returns {Promise<*>}
 */

export const handleRequest = async( args ) => {
    const {method, path, data} = args;

    if ( method === 'GET' ) {
        args.path = `${args.path}${glue(args.path)}${buildQueryString( args.data )}`;
        delete args.data;
    }
    return apiFetch( args )
        .then( ( response ) => {
            if ( ! response.request_success ) {
                throw new Error( 'invalid data error' );
            }
            if ( response.code ) {
                throw new Error( response.message );
            }
            delete response.request_success;
            return response;
        })
        .catch( ( error ) => {
            // If REST API fails, try AJAX request
            return ajaxRequest( method, path, data ).catch( () => {
                // If AJAX also fails, generate error
                console.log( error.message, args.path );
                throw error;
            });
        });
}

export const updateAction = async( data = {}, action ) => {
    const onboardingData = window[`teamupdraft_onboarding`] || {}
    const endpointUrl = onboardingData.prefix + '/v1/onboarding/do_action/'+action;
    data.nonce = onboardingData.nonce;
    const path = endpointUrl;
    const method = 'POST';

    let args = {
        path,
        method,
        data,
    };

    return await handleRequest(args);
}

const siteUrl = ( ) => {
    const onboardingData = window[`teamupdraft_onboarding`] || {}
    let url = onboardingData.admin_ajax_url;

    if ( 'https:' === window.location.protocol && -1 === url.indexOf( 'https://' ) ) {
        return url.replace( 'http://', 'https://' );
    }
    return url;
};

const ajaxRequest = async( method, path, requestData = null ) => {
    //if requestData is an object, convert it to an array
    const queryString = buildQueryString( requestData );
    //add path to request data
    requestData.path = path;
    const url = 'GET' === method ? `${siteUrl()}&rest_action=${path.replace( '?', '&' )}&`+queryString : siteUrl();
    const options = {
        method,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' }
    };

    if ( 'POST' === method ) {

        options.body = JSON.stringify({ path, data: requestData } );
    }
    try {
        const response = await fetch( url, options );
        if ( ! response.ok ) {
            return Promise.reject( new Error( 'AJAX request failed' ) );
        }

        const responseData = await response.json();
        if (
            ! responseData.data ||
            ! Object.prototype.hasOwnProperty.call( responseData.data, 'request_success' )
        ) {
            return Promise.reject( new Error( 'AJAX request failed' ) );
        }

        delete responseData.data.request_success;

        // return promise with the data object
        return Promise.resolve( responseData.data );
    } catch ( error ) {
        return Promise.reject( new Error( 'AJAX request failed' ) );
    }
}

/**
 * Build query string from object of parameters
 * @param {Object} params
 * @returns {string}
 */
const buildQueryString = ( params ) => {
    return Object.keys( params )
        .filter( ( key ) => params[key] !== undefined && null !== params[key])
        .map( ( key ) => {
            const value = serializeValue( params[key]);
            if ( Array.isArray( value ) ) {

                // Handle arrays by using the PHP array syntax: metrics[]=value1&metrics[]=value2
                return value
                    .map( ( v ) => `${encodeURIComponent( key )}[]=${encodeURIComponent( v )}` )
                    .join( '&' );
            }
            return `${encodeURIComponent( key )}=${encodeURIComponent( value )}`;
        })
        .join( '&' );
};

/**
 * Serialize value for URL parameters, handling arrays and objects
 * @param {*} value - Value to serialize
 * @returns {string} Serialized value
 */
const serializeValue = ( value ) => {
    if ( Array.isArray( value ) ) {

        // For arrays, add [] to the key and keep values separate
        return value;
    }
    if ( 'object' === typeof value && null !== value ) {
        return JSON.stringify( value );
    }
    return value;
};
