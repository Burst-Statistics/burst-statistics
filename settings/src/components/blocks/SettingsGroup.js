import Field from './Field';
import Hyperlink from '../../utils/Hyperlink';
import {__} from '@wordpress/i18n';
import {useMenu} from '../../store/useMenuStore';
import useLicenseStore from '../../store/useLicenseStore';
import {burst_get_website_url} from '../../utils/lib';

import ErrorBoundary from '../ErrorBoundary';

/**
 * Render a grouped block of settings
 */
const SettingsGroup = ( props ) => {
  let upgrade = burst_get_website_url( '/pricing/', {
    burst_source: 'settings-group',
    burst_content: 'upgrade'
  });
  const subMenu = useMenu( state => state.subMenu );
  const selectedSubMenuItem = useMenu( state => state.selectedSubMenuItem );
  const {licenseStatus} = useLicenseStore();

  let selectedFields = [];

  //get all fields with group_id props.group_id
  for ( const selectedField of props.fields ) {
    if ( selectedField.group_id === props.group ) {
      selectedFields.push( selectedField );
    }
  }

  let activeGroup;

  //first, set the selected menu item as active group, so we have a default in
  // case there are no groups
  for ( const item of subMenu.menu_items ) {
    if ( item.id === selectedSubMenuItem ) {
      activeGroup = item;
    } else if ( item.menu_items ) {
      activeGroup = item.menu_items.filter(
          menuItem => menuItem.id === selectedSubMenuItem )[0];
    }
    if ( activeGroup ) {
      break;
    }
  }

  //now check if we have actual groups
  for ( const item of subMenu.menu_items ) {
    if ( item.id === selectedSubMenuItem && item.hasOwnProperty( 'groups' ) ) {
      let currentGroup = item.groups.filter( group => group.id === props.group );
      if ( 0 < currentGroup.length ) {
        activeGroup = currentGroup[0];
      }
    }
  }

  let status = 'invalid';
  if ( ! activeGroup ) {
    return ( <></> );
  }
  let msg = activeGroup.pro_text ? activeGroup.pro_text : __(
      'Learn more about %sPro%s', 'burst-statistics' );
  if ( burst_settings.is_pro ) {
    status = licenseStatus;
    if ( 'empty' === status || 'deactivated' === status ) {
      msg = burst_settings.messageInactive;
    } else {
      msg = burst_settings.messageInvalid;
    }
  }
  let disabled = 'valid' !== status && activeGroup.pro;

  //if a feature can only be used on networkwide or single site setups, pass
  // that info here.
  upgrade = activeGroup.upgrade ? activeGroup.upgrade : upgrade;
  let helplinkText = activeGroup.helpLink_text ? activeGroup.helpLink_text : __(
      'Instructions', 'burst-statistics' );
  let disabledClass = disabled ? 'burst-disabled' : '';
  return (
      <ErrorBoundary fallback={'Could not load page'}>
        <div className={'burst-grid-item burst-' + activeGroup.id + ' ' +
            disabledClass}>
          {activeGroup.title && <div className="burst-grid-item-header">
            <h3 className="burst-h4">{activeGroup.title}</h3>
            {activeGroup.helpLink &&
                <div className="burst-grid-item-controls"><Hyperlink
                    target="_blank" className="burst-helplink"
                    text={helplinkText} url={activeGroup.helpLink}/></div>}
          </div>}
          <div className="burst-grid-item-content">
            {activeGroup.intro && <div
                className="burst-settings-block-intro">{activeGroup.intro}</div>}
            {selectedFields.map( ( field, i ) =>
                <ErrorBoundary key={i} fallback={'Could ot load field'}>
                  <Field key={i} index={i} field={field}
                         fields={selectedFields}/>
                </ErrorBoundary> )}
          </div>
          {disabled && <div className="burst-locked">
            <div className="burst-locked-overlay">
              <span className="burst-task-status burst-pro">{__( 'Upgrade',
                  'burst-statistics' )}</span>
              <span>
						{burst_settings.is_pro &&
                <span>{msg}&nbsp;<a className="burst-locked-link"
                                    href="#settings/license">{__(
                    'Check license', 'burst-statistics' )}</a></span>}
                {! burst_settings.is_pro &&
                    <Hyperlink target="_blank" text={msg} url={upgrade}/>}
					</span>
            </div>
          </div>}
        </div>
      </ErrorBoundary>
  );

};

export default SettingsGroup;
