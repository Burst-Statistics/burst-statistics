import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

//we have to use a relative path here, as api.js is also used by Dashboard_Widget.
import { toast } from './toast';

if ( burst_settings.is_mainwp && burst_settings.root ) {
    apiFetch.use.bind( apiFetch );

    // Force-register a root URL override by using the fetch handler directly
    apiFetch.use( ( options, next ) => {
		if ( options.path ) {
			const root = burst_settings.root.replace( /\/$/, '' );
			const path = options.path.replace( /^\//, '' );
			options.url = `${root}/${path}`;
			delete options.path;
		}

		options.headers = {
			...( options.headers || {}),
			'Authorization': 'Basic ' + burst_settings.child_token,
			'X-BURSTMAINWP': '1'
		};
		delete options.headers['X-WP-Nonce'];

		// Inject burst_nonce into POST data
		if ( options.data ) {
			options.data = {
				...options.data,
				nonce: burst_settings.burst_nonce
			};
		}

		return next( options );
	});

    burst_settings.rest_url = burst_settings.root;
}

const usesPlainPermalinks = () => {
	return -1 !== burst_settings.rest_url.indexOf( '?' );
};

const glue = () => {
	return usesPlainPermalinks() ? '&' : '?';
};

/**
 * Get nonce for burst api. Add random string so requests don't get cached
 * @return {string}
 */
const getNonce = () => {
	return (
		'nonce=' +
		burst_settings.burst_nonce +
		'&token=' +
		Math.random() // nosemgrep
			.toString( 36 )
			.replace( /[^a-z]+/g, '' )
			.substr( 0, 5 )
	);
};

let lastErrorMessage = '';
let lastErrorTime = 0;
const NONCE_TOAST_ID = 'burst-nonce-expired';
const generateError = ( error, path = false ) => {
	const rawError = ( error || '' ).replace( /(<([^>]+)>)/gi, '' );

	if ( /nonce|expired/i.test( rawError ) ) {
		if ( toast.isActive( NONCE_TOAST_ID ) ) {
			return;
		}
		const nonceDiv = (
			<div>
				<div>
					{__( 'Connection to server expired', 'burst-statistics' )}
				</div>
				<button
					type="button"
					className="rounded transition-all duration-200 min-w-fit focus:outline-hidden focus:ring-2 focus:ring-offset-2 bg-blue text-text-white border border-blue-700 hover:bg-wp-blue hover:shadow-ringSecondary focus:ring-blue py-2 px-6 text-m"
					style={{ marginTop: '8px' }}
					onClick={() => window.location.reload()}
				>
					{__( 'Refresh connection', 'burst-statistics' )}
				</button>
			</div>
		);
		toast.error( nonceDiv, {
			toastId: NONCE_TOAST_ID,
			autoClose: false
		});
		return;
	}

	let message = __( 'Server error', 'burst-statistics' );
	if ( path ) {
		const urlWithoutQueryParams = path.split( '?' )[0];

		const urlParts = urlWithoutQueryParams.split( '/' );
		const index = urlParts.indexOf( 'v1' ) + 1;
		message =
			__( 'Server error in', 'burst-statistics' ) +
			' ' +
			urlParts[index] +
			'/' +
			urlParts[index + 1];
	}
	message += ': ' + rawError;

	// Skip if same message was shown in the last 3 seconds
	const now = Date.now();
	if ( message === lastErrorMessage && 3000 > now - lastErrorTime ) {
		return;
	}
	lastErrorMessage = message;
	lastErrorTime = now;

	// wrap the message in a div react component and give it an onclick to copy
	// the text to the clipboard this way the user can easily copy the error
	// message and send it to us
	const messageDiv = (
		<div
			title={__( 'Click to copy', 'burst-statistics' )}
			onClick={() => {
				navigator.clipboard.writeText( message );
				toast.success(
					__( 'Error copied to clipboard', 'burst-statistics' )
				);
			}}
		>
			{message}
		</div>
	);

	toast.error( messageDiv, {
		autoClose: 10000
	});
};

const makeRequest = async( path, method = 'GET', data = {}) => {
	const controller = new AbortController();
	const signal = controller.signal;
	const args = { path, method, signal };

	//if burst_share_token is in the url, add it to the headers
	const urlParams = new URLSearchParams( window.location.search );
	const shareToken = urlParams.get( 'burst_share_token' );
	if ( shareToken ) {
		args.headers = {
			'X-Burst-Share-Token': shareToken
		};
	}

	if ( 'POST' === method ) {
		data.nonce = burst_settings.burst_nonce;
		args.data = data;
	}

	try {
		const response = await apiFetch( args );
		if ( ! response.request_success ) {
			if ( Object.prototype.hasOwnProperty.call( response, 'message' ) ) {
				generateError( response.message, args.path );
			} else {
				generateError( 'unexpected response', args.path );
			}
		}

		if ( response.code && 200 !== response.code ) {
			generateError( response.message, args.path );
		}

		delete response.request_success;
		return response;
	} catch ( error ) {
		try {

			// Wait for ajaxRequest to resolve before continuing.
			return await ajaxRequest( method, path, data );
		} catch {
			generateError( error.message, args.path );
			throw error;
		}
	}
};

const isDoActionFallbackPath = ( path = '' ) => {
	const writeFragments = [
		'/options/set',
		'/fields/set',
		'/goals/add',
		'/goals/delete',
		'/goals/set',
		'/goals/add_predefined',
		'/do_action/'
	];

	return writeFragments.some( ( fragment ) => path.includes( fragment ) );
};

const withAjaxAction = ( url, action ) => {
	if ( url.includes( 'action=' ) ) {
		return url.replace( /([?&]action=)[^&]*/, `$1${action}` );
	}

	const separator = url.includes( '?' ) ? '&' : '?';
	return `${url}${separator}action=${action}`;
};

const getAjaxFallbackUrl = ( method, path ) => {
	const action =
		'POST' === method || isDoActionFallbackPath( path ) ?
			'burst_rest_api_fallback_do_action' :
			'burst_rest_api_fallback_get_action';

	return withAjaxAction( siteUrl( 'ajax' ), action );
};

const ajaxRequest = async( method, path, requestData = null ) => {
	const ajaxUrl = getAjaxFallbackUrl( method, path );
	const url =
		'GET' === method ?
			`${ajaxUrl}&rest_action=${path.replace( '?', '&' )}` :
			ajaxUrl;

	const controller = new AbortController();
	const signal = controller.signal;

	const options = {
		method,
		headers: { 'Content-Type': 'application/json; charset=UTF-8' },
		signal
	};

	if ( 'POST' === method ) {
		options.body = JSON.stringify(
			{ path, data: requestData },
			stripControls
		);
	}

	try {
		const response = await fetch( url, options ); // nosemgrep
		if ( ! response.ok ) {
			generateError( response.statusText );
			throw new Error( response.statusText );
		}

		const responseData = await response.json();

		if (
			! responseData.data ||
			! Object.prototype.hasOwnProperty.call(
				responseData.data,
				'request_success'
			)
		) {

			//log for automated fallback test. Do not remove.
			console.log( 'Ajax fallback request failed.' );
			throw new Error( 'Invalid data error' );
		}

		delete responseData.data.request_success;

		// return promise with the data object
		return Promise.resolve( responseData.data );
	} catch ( error ) { // eslint-disable-line @typescript-eslint/no-unused-vars
		return Promise.reject( new Error( 'AJAX request failed' ) );
	}
};

/**
 * All data elements with 'Control' in the name are dropped, to prevent:
 * TypeError: Converting circular structure to JSON
 * @param  key
 * @param  value
 * @return {any|undefined}
 */
const stripControls = ( key, value ) => {
	if ( ! key ) {
		return value;
	}
	if ( key && key.includes( 'Control' ) ) {
		return undefined;
	}
	if ( 'object' === typeof value ) {
		return JSON.parse( JSON.stringify( value, stripControls ) );
	}
	return value;
};

/**
 * if the site is loaded over https, but the site url is not https, force to
 * use https anyway, because otherwise we get mixed content issues.
 * @param  type
 * @return {*}
 */
const siteUrl = ( type ) => {
	let url;
	if ( 'undefined' === typeof type ) {
		url = burst_settings.rest_url;
	} else {
		url = burst_settings.admin_ajax_url;
	}
	if (
		'https:' === window.location.protocol &&
		-1 === url.indexOf( 'https://' )
	) {
		return url.replace( 'http://', 'https://' );
	}
	return url;
};

export const setOption = ( option, value ) =>
	makeRequest( 'burst/v1/options/set' + glue() + getNonce(), 'POST', {
		option: { option, value }
	});

export const getFields = () =>
	makeRequest( 'burst/v1/fields/get' + glue() + getNonce() );
export const setFields = ( data ) => {
	return makeRequest( 'burst/v1/fields/set' + glue(), 'POST', {
		fields: data
	});
};

export const setGoals = ( data ) => {
	return makeRequest(
		'burst/v1/goals/set' + glue() + getNonce(),
		'POST',
		data
	);
};

export const getGoals = () =>
	makeRequest( 'burst/v1/goals/get' + glue() + getNonce() );

export const deleteGoal = ( id ) =>
	makeRequest( 'burst/v1/goals/delete' + glue() + getNonce(), 'POST', {
		id
	});
export const addGoal = () =>
	makeRequest( 'burst/v1/goals/add' + glue() + getNonce(), 'POST', {});
export const addPredefinedGoal = ( id ) =>
	makeRequest( 'burst/v1/goals/add_predefined' + glue() + getNonce(), 'POST', {
		id
	});

export const getBlock = ( block ) => makeRequest( 'burst/v1/block/' + block + glue() + getNonce() );

export const doAction = ( action, data = {}) =>
	makeRequest( `burst/v1/do_action/${action}`, 'POST', {
		action_data: data,
		should_load_ecommerce: burst_settings.shouldLoadEcommerce || false
	}).then( ( response ) => {
		return Object.prototype.hasOwnProperty.call( response, 'data' ) ?
			response.data :
			[];
	});

/**
 * Perform a read-only GET action via the get_action endpoint.
 * Use this for actions that only require burst_viewer capability.
 *
 * @param {string} action     - The action name
 * @param {Object} actionData - Optional data to pass as query params
 * @return {Promise}
 */
export const getAction = ( action, actionData = {}) => {
    const params = new URLSearchParams({
        nonce: burst_settings.burst_nonce,
        ...actionData
    }).toString();

    return makeRequest(
        `burst/v1/get_action/${action}${glue()}${params}`,
        'GET'
    ).then( ( response ) => {
        return Object.prototype.hasOwnProperty.call( response, 'data' ) ? response.data : [];
    });
};

/**
 * Serialize value for URL parameters, handling arrays and objects
 * @param {*} value - Value to serialize
 * @return {string} Serialized value
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

/**
 * Build query string from object of parameters
 * @param {Object} params
 * @return {string}
 */
const buildQueryString = ( params ) => {
	return Object.keys( params )
		.filter( ( key ) => params[key] !== undefined && null !== params[key])
		.map( ( key ) => {
			const value = serializeValue( params[key]);
			if ( Array.isArray( value ) ) {

				// Handle arrays by using the PHP array syntax: metrics[]=value1&metrics[]=value2
				return value
					.map(
						( v ) =>
							`${encodeURIComponent( key )}[]=${encodeURIComponent( v )}`
					)
					.join( '&' );
			}
			return `${encodeURIComponent( key )}=${encodeURIComponent( value )}`;
		})
		.join( '&' );
};

/**
 * Get data from the REST API
 * @param {string} type      - The data type to fetch
 * @param {string} startDate - Start date for the query
 * @param {string} endDate   - End date for the query
 * @param {string} range     - Date range
 * @param {Object} args      - Additional query parameters
 * @return {Promise}
 */
export const getData = async( type, startDate, endDate, range, args = {}) => {

	// Extract filters and metrics from args if they exist.
	const { filters, metrics, group_by, currentView, selectedPages, id, chart_mode, distribution_view, product_id } = args;

	// Combine all query parameters.
	const queryParams = {
		date_start: startDate,
		date_end: endDate,
		date_range: range,
		nonce: burst_settings.burst_nonce,
		should_load_ecommerce: burst_settings.shouldLoadEcommerce || false,
		goal_id: args.goal_id,
		token: Math.random() // nosemgrep
			.toString( 36 )
			.replace( /[^a-z]+/g, '' )
			.substr( 0, 5 ),
		...( selectedPages && { selected_pages: selectedPages }), // type is string
		...( filters && { filters }), // type is object
		...( metrics && { metrics }), // type is array
		...( group_by && { group_by }), // type is array
		...( currentView && { currentView }), // type is object
		...( id && { id }), // type is string
		...( chart_mode && { chart_mode }), // type is string
		...( distribution_view && { distribution_view }), // type is string
		...( product_id && { product_id }) // type is string
	};

	const queryString = buildQueryString( queryParams );
	const path = `burst/v1/data/${type}${glue()}${queryString}`;

	return await makeRequest( path, 'GET' );
};

export const getReportPreview = ( blocks, frequency ) => {
	const data = {
		blocks: blocks,
		frequency: frequency
	};
	return doAction( 'report/preview', data );

};

export const getReports = () => {
	return makeRequest( 'burst/v1/reports/' + glue() + getNonce() );
};

export const getReportLogs = () => {
	return makeRequest( 'burst/v1/report/logs' + glue() + getNonce() );
};

export const getPosts = ( search ) =>
	makeRequest( `burst/v1/posts/${glue()}${getNonce()}&search=${search}` ).then(
		( response ) => {
			return Object.prototype.hasOwnProperty.call( response, 'posts' ) ?
				response.posts :
				[];
		}
	);

/**
 * Retrieves a value from local storage with a 'burst_' prefix and parses it as
 * JSON. If the key is not found, returns the provided default value.
 *
 * @param {string} key          - The key to retrieve from local storage, without the
 *                              'burst_' prefix.
 * @param {*}      defaultValue - The value to return if the key is not found in
 *                              local storage.
 * @return {*} - The parsed JSON value from local storage or the default
 *     value.
 */
export const getLocalStorage = ( key, defaultValue ) => {
	if ( 'undefined' !== typeof Storage ) {
		const storedValue = localStorage.getItem( 'burst_' + key );
		if ( storedValue && 0 < storedValue.length ) {
			return JSON.parse( storedValue );
		}
	}
	return defaultValue;
};

/**
 * Stringifies a value as JSON and stores it in local storage with a 'burst_'
 * prefix.
 *
 * @param {string} key   - The key to store in local storage, without the
 *                       'burst_' prefix.
 * @param {*}      value - The value to stringify as JSON and store in local
 *                       storage.
 */
export const setLocalStorage = ( key, value ) => {
	if ( 'undefined' !== typeof Storage ) {
		localStorage.setItem( 'burst_' + key, JSON.stringify( value ) );
	}
};

/**
 * Removes a value from local storage using a 'burst_' prefix.
 *
 * @param {string} key - The key to remove from local storage, without the
 *                     'burst_' prefix.
 *
 * @return {void}
 */
export const removeLocalStorage = ( key ) => {
	if ( 'undefined' !== typeof Storage ) {
		localStorage.removeItem( 'burst_' + key );
	}
};

export const getJsonData = async( path ) => {
	try {

		// Initiate the fetch request to the specified path
		const response = await fetch( path );

		// Check if the response status is OK (status code 200-299)
		if ( ! response.ok ) {
			throw new Error( `HTTP error! Status: ${response.status}` );
		}

		// Parse the response as JSON
		const data = await response.json();

		// Return the parsed JSON data
		return data;
	} catch ( error ) {

		// Log any errors to the console
		console.error( 'Error fetching JSON data:', error );

		// Optionally, rethrow the error if you want to handle it further up the call stack
		throw error;
	}
};
