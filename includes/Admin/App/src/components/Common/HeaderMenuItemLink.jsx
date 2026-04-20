import { Link, useSearch } from '@tanstack/react-router';
import { __ } from '@wordpress/i18n';
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import ProBadge from '@/components/Common/ProBadge';
import {
	isFilterEnabledRoute,
	FILTER_KEYS,
	TRAILING_PARAM_KEY
} from '@/hooks/useFilters';
import { useFiltersStore } from '@/store/useFiltersStore';
import Icon from '@/utils/Icon';

/**
 * Generates the URL for a given menu item.
 *
 * @param {Object} menuItem              - The menu item object.
 * @param {string} menuItem.id           - The ID of the menu item.
 * @param {string} menuItem.title        - The title of the menu item.
 * @param {string} [menuItem.icon]       - Optional Icon component name for the header label.
 * @param {Array}  [menuItem.menu_items] - Optional array of sub-menu items.
 *
 * @return {string} The generated URL for the menu item.
 */
export function getMenuItemUrl( menuItem ) {

	// If it's the dashboard, return root path.
	if ( 'dashboard' === menuItem.id ) {
		return '/';
	}

	// if menu item has sub-items, append first sub-item's ID to the URL.
	if ( menuItem.menu_items && 0 < menuItem.menu_items.length ) {
		return `/${menuItem.id}/$settingsId/`;
	}

	// Default case: just use the menu item's ID.
	return `/${menuItem.id}/`;
}

/**
 * Single top-level nav link with optional icon from menu config.
 *
 * @param {Object}  props
 * @param {Object}  props.menuItem
 * @param {string}  props.menuItem.id
 * @param {string}  props.menuItem.title
 * @param {string}  [props.menuItem.icon] - Registered `Icon` name when set in menu config.
 * @param {boolean} props.isTrial
 * @param {string}  props.linkClassName
 * @param {string}  props.activeClassName
 * @return {JSX.Element} Menu link.
 */
const MenuItemLink = ({ menuItem, linkClassName, activeClassName, isTrial }) => {
	const linkRef = useRef( null );
	const [ isActiveState, setIsActiveState ] = useState( false );
	const isActiveRef = useRef( false );
	const searchParams = useSearch({ strict: false });

	// Get saved filters from Zustand store (persisted across routes).
	const savedFilters = useFiltersStore( ( state ) => state.savedFilters );

	// Get the target URL for this menu item.
	const targetUrl = getMenuItemUrl( menuItem );

	// Check if target route is filter-enabled.
	const isTargetFilterEnabled = isFilterEnabledRoute( targetUrl );

	// Build search params to preserve when navigating to filter-enabled routes.
	const preservedSearch = useMemo( () => {
		if ( ! isTargetFilterEnabled ) {
			return undefined;
		}

		// First, try to extract filter params from current URL search.
		const filterParams = {};
		FILTER_KEYS.forEach( ( key ) => {
			if ( searchParams[key] && '' !== searchParams[key]) {
				filterParams[key] = searchParams[key];
			}
		});

		// If no filters in URL, fall back to saved filters from Zustand store.
		// This handles navigation from non-filter routes (like /settings/*) back to filter routes.
		if ( 0 === Object.keys( filterParams ).length && savedFilters ) {
			FILTER_KEYS.forEach( ( key ) => {
				if ( savedFilters[key] && '' !== savedFilters[key]) {
					filterParams[key] = savedFilters[key];
				}
			});
		}

		// Only return params if we have any filters to preserve.
		if ( 0 === Object.keys( filterParams ).length ) {
			return undefined;
		}

		// Add trailing param for URL parsing safety.
		filterParams[TRAILING_PARAM_KEY] = '';

		return filterParams;
	}, [ searchParams, isTargetFilterEnabled, savedFilters ]);

	// TanStack Link exposes `isActive` inside render props, so we mirror it to state.
	// Ref holds the latest value during render; syncing to state lets effects run after
	// activation for mobile horizontal scroll-into-view without fighting the router.
	useEffect( () => {
		if ( isActiveRef.current !== isActiveState ) {
			setIsActiveState( isActiveRef.current );
		}
	}, [ isActiveState ]);

	// Scroll active menu item into view after activation.
	useEffect( () => {
		if ( isActiveState && linkRef.current ) {
			const el = linkRef.current;
			const t = setTimeout( () => {
				el.scrollIntoView({ behavior: 'smooth', inline: 'center' });
			}, 1500 );
			return () => clearTimeout( t );
		}
	}, [ isActiveState ]); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<Link
			from="/"
			ref={linkRef}
			onClick={( event ) => {
				const link = event.currentTarget;
				link.scrollIntoView({ behavior: 'smooth', inline: 'center' });
			}}
			to={targetUrl}
			params={{
				settingsId: menuItem.menu_items?.[0]?.id
			}}
			search={preservedSearch}
			className={linkClassName}
			activeOptions={{
				exact: false,
				includeHash: false,
				includeSearch: true,
				explicitUndefined: false
			}}
			activeProps={{
				className: activeClassName
			}}
		>
			{({ isActive }) => {

				// Update ref during render (safe - does not trigger a state update directly).
				// eslint-disable-next-line react-compiler/react-compiler -- Ref is the supported way to mirror render-prop state for effects.
				isActiveRef.current = isActive;

				return (
					<span className="inline-flex items-center gap-1.5 text-base tracking-wide">
						{menuItem.icon && '' !== menuItem.icon && (
							<span aria-hidden="true" className="inline-flex shrink-0">
								<Icon name={menuItem.icon} size={14} color="gray" strokeWidth={2.5} />
							</span>
						)}
						<span>{menuItem.title}</span>
						{menuItem.pro && (
							<ProBadge
								type={isTrial ? 'icon' : 'badge'}
								label={__( 'Pro', 'burst-statistics' )}
								id={menuItem.id}
								hasLink={false}
							/>
						)}
					</span>
				);
			}}
		</Link>
	);
};

MenuItemLink.displayName = 'MenuItemLink';

export default MenuItemLink;
