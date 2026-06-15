import * as Dialog from '@radix-ui/react-dialog';
import { Link, useLocation } from '@tanstack/react-router';
import clsx from 'clsx';
import { __ } from '@wordpress/i18n';
import { useEffect, useState } from '@wordpress/element';
import ProBadge from '@/components/Common/ProBadge';
import Icon from '@/utils/Icon';
import MenuItemLink from './HeaderMenuItemLink';
import ButtonInput from '../Inputs/ButtonInput';

/** Top-level menu IDs that expand into a dropdown in the mobile drawer. */
const DRAWER_DROPDOWN_IDS = new Set([ 'reporting', 'settings' ]);

/** Tailwind classes for top-level drawer nav items. */
const DRAWER_LINK_CLASS = 'block w-full px-4 py-3 text-md font-medium text-text-gray rounded-md hover:bg-gray-100 transition-colors duration-150';
const DRAWER_ACTIVE_CLASS = '!bg-primary-light !text-green !font-semibold';

/** Tailwind classes for sub-navigation items inside the drawer. */
const DRAWER_SUB_LINK_CLASS = 'flex items-center gap-2 w-full pl-9 pr-4 py-2 text-sm font-medium text-text-gray rounded-md hover:bg-gray-100 transition-colors duration-150';
const DRAWER_SUB_ACTIVE_CLASS = '!bg-primary-light !text-green !font-semibold';

/**
 * Returns the absolute route path for a sub-menu item.
 *
 * Settings uses a trailing slash per its TanStack route definition;
 * all other pages (reporting, etc.) do not.
 *
 * @param {string} parentId  - Top-level menu item ID (e.g. 'settings', 'reporting').
 * @param {string} subItemId - Sub-menu item ID (e.g. 'general', 'reports').
 * @return {string} Absolute route path.
 */
const getSubItemPath = ( parentId, subItemId ) => {
	if ( 'settings' === parentId ) {
		return `/settings/${ subItemId }/`;
	}
	return `/${ parentId }/${ subItemId }`;
};

/**
 * Returns visible sub-menu items for a menu item.
 *
 * @param {Object} menuItem - Parent menu item with a `menu_items` array.
 * @return {Array} Visible sub-menu items.
 */
const getVisibleSubItems = ( menuItem ) => {
	return ( menuItem.menu_items ?? []).filter( ( item ) => ! item.hidden );
};

/**
 * Whether a sub-menu route matches the current pathname.
 *
 * @param {string} pathname  - Current route pathname.
 * @param {string} parentId  - Top-level menu item ID.
 * @param {string} subItemId - Sub-menu item ID.
 * @return {boolean} True when the sub-item route is active.
 */
const isSubItemPathActive = ( pathname, parentId, subItemId ) => {
	const normalizedPath = getSubItemPath( parentId, subItemId ).replace( /\/$/, '' );
	const normalizedLocation = pathname.replace( /\/$/, '' );

	return normalizedLocation.startsWith( normalizedPath );
};

/**
 * Whether a menu item should render as a mobile drawer dropdown.
 *
 * @param {Object} menuItem - Menu item from burst_settings.menu.
 * @return {boolean} True when the item uses a non-clickable dropdown trigger.
 */
const hasDrawerDropdown = ( menuItem ) => {
	if ( ! DRAWER_DROPDOWN_IDS.has( menuItem.id ) ) {
		return false;
	}

	return 0 < getVisibleSubItems( menuItem ).length;
};

/**
 * Renders indented sub-navigation links for a menu item that has sub-pages.
 *
 * Mirrors the desktop SubNavigation sidebar: hidden items are filtered out,
 * icons are shown when present, and the active link receives brand-green styling.
 *
 * @param {Object}   props
 * @param {Object}   props.menuItem   - Parent menu item with a `menu_items` array.
 * @param {Function} props.onNavigate - Called after tapping a link to close the drawer.
 * @return {JSX.Element|null} List of sub-item links, or null if there are none.
 */
const DrawerSubItems = ({ menuItem, onNavigate }) => {
	const visibleItems = getVisibleSubItems( menuItem );

	if ( 0 === visibleItems.length ) {
		return null;
	}

	return (
		<ul className="mt-1 space-y-0.5" role="list">
			{visibleItems.map( ( subItem ) => (
				<li key={'drawer-sub-' + menuItem.id + '-' + subItem.id}>
					<Link
						to={getSubItemPath( menuItem.id, subItem.id )}
						className={DRAWER_SUB_LINK_CLASS}
						activeProps={{ className: DRAWER_SUB_ACTIVE_CLASS }}
						activeOptions={{ exact: false, includeSearch: false, includeHash: false }}
						onClick={onNavigate}
					>
						{subItem.icon && '' !== subItem.icon && (
							<span aria-hidden="true" className="inline-flex shrink-0">
								<Icon name={subItem.icon} size={13} color="gray" strokeWidth={2.5} />
							</span>
						)}
						<span className="min-w-0">{subItem.title}</span>
					</Link>
				</li>
			) )}
		</ul>
	);
};

