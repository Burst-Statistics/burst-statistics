import { Link } from '@tanstack/react-router';
import { ReactComponent as Logo } from '@/../img/burst-logo.svg';
import { __, setLocaleData } from '@wordpress/i18n';
import ButtonInput from '../Inputs/ButtonInput';
import { burst_get_website_url } from '@/utils/lib';
import { useEffect } from '@wordpress/element';
import ProBadge from '@/components/Common/ProBadge';
import useLicenseStore from '@/store/useLicenseStore';

const Header = () => {
  const { isPro } = useLicenseStore();
  const menu = burst_settings.menu;
  const { isLicenseValid } = useLicenseStore();
  const activeClassName =
    'border-primary font-bold text-primary hover:border-primary hover:bg-primary-light';
  const linkClassName = [
    'py-6 px-5',
    'rounded-sm',
    'relative',
    'text-md',
    'border-b-4 border-transparent',
    'hover:border-gray-500 hover:bg-gray-100',
    'transition-border duration-150',
    'transition-background duration-150'
  ].join( ' ' );

  const supportUrl = ! isPro ?
    'https://wordpress.org/support/plugin/burst-statistics/' :
    burst_get_website_url( '/support/', {
        burst_source: 'header',
        burst_content: 'support'
      });
  const upgradeUrl = isPro ?
    false :
    burst_get_website_url( '/pricing/', {
        burst_source: 'header',
        burst_content: 'upgrade-to-pro'
      });

  const getMenuItemUrl = ( menuItem ) => {

    // If it's the dashboard, return root path
    if ( 'dashboard' === menuItem.id ) {
      return '/';
    }

    // if menu item has sub-items, append first sub-item's ID to the URL
    if ( menuItem.menu_items && 0 < menuItem.menu_items.length ) {
      return `/${menuItem.id}/$settingsId/`;
    }

    // Default case: just use the menu item's ID
    return `/${menuItem.id}/`;
  };

  //load the chunk translations passed to us from the rsssl_settings object
  //only works in build mode, not in dev mode.
  useEffect( () => {
    burst_settings.json_translations.forEach( ( translationsString ) => {
      let translations = JSON.parse( translationsString );
      let localeData =
        translations.locale_data['burst-statistics'] ||
        translations.locale_data.messages;
      localeData[''].domain = 'burst-statistics';
      setLocaleData( localeData, 'burst-statistics' );
    });
  }, []);

  return (
    <div className="bg-white">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-5 px-5">
        <div>
          <Link className={'flex gap-3 align-middle'} from="/" to="/">
            <Logo className="h-11 w-auto px-0 py-2" />
          </Link>
        </div>
        <div className="flex items-center">
          {menu.map( ( menuItem ) => (
            <Link
              key={menuItem.id}
              from={'/'}
              to={getMenuItemUrl( menuItem )}
              params={{ settingsId: menuItem.menu_items?.[0]?.id }}
              className={linkClassName}
              activeOptions={{

                // default options, maybe modify to fit our needs
                exact: false,
                includeHash: false,
                includeSearch: true,
                explicitUndefined: false
              }}
              activeProps={{ className: activeClassName }}
            >
              {__( menuItem.title, 'burst-statistics' )}
              { (menuItem.pro && ! isLicenseValid() ) && <ProBadge className={'ml-1'} label={'Pro'} />}
            </Link>
          ) )}
        </div>
        <div className="float-right ml-auto flex items-center gap-5">
          <ButtonInput link={{ to: supportUrl }} btnVariant="tertiary">
            {__( 'Support', 'burst-statistics' )}
          </ButtonInput>
          {upgradeUrl && (
            <ButtonInput link={{ to: upgradeUrl }} btnVariant="primary">
              {__( 'Upgrade to Pro', 'burst-statistics' )}
            </ButtonInput>
          )}
        </div>
      </div>
    </div>
  );
};

Header.displayName = 'Header';

export default Header;
