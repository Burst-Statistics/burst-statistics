import { Link, useLocation } from '@tanstack/react-router';
import clsx from 'clsx';
import { __ } from '@wordpress/i18n';
import { useAttachmentUrl } from '@/hooks/useAttachmentUrl';
import useBurstChunkTranslations from '@/hooks/useBurstChunkTranslations';
import useLicenseData from '@/hooks/useLicenseData';
import useSettingsData from '@/hooks/useSettingsData';
import useShareableLinkStore from '@/store/useShareableLinkStore';
import { burst_get_website_url } from '@/utils/lib';
import Icon from '@/utils/Icon';
import ButtonInput from '../Inputs/ButtonInput';
import SubscriptionHeader from '../Common/Pro/SubscriptionHeader';
import BurstLogo from './BurstLogo';
import MenuItemLink from './HeaderMenuItemLink';
import HeaderThemeMenu from './HeaderThemeMenu';
import TransparencyModal from './TransparencyModal';

const SHARE_LINK_BRANDING_URL = burst_get_website_url( '', {
	utm_source: 'share-link',
	utm_medium: 'header',
	utm_campaign: 'free-branding'
});

const LOGO_CLASS = 'h-11 w-auto px-0 py-2';

/**
 * Header component. Renders the header section with logo, navigation menu, and action buttons.
 *
 * @return { JSX.Element } The rendered Header component.
 */
const Header = () => {
	useBurstChunkTranslations();

	const location = useLocation();
	const isStory = '/story' === location.pathname;
	const isShareableLinkViewer = useShareableLinkStore( ( state ) => state.isShareableLinkViewer );
	const { isLicenseValidFor, isPro, isTrial } = useLicenseData();
	const shareLinkPro = isLicenseValidFor( 'share-link-advanced' );

	const menu = Array.isArray( burst_settings.menu ) ?
		burst_settings.menu :
		Object.values( burst_settings.menu );

	const { getValue } = useSettingsData();
	const logoId = getValue( 'logo_attachment_id' );
	const { data, isLoading } = useAttachmentUrl( logoId );
	const attachmentUrl = data?.attachmentUrl;
	const activeClassName = '!border-b-green !border-t-transparent !font-bold !text-green bg-gray-100';
	const linkClassName = clsx(
		'py-5 px-3.5',
		'rounded-sm',
		'relative',
		'text-md',
		'text-text-gray',
		'font-medium',
		'border-b-4 border-t-4 border-t-transparent border-b-transparent',
		'hover:border-b-gray-500 hover:bg-gray-100',
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

	const leftMenuItems = menu.filter( ( item ) => ! item.location || 'left' === item.location );
	const rightMenuItems = menu.filter( ( item ) => 'right' === item.location );
	if ( isStory ) {
		return null;
	}
	const isWhiteLabel = isShareableLinkViewer && shareLinkPro;
	return (
		<div className="bg-white shadow-sm">
			<SubscriptionHeader />
			<div className="mx-auto flex max-w-(--breakpoint-2xl) items-center gap-5 px-3 lg:px-10 max-xxs:gap-0 min-h-16">
				<div className="max-xxs:w-16 max-xxs:h-auto max-xxs:hidden pr-2">
					{isWhiteLabel && ! isLoading && attachmentUrl ? (
						<img
							alt="logo"
							src={attachmentUrl}
							className={LOGO_CLASS}
						/>
					) : isShareableLinkViewer ? (
						<a
							href={SHARE_LINK_BRANDING_URL}
							target="_blank"
							rel="noopener noreferrer"
						>
							<BurstLogo className={LOGO_CLASS} />
						</a>
					) : (
						<Link className="flex gap-3 align-middle" from="/" to="/">
							<BurstLogo className={LOGO_CLASS} />
						</Link>
					)}
				</div>

				<div className="max-xxs:hidden flex items-center flex-1">
					{leftMenuItems.map( ( menuItem ) => (
						<MenuItemLink
							key={'menu-item-link' + menuItem.id}
							menuItem={menuItem}
							linkClassName={linkClassName}
							activeClassName={activeClassName}
							isTrial={isTrial}
						/>
					) )}
				</div>

				{isShareableLinkViewer && ! isWhiteLabel && (
					<div className="flex items-center gap-4">
						<TransparencyModal />

						<a
							href={SHARE_LINK_BRANDING_URL}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-300 rounded-lg border border-primary/20 hover:border-primary/40 transition-all duration-200"
						>
							<span className="text-sm font-medium text-text-gray">
								{__( 'Data collected with', 'burst-statistics' )}{' '}
								<span className="text-primary font-semibold">
									Burst Statistics
								</span>
							</span>
						</a>
					</div>
				)}

				<div className="overflow-x-auto scrollbar-hide hidden max-xxs:block">
					<div className="flex flex-1 items-center animate-scrollIndicator">
						{leftMenuItems.map( ( menuItem ) => (
							<MenuItemLink
								key={'menu-item-link-' + menuItem.id}
								menuItem={menuItem}
								linkClassName={linkClassName}
								activeClassName={activeClassName}
								isTrial={isTrial}
							/>
						) )}

						{! isShareableLinkViewer &&
							rightMenuItems.map( ( menuItem ) => (
								<MenuItemLink
									key={'menu-item-link' + menuItem.id}
									menuItem={menuItem}
									linkClassName={linkClassName}
									activeClassName={activeClassName}
									isTrial={isTrial}
								/>
							) )}
					</div>
				</div>

				{! isShareableLinkViewer && (
					<div className="flex items-center gap-4 lg:gap-5">


						{upgradeUrl && (
							<>
								<ButtonInput
									className="max-xxs:ml-4"
									link={{ to: upgradeUrl }}
									btnVariant="primary"
								>
									<span className='flex items-center gap-1'>
										{__( 'Upgrade to Pro', 'burst-statistics' )}
										<Icon name="move-right" size={16} color="text-white" strokeWidth={2.5} />
									</span>
								</ButtonInput>
							</>
						)}

<a href={supportUrl} target="_blank" className="flex items-center text-text-gray gap-1 max-xxs:hidden hover:underline">

{__( 'Support', 'burst-statistics' )}
<Icon name="external-link" size={12} color="gray" />
</a>


								{/* separator */}
								<div className="max-xxs:hidden h-4 w-px bg-gray-300"></div>

<div className="max-xxs:hidden flex">
							{rightMenuItems.map( ( menuItem ) => (
								<MenuItemLink
									key={'menu-item-link-' + menuItem.id}
									menuItem={menuItem}
									linkClassName={linkClassName}
									activeClassName={activeClassName}
									isTrial={isTrial}
								/>
							) )}
						</div>


						<HeaderThemeMenu />

					</div>
				)}
			</div>
		</div>
	);
};

Header.displayName = 'Header';

export default Header;
