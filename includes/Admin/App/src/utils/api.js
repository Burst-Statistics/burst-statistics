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
	return  (
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
const activeRequestControllers = new Map();
const activeRequests = new Map();

const getRequestDedupKey = ( method, path ) => {
	const [ basePath, queryString = '' ] = path.split( '?' );
	const normalizedPath = ( basePath || '' ).replace( /\/+/g, '/' );

	// Strip cache-busting `token` and per-session `nonce`, drop empty segments
	// from `&&` artifacts (e.g. when filters serializes to an empty array), and
	// sort the rest so two requests for the same logical resource share a key.
	// Avoid URLSearchParams here: with bracketed array keys like `metrics[]=`
	// some environments silently produce empty entries, which would collapse
	// every request for the same endpoint onto a single dedup key.
	const sortedParams = queryString
		.split( '&' )
		.filter( ( entry ) => {
			if ( '' === entry ) {
				return false;
			}
			const key = entry.split( '=' )[ 0 ];
			return 'nonce' !== key && 'token' !== key;
		})
		.sort()
		.join( '&' );

	return `${method}:${normalizedPath}?${sortedParams}`;
};

const createAbortableRequest = ( method, path ) => {
	const requestKey = getRequestDedupKey( method, path );

	const existingController = activeRequestControllers.get( requestKey );

	// Keep only the newest in-flight request for each dedup key.
	if ( existingController ) {
		existingController.abort();
	}

	const controller = new AbortController();
	activeRequestControllers.set( requestKey, controller );

	const finalize = () => {
		if ( activeRequestControllers.get( requestKey ) === controller ) {
			activeRequestControllers.delete( requestKey );
		}
	};

	return {
		requestKey,
		controller,
		signal: controller.signal,
		finalize
	};
};

const isAbortError = ( error ) => {
	if ( ! error ) {
		return false;
	}

	return (
		'AbortError' === error.name ||
		/aborted|aborterror/i.test( error.message || '' )
	);
};

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

// Capture the share token once at load time so it survives client-side
// navigations that may strip it from the URL (e.g. tab switches).
const _initialShareToken = new URLSearchParams( window.location.search ).get( 'burst_share_token' );

const getRequestAuth = () => ({
	shareToken: _initialShareToken || ''
});

const withRequestHeaders = ( headers = {}, auth = getRequestAuth() ) => {
	if ( ! auth.shareToken ) {
		return headers;
	}

	return {
		...headers,
		'X-Burst-Share-Token': auth.shareToken
	};
};

const makeRequest = (
    path,
    method = 'GET',
    data = {},
    requireRequestSuccess = true
) => {
	const requestKey = getRequestDedupKey( method, path );

	if ( 'GET' === method ) {
		const existingPromise = activeRequests.get( requestKey );
		if ( existingPromise ) {
			return existingPromise;
		}
	}

	const requestContext = createAbortableRequest( method, path );
	const auth = getRequestAuth();
	const args = { path, method, signal: requestContext.signal };

	args.headers = withRequestHeaders( args.headers, auth );

	if ( 'POST' === method ) {
		data.nonce = burst_settings.burst_nonce;
		args.data = data;
	}

	const promise = ( async() => {
		try {
			const response = await apiFetch( args );
			if ( requireRequestSuccess && ! response.request_success ) {
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
			if ( isAbortError( error ) ) {
				throw error;
			}

			try {

				// Wait for ajaxRequest to resolve before continuing.
				return await ajaxRequest( method, path, data, auth, requestContext.signal );
			} catch ( ajaxError ) {
				if ( isAbortError( ajaxError ) ) {
					throw ajaxError;
				}

				generateError( ajaxError.message, args.path );
				throw ajaxError;
			}
		} finally {
			requestContext.finalize();
			if ( 'GET' === method ) {
				activeRequests.delete( requestKey );
			}
		}
	})();

	if ( 'GET' === method ) {
		activeRequests.set( requestKey, promise );
	}

	return promise;
};

const isDoActionFallbackPath = ( path = '' ) => {
	const writeFragments = [
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

const ajaxRequest = async(
	method,
	path,
	requestData = null,
	auth = getRequestAuth(),
	signal = undefined
) => {
	const ajaxUrl = getAjaxFallbackUrl( method, path );
	const url =
		'GET' === method ?
			`${ajaxUrl}&rest_action=${path.replace( '?', '&' )}` :
			ajaxUrl;

	const options = {
		method,
		headers: withRequestHeaders(
			{
				'Content-Type': 'application/json; charset=UTF-8'
			},
			auth
		),
		signal
	};

	if ( 'POST' === method ) {
		options.body = JSON.stringify({ path, data: requestData }, stripControls );
	}

	try {
		const response = await fetch( url, options ); // nosemgrep

		if ( ! response.ok ) {
			const responseText = await response.text();

			generateError(
				`AJAX request failed: ${response.status} ${response.statusText}`
			);

			throw new Error(
				`AJAX request failed: ${response.status} ${response.statusText}. Response: ${responseText}`
			);
		}

		const responseData = await response.json();

		if (
			! responseData.data ||
			! Object.prototype.hasOwnProperty.call(
				responseData.data,
				'request_success'
			)
		) {

			// Log for automated fallback test. Do not remove.
			console.log( 'Ajax fallback request failed.' );

			throw new Error(
				`AJAX response validation failed. Response: ${JSON.stringify( responseData )}`
			);
		}

		delete responseData.data.request_success;

		// return promise with the data object
		return Promise.resolve( responseData.data );
	} catch ( error ) {
		return Promise.reject(
			new Error(
				`AJAX request failed. ${error instanceof Error ? error.message : String( error )}`
			)
		);
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
		if ( ! response ) {
			return [];
		}

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
		if ( ! response ) {
			return [];
		}

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

export const getDatatableData = async( id, isEcommerce, startDate, endDate, range, args = {}) => {
	const { filters, metrics, group_by, selectedPages } = args;

	const queryParams = {
		date_start: startDate,
		date_end: endDate,
		date_range: range,
		nonce: burst_settings.burst_nonce,
		should_load_ecommerce: burst_settings.shouldLoadEcommerce || false,
		goal_id: args.goal_id,
		token: Math.random().toString( 36 ).replace( /[^a-z]+/g, '' ).substr( 0, 5 ) // nosemgrep
	};

	if ( selectedPages ) {
		queryParams.selected_pages = selectedPages;
	}
	if ( filters ) {
		queryParams.filters = filters;
	}
	if ( metrics ) {
		queryParams.metrics = metrics;
	}
	if ( group_by ) {
		queryParams.group_by = group_by;
	}

	const queryString = buildQueryString( queryParams );
	const endpoint = isEcommerce ? `data/ecommerce/datatable/${id}` : `data/datatable/${id}`;
	const path = `burst/v1/${endpoint}${glue()}${queryString}`;

	return await makeRequest( path, 'GET' );
};

/**
 * Get data from the REST API.
 *
 * @param {import('../types/api-endpoints').BurstDataType} type - Endpoint type (see `src/types/api-endpoints.ts`).
 * @param {string} startDate - Start date for the query.
 * @param {string} endDate   - End date for the query.
 * @param {string} range     - Date range slug.
 * @param {Object} [args={}] - Additional query parameters (filters, metrics, etc.).
 * @return {Promise<{ data: * }>} Response; `data` shape depends on `type`.
 */
export const getData = async( type, startDate, endDate, range, args = {}) => {

	// Extract filters and metrics from args if they exist.
	const { filters, metrics, group_by, currentView, selectedPages, id, chart_mode, distribution_view, product_id, compare_mode, compare_date_start, compare_date_end, page_url, least_engagement } = args;

	const queryParams = {
		date_start: startDate,
		date_end: endDate,
		date_range: range,
		nonce: burst_settings.burst_nonce,
		should_load_ecommerce: burst_settings.shouldLoadEcommerce || false,
		goal_id: args.goal_id,
		token: Math.random().toString( 36 ).replace( /[^a-z]+/g, '' ).substr( 0, 5 ) // nosemgrep
	};

	if ( selectedPages ) {
		queryParams.selected_pages = selectedPages;
	}
	if ( filters ) {
		queryParams.filters = filters;
	}
	if ( metrics ) {
		queryParams.metrics = metrics;
	}
	if ( group_by ) {
		queryParams.group_by = group_by;
	}
	if ( currentView ) {
		queryParams.currentView = currentView;
	}
	if ( chart_mode ) {
		queryParams.chart_mode = chart_mode;
	}
	if ( distribution_view ) {
		queryParams.distribution_view = distribution_view;
	}
	if ( product_id ) {
		queryParams.product_id = product_id;
	}
	if ( compare_mode ) {
		queryParams.compare_mode = compare_mode;
	}
	if ( compare_date_start ) {
		queryParams.compare_date_start = compare_date_start;
	}
	if ( compare_date_end ) {
		queryParams.compare_date_end = compare_date_end;
	}
	if ( id ) {
		queryParams.id = id;
	}
	if ( page_url ) {
		queryParams.page_url = page_url;
	}
	if ( least_engagement !== undefined ) {
		queryParams.least_engagement = least_engagement;
	}


	const queryString = buildQueryString( queryParams );
	const endpoint = `data/${type}`;
	const path = `burst/v1/${endpoint}${glue()}${queryString}`;

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

export const postChatMessage = ( message, history = [], model = '' ) =>
	doAction( 'chat', {
		message,
		history,
		...( model ? { model } : {})
	});

export const getChatStatus = () => doAction( 'chat_status' );

export const getAvailableModels = () => doAction( 'chat_models' );

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