DrawerSubItems.displayName = 'DrawerSubItems';

/**
 * Renders a non-clickable dropdown trigger with collapsible sub-navigation links.
 *
 * Used in the mobile drawer for Reporting and Settings so users pick a sub-page
 * instead of navigating to the parent route.
 *
 * @param {Object}   props
 * @param {Object}   props.menuItem   - Parent menu item with sub-pages.
 * @param {boolean}  props.isTrial    - Whether the license is a trial.
 * @param {Function} props.onNavigate - Called after tapping a sub-link to close the drawer.
 * @return {JSX.Element|null} Dropdown section, or null when there are no visible sub-items.
 */
const DrawerDropdownSection = ({ menuItem, isTrial, onNavigate }) => {
	const location = useLocation();
	const visibleItems = getVisibleSubItems( menuItem );
	const hasActiveChild = visibleItems.some( ( subItem ) =>
		isSubItemPathActive( location.pathname, menuItem.id, subItem.id )
	);
	const [ isExpanded, setIsExpanded ] = useState( hasActiveChild );
	const contentId = `drawer-dropdown-${ menuItem.id }`;

	useEffect( () => {
		if ( hasActiveChild ) {
			setIsExpanded( true );
		}
	}, [ hasActiveChild, location.pathname ]);

	if ( 0 === visibleItems.length ) {
		return null;
	}

	return (
		<div>
			<button
				type="button"
				id={`${ contentId }-trigger`}
				aria-expanded={isExpanded}
				aria-controls={contentId}
				onClick={() => setIsExpanded( ( open ) => ! open )}
				className={clsx(
					DRAWER_LINK_CLASS,
					'flex w-full items-center justify-between gap-2 text-left',
					hasActiveChild && DRAWER_ACTIVE_CLASS
				)}
			>
				<span className="inline-flex min-w-0 items-center gap-1.5 text-base tracking-wide">
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
				<Icon
					name="chevron-down"
					size={16}
					className={clsx(
						'shrink-0 transition-transform duration-150',
						isExpanded && 'rotate-180'
					)}
				/>
			</button>

			{isExpanded && (
				<div id={contentId} role="region" aria-labelledby={`${ contentId }-trigger`}>
					<DrawerSubItems menuItem={menuItem} onNavigate={onNavigate} />
				</div>
			)}
		</div>
	);
};

DrawerDropdownSection.displayName = 'DrawerDropdownSection';

/**
 * Renders a single mobile drawer nav item as either a link or a dropdown section.
 *
 * @param {Object}   props
 * @param {Object}   props.menuItem   - Menu item from burst_settings.menu.
 * @param {boolean}  props.isTrial    - Whether the license is a trial.
 * @param {Function} props.onNavigate - Called after navigation to close the drawer.
 * @return {JSX.Element} Drawer menu item.
 */
const DrawerMenuItem = ({ menuItem, isTrial, onNavigate }) => {
	if ( hasDrawerDropdown( menuItem ) ) {
		return (
			<DrawerDropdownSection
				menuItem={menuItem}
				isTrial={isTrial}
				onNavigate={onNavigate}
			/>
		);
	}

	return (
		<MenuItemLink
			menuItem={menuItem}
			linkClassName={DRAWER_LINK_CLASS}
			activeClassName={DRAWER_ACTIVE_CLASS}
			isTrial={isTrial}
			variant="drawer"
			onNavigate={onNavigate}
		/>
	);
};

DrawerMenuItem.displayName = 'DrawerMenuItem';

/**
 * Mobile navigation drawer.
 *
 * Renders a hamburger trigger button (hidden on desktop) and a full-height
 * slide-in panel containing primary tabs, their sub-pages (e.g. Reporting),
 * secondary links (Settings with sub-pages, Support), and an optional upgrade CTA.
 *
 * @param {Object}   props
 * @param {Array}    props.leftMenuItems  - Primary nav items (left-aligned on desktop).
 * @param {Array}    props.rightMenuItems - Secondary nav items (right-aligned on desktop).
 * @param {string}   props.supportUrl     - URL for the support link.
 * @param {string}   [props.upgradeUrl]   - URL for the upgrade CTA; falsy when already Pro.
 * @param {boolean}  props.isTrial        - Whether the license is a trial.
 * @return {JSX.Element} The mobile drawer component.
 */
