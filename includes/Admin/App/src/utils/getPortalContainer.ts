const PORTAL_SELECTORS = [
	'.overlay-portal-wrapper',
	'#modal-root',
	'#burst-statistics',
	'#burst-mainwp',
	'.burst'
];

/**
 * Resolve the container DOM element for Radix portals.
 *
 * Checks for an active overlay wrapper first, then falls back to modal-root,
 * plugin root containers, and finally the .burst wrapper.
 *
 * @return HTMLElement | undefined The container element or undefined if none found.
 */
const getPortalContainer = (): HTMLElement | undefined => {
	if ( 'undefined' === typeof document ) {
		return undefined;
	}

	return (
		PORTAL_SELECTORS.map( ( s ) => document.querySelector<HTMLElement>( s ) ).find( Boolean ) ||
		undefined
	);
};

export default getPortalContainer;
