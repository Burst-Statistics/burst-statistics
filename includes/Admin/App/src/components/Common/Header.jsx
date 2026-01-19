import { Link, useSearch } from '@tanstack/react-router';
import { ReactComponent as Logo } from '@/../img/burst-logo.svg';
import { __, setLocaleData } from '@wordpress/i18n';
import ButtonInput from '../Inputs/ButtonInput';
import { burst_get_website_url } from '@/utils/lib';
import ProBadge from '@/components/Common/ProBadge';
import clsx from 'clsx';
import { useRef, useState, useEffect, useMemo } from 'react';
import useLicenseData from '@/hooks/useLicenseData';
import SubscriptionHeader from '../Common/Pro/SubscriptionHeader';
import useSettingsData from '@/hooks/useSettingsData';
import {useAttachmentUrl} from '@/hooks/useAttachmentUrl';
import useShareableLinkStore from '@/store/useShareableLinkStore';
import {
	isFilterEnabledRoute,
	FILTER_KEYS,
	TRAILING_PARAM_KEY
} from '@/hooks/useFilters';
import { useFiltersStore } from '@/store/useFiltersStore';

/**
 * Generates the URL for a given menu item.
 *
 * @param {Object} menuItem              - The menu item object.
 * @param {string} menuItem.id           - The ID of the menu item.
 * @param {string} menuItem.title        - The title of the menu item.
 * @param {Array}  [menuItem.menu_items] - Optional array of sub-menu items.
 *
 * @return {string} The generated URL for the menu item.
 */
const getMenuItemUrl = ( menuItem ) => {

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
};

/**
 * Header component. Renders the header section with logo, navigation menu, and action buttons.
 *
 * @return { JSX.Element } The rendered Header component.
 */
const Header = () => {
	const isShareableLinkViewer = useShareableLinkStore( ( state ) => state.isShareableLinkViewer );

	const menu = Array.isArray( burst_settings.menu ) ?
		burst_settings.menu :
		Object.values( burst_settings.menu );

	const { getValue } = useSettingsData();
	const logoId = getValue( 'logo_attachment_id' );
	const { data, isLoading } = useAttachmentUrl( logoId );
	const attachmentUrl = data?.attachmentUrl;
	const { isPro, isTrial } = useLicenseData();
	const activeClassName =
		'border-primary font-bold text-primary hover:border-primary hover:bg-primary-light';
	const linkClassName = clsx(
		'py-6 px-5',
		'max-sm:py-4.5 max-sm:px-3.5',
		'max-sm:py-4',
		'rounded-sm',
		'relative',
		'text-md',
		'border-b-4',
		'max-xxs:border-b-2',
		'hover:border-gray-500 hover:bg-gray-100',
		'transition-border duration-150',
		'transition-background duration-150'
	);

	const supportUrl = ! isPro ?
		'https://wordpress.org/support/plugin/burst-statistics/' :
		burst_get_website_url( '/support/', {
				utm_source: 'header',
				utm_content: 'support'
			});

	const upgradeUrl = isPro ?
		false :
		burst_get_website_url( '/pricing/', {
				utm_source: 'header',
				utm_content: 'upgrade-to-pro'
			});

	// load the chunk translations passed to us from the rsssl_settings object.
	// only works in build mode, not in dev mode.
	useEffect( () => {
		burst_settings.json_translations.forEach( ( translationsString ) => {
			const translations = JSON.parse( translationsString );
			const localeData =
				translations.locale_data['burst-statistics'] ||
				translations.locale_data.messages;
			localeData[''].domain = 'burst-statistics';
			setLocaleData( localeData, 'burst-statistics' );
		});
	}, []);

	return (
		<div className="bg-white shadow-sm">
			<SubscriptionHeader />
			<div className="mx-auto flex max-w-screen-2xl items-center gap-5 px-5 max-xxs:gap-0">
				<div className="max-xxs:w-16 max-xxs:h-auto max-xxs:hidden">
					<Link className="flex gap-3 align-middle" from="/" to="/">
						{isShareableLinkViewer && ! isLoading && attachmentUrl && (
							<img alt="logo" src={attachmentUrl} className="h-11 w-auto px-0 py-2" />
							)}
						{! isShareableLinkViewer && <Logo className="h-11 w-auto px-0 py-2"/>}
					</Link>
				</div>

				<div className="flex items-center flex-1 max-xxs:animate-scrollIndicator overflow-x-auto scrollbar-hide">
					{menu.map( ( menuItem ) => (
						<MenuItemLink
							key={menuItem.id}
							menuItem={menuItem}
							linkClassName={linkClassName}
							activeClassName={activeClassName}
							isTrial={isTrial}
						/>
					) )}
				</div>

				{ ! isShareableLinkViewer &&
					<div className="flex items-center gap-5">
						<ButtonInput
							className="max-xxs:hidden"
							link={{ to: supportUrl }}
							btnVariant="tertiary"
						>
							{__( 'Support', 'burst-statistics' )}
						</ButtonInput>

						{upgradeUrl && (
							<ButtonInput
								className="max-xxs:ml-4"
								link={{ to: upgradeUrl }}
								btnVariant="primary"
							>
								{__( 'Upgrade to Pro', 'burst-statistics' )}
							</ButtonInput>
						)}
					</div>
				}

			</div>
		</div>
	);
};

const MenuItemLink = ({ menuItem, linkClassName, activeClassName, isTrial }) => {
	const linkRef = useRef( null );
	const [ isActiveState, setIsActiveState ] = useState( false );
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

	useEffect( () => {
		if ( isActiveState && linkRef.current ) {
			const el = linkRef.current;

			// Scroll after a slight delay (same behavior as before)
			const t = setTimeout( () => {
				el.scrollIntoView({
					behavior: 'smooth',
					inline: 'center'
				});
			}, 1500 );

			return () => clearTimeout( t );
		}
	}, [ isActiveState ]); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<Link
			key={menuItem.id}
			from="/"
			ref={linkRef}
			onClick={( event ) => {
				const link = event.currentTarget;
				link.scrollIntoView({
					behavior: 'smooth',
					inline: 'center'
				});
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

				// Track active state in React state (valid)
				if ( isActive !== isActiveState ) {
					setIsActiveState( isActive );
				}

				return (
					<>
						{menuItem.title + ' '}
						{menuItem.pro && (
							<ProBadge
								type={isTrial ? 'icon' : 'badge'}
								label={__( 'Pro', 'burst-statistics' )}
								id={menuItem.id}
							/>
						)}
					</>
				);
			}}
		</Link>
	);
};


Header.displayName = 'Header';

export default Header;
