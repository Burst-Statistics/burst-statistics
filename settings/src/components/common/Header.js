import {__} from '@wordpress/i18n';
import {useMenu} from '../../store/useMenuStore';
import {useEffect, useRef} from '@wordpress/element';
import {burst_get_website_url} from '../../utils/lib';

const Header = () => {
  const menu = useMenu( ( state ) => state.menu );
  const menuLoaded = useMenu( ( state ) => state.menuLoaded );
  const selectedMainMenuItem = useMenu( ( state ) => state.selectedMainMenuItem );
  const fetchMainMenuData = useMenu( ( state ) => state.fetchMainMenuData );
  const plugin_url = burst_settings.plugin_url;
  const support_url = ! burst_settings.is_pro ? 'https://wordpress.org/support/plugin/burst-statistics/' :  burst_get_website_url( '/support/', {
    burst_source: 'header',
    burst_content: 'support'
  });
  const firstUpdate = useRef( true );

  useEffect( () => {
    if ( firstUpdate.current ) {
      fetchMainMenuData();
      firstUpdate.current = false;
      return;
    }
  }, []);
  let menuItems = Object.values( menu );
  menuItems = menuItems.filter( item => null !== item ); // Remove null values

  return (
      <div className="burst-header-container">
        <div className="burst-header">
          <img className="burst-logo"
               src={plugin_url + 'assets/img/burst-logo.svg'}
               alt="Burst Statistics Logo"/>
          <div className="burst-header-left">
            <nav className="burst-header-menu">
              <ul>
                {menuLoaded && menuItems.map( ( menu_item, i ) =>
                    <li key={i}><a className={ selectedMainMenuItem === menu_item.id ? 'burst-main active' : 'burst-main' } href={'#' + menu_item.id.toString()} >{menu_item.title}</a></li> )}
              </ul>
            </nav>
          </div>
          <div className="burst-header-right">
            <a href={support_url}
               className={'burst-button burst-button--secondary'}
               target="_blank" rel="noreferrer">{__( 'Support', 'burst-statistics' )}</a>
            {! burst_settings.is_pro &&
              <a href={burst_get_website_url( '/pricing/', {
                burst_source: 'header',
                burst_content: 'upgrade-to-pro'
              })}
                  className={'burst-button burst-button--pro'}
                  target="_blank" rel="noreferrer">{__( 'Upgrade to Pro', 'burst-statistics' )}</a>
            }
          </div>
        </div>
      </div>
  );
};
export default Header;
