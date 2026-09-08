/**
 * Utility functions for route detection and navigation context.
 */

/**
 * Check whether a given location path or window location is within the per-page context.
 * Strictly checks pathname or hash route prefix to avoid matching filter parameter values like /blog/page/2/.
 *
 * @param {string} [pathname] Optional location pathname.
 * @return {boolean} True if in per-page context.
 */
export const isPerPageRoute = ( pathname?: string ): boolean => {
	if ( pathname ) {
		return '/page' === pathname || pathname.startsWith( '/page/' );
	}
	if ( 'undefined' === typeof window ) {
		return false;
	}
	const hash = window.location.hash;
	return hash ? hash.startsWith( '#/page' ) : window.location.pathname.startsWith( '/page' );
};

const FILTER_ENABLED_ROUTES = [ '/statistics', '/engagement', '/sources', '/sales', '/table', '/page' ];

/**
 * Check whether a route path supports URL-based filters.
 *
 * @param {string} pathname Location pathname or hash route.
 * @return {boolean} True if filters are enabled for the route.
 */
export const isFilterEnabledRoute = ( pathname: string ): boolean => {
	return FILTER_ENABLED_ROUTES.some( ( route ) => pathname.startsWith( route ) );
};
