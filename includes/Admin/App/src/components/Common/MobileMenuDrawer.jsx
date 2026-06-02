import * as Dialog from '@radix-ui/react-dialog';
import { Link } from '@tanstack/react-router';
import { __ } from '@wordpress/i18n';
import { useState } from '@wordpress/element';
import Icon from '@/utils/Icon';
import BurstLogo from './BurstLogo';
import MenuItemLink from './HeaderMenuItemLink';
import ButtonInput from '../Inputs/ButtonInput';

const LOGO_CLASS = 'h-8 w-auto';

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
	const visibleItems = ( menuItem.menu_items ?? []).filter( ( item ) => ! item.hidden );

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
					className="lg:hidden inline-flex items-center justify-center rounded-md p-2 text-text-gray hover:bg-gray-100 transition-colors duration-150"
				>
					<Icon name="menu" size={22} color="gray" />
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
					{/* Drawer header: logo + close button. */}
					<div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 shrink-0">
						<BurstLogo className={LOGO_CLASS} />
						<Dialog.Close asChild>
							<button
								type="button"
								aria-label={__( 'Close navigation menu', 'burst-statistics' )}
								className="inline-flex items-center justify-center rounded-md p-2 text-text-gray hover:bg-gray-100 transition-colors duration-150"
							>
								<Icon name="close" size={18} color="gray" />
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
										<MenuItemLink
											menuItem={menuItem}
											linkClassName={DRAWER_LINK_CLASS}
											activeClassName={DRAWER_ACTIVE_CLASS}
											isTrial={isTrial}
											variant="drawer"
											onNavigate={handleNavigate}
										/>
										<DrawerSubItems menuItem={menuItem} onNavigate={handleNavigate} />
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
									<MenuItemLink
										menuItem={menuItem}
										linkClassName={DRAWER_LINK_CLASS}
										activeClassName={DRAWER_ACTIVE_CLASS}
										isTrial={isTrial}
										variant="drawer"
										onNavigate={handleNavigate}
									/>
									<DrawerSubItems menuItem={menuItem} onNavigate={handleNavigate} />
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