const MobileMenuDrawer = ({ leftMenuItems, rightMenuItems, supportUrl, upgradeUrl, isTrial }) => {
	const [ isOpen, setIsOpen ] = useState( false );

	/**
	 * Close the drawer after navigation.
	 *
	 * @return {void}
	 */
	const handleNavigate = () => setIsOpen( false );

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			{/* Hamburger trigger — only visible on smaller screens (<1024px). */}
			<Dialog.Trigger asChild>
				<button
					type="button"
					aria-label={__( 'Open navigation menu', 'burst-statistics' )}
					className="@lg:hidden inline-flex items-center justify-center rounded-md p-2 text-text-gray hover:bg-gray-100 transition-colors duration-150"
				>
					<Icon name="menu" size={22} />
				</button>
			</Dialog.Trigger>

			{/*
			 * Portal renders into #modal-root which lives inside #burst-statistics.
			 * Combined with position:relative on #burst-statistics, the absolute-
			 * positioned overlay and panel are contained within the plugin area.
			 */}
			<Dialog.Portal container={document.getElementById( 'modal-root' )}>
				{/* Backdrop overlay — covers the app container. */}
				<Dialog.Overlay className="absolute inset-0 z-40 bg-black/40 data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut" />

				{/* Drawer panel — slides in from the right edge of the app container. */}
			<Dialog.Content
				className="absolute top-0 right-0 z-50 flex h-full max-h-dvh w-[85%] max-w-sm flex-col bg-white shadow-layered-high-b data-[state=open]:animate-drawerSlideIn data-[state=closed]:animate-drawerSlideOut focus:outline-hidden"
					aria-label={__( 'Navigation menu', 'burst-statistics' )}
				>
					{/* Drawer header: close button only. */}
					<div className="flex items-center justify-end border-b border-gray-200 px-4 py-3 shrink-0">
						<Dialog.Close asChild>
							<button
								type="button"
								aria-label={__( 'Close navigation menu', 'burst-statistics' )}
								className="inline-flex items-center justify-center rounded-md p-2 text-text-gray hover:bg-gray-100 transition-colors duration-150"
							>
								<Icon name="close" size={18} />
							</button>
						</Dialog.Close>
					</div>

					{/* All nav content flows from top; scrollable on small screens. */}
					<div className="flex-1 overflow-y-auto px-3 py-4">

						{/* Primary navigation — includes sub-pages for items like Reporting. */}
						<nav>
							<ul className="space-y-1" role="list">
								{leftMenuItems.map( ( menuItem ) => (
									<li key={'drawer-item-' + menuItem.id}>
										<DrawerMenuItem
											menuItem={menuItem}
											isTrial={isTrial}
											onNavigate={handleNavigate}
										/>
									</li>
								) )}
							</ul>
						</nav>

						{/* Subtle divider between primary and secondary links. */}
						<div className="my-3 border-t border-gray-100" />

						{/* Secondary links: Settings (with sub-pages) + Support. */}
						<div className="space-y-1">
							{rightMenuItems.map( ( menuItem ) => (
								<div key={'drawer-secondary-' + menuItem.id}>
									<DrawerMenuItem
										menuItem={menuItem}
										isTrial={isTrial}
										onNavigate={handleNavigate}
									/>
								</div>
							) )}

							<a
								href={supportUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-1.5 w-full px-4 py-3 text-md font-medium text-text-gray rounded-md hover:bg-gray-100 transition-colors duration-150"
							>
								{__( 'Support', 'burst-statistics' )}
								<Icon name="external-link" size={12} color="gray" />
							</a>
						</div>

						{/* Upgrade CTA (non-Pro only, upgradeUrl is falsy when Pro). */}
						{upgradeUrl && (
							<div className="mt-3 px-1">
								<ButtonInput
									link={{ to: upgradeUrl }}
									btnVariant="primary"
									className="w-full justify-center"
								>
									<span className="flex items-center gap-1">
										{__( 'Upgrade to Pro', 'burst-statistics' )}
										<Icon
											name="move-right"
											size={14}
											color="text-white"
											strokeWidth={2.5}
										/>
									</span>
								</ButtonInput>
							</div>
						)}
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
};

MobileMenuDrawer.displayName = 'MobileMenuDrawer';

export default MobileMenuDrawer;
