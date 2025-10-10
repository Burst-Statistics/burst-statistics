import { Link } from '@tanstack/react-router';
import { ReactComponent as Logo } from '@/../img/burst-logo.svg';
import { __, setLocaleData } from '@wordpress/i18n';
import ButtonInput from '../Inputs/ButtonInput';
import { burst_get_website_url } from '@/utils/lib';
import { useEffect } from '@wordpress/element';
import ProBadge from '@/components/Common/ProBadge';
import useLicenseStore from '@/store/useLicenseStore';
import clsx from 'clsx';
import { useRef } from 'react';

/* global burst_settings */

/**
 * Generates the URL for a given menu item.
 *
 * @param {Object} menuItem - The menu item object.
 * @param {string} menuItem.id - The ID of the menu item.
 * @param {string} menuItem.title - The title of the menu item.
 * @param {Array} [menuItem.menu_items] - Optional array of sub-menu items.
 *
 * @returns {string} The generated URL for the menu item.
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
 * @returns { JSX.Element } The rendered Header component.
 */
const Header = () => {
	const menu = burst_settings.menu;
	const { isLicenseValid, isPro } = useLicenseStore();
	const activeClassName = 'border-primary font-bold text-primary hover:border-primary hover:bg-primary-light';
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
		burst_get_website_url(
			'/support/',
			{
				utm_source: 'header',
				utm_content: 'support'
			}
		);

	const upgradeUrl = isPro ?
		false :
		burst_get_website_url(
			'/pricing/',
			{
				utm_source: 'header',
				utm_content: 'upgrade-to-pro'
			}
		);

	// load the chunk translations passed to us from the rsssl_settings object.
	// only works in build mode, not in dev mode.
	useEffect( () => {
		burst_settings.json_translations.forEach( ( translationsString ) => {
			let translations = JSON.parse( translationsString );
			let localeData =
				translations.locale_data['burst-statistics'] ||
				translations.locale_data.messages;
			localeData[''].domain = 'burst-statistics';
			setLocaleData( localeData, 'burst-statistics' );
		} );
	}, [] );

	return (
		<div className="bg-white shadow-sm">
			<div className="mx-auto flex max-w-screen-2xl items-center gap-5 px-5 max-xxs:gap-0">
				<div className='max-xxs:w-16 max-xxs:h-auto max-xxs:hidden'>
					<Link className='flex gap-3 align-middle' from="/" to="/">
						<Logo className="h-11 w-auto px-0 py-2" />
					</Link>
				</div>

				<div className="flex items-center flex-1 max-xxs:animate-scrollIndicator overflow-x-auto scrollbar-hide">
					{
						menu.map( ( menuItem ) => {
							const linkRef = useRef();
							return (
								<Link
									key = { menuItem.id }
									from = '/'
									ref = { linkRef }
									onClick = { ( event ) => {
										// When link is clicked scroll that into view.
										const link = event.currentTarget;
										link.scrollIntoView({
											behavior: "smooth",
											inline: "center"
										} )
									} }
									to = { getMenuItemUrl( menuItem ) }
									params = { { settingsId: menuItem.menu_items?.[0]?.id } }
									className = { linkClassName }
									activeOptions = { {
										// default options, maybe modify to fit our needs.
										exact: false,
										includeHash: false,
										includeSearch: true,
										explicitUndefined: false
								} }
									activeProps = { { className: activeClassName } }
								>
									{
										( { isActive } ) => {
											// Scroll the active link into view on initial render.
											useEffect( () => {
												if ( isActive && linkRef.current ) {
													// Scroll into view after some seconds.
													setTimeout( () => {
														linkRef.current.scrollIntoView( {
															behavior: "smooth",
															inline: "center"
														} )
													}, 1500 );
												}
											}, [] );

											return (
												<>
													{ menuItem.title }

													{ ( menuItem.pro && ! isLicenseValid() ) && <ProBadge className = 'ml-1' label = { __('Pro', 'burst-statistics') } /> }
												</>
											);
										}
									}
								</Link>
							);
						} )
					}
				</div>

				<div className="flex items-center gap-5">
					<ButtonInput className='max-xxs:hidden' link={ { to: supportUrl } } btnVariant="tertiary">
						{ __( 'Support', 'burst-statistics' ) }
					</ButtonInput>

					{ upgradeUrl && (
						<ButtonInput className='max-xxs:ml-4' link={ { to: upgradeUrl } } btnVariant="primary">
							{ __( 'Upgrade to Pro', 'burst-statistics' ) }
						</ButtonInput>
					)  }
				</div>
			</div>
		</div>
	);
};

Header.displayName = 'Header';

export default Header;
