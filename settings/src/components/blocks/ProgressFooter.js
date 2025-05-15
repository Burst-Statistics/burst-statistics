import {useState, useEffect, useMemo} from '@wordpress/element';
import * as burst_api from '../../utils/api';
import {__} from '@wordpress/i18n';
import Icon from '../../utils/Icon';
import Tooltip from '../common/Tooltip';
import {getRelativeTime} from '../../utils/formatting';

const ProgressFooter = ( props ) => {
  let [ trackingType, setTrackingType ] = useState( 'loading' ); // loading, error,
                                                             // rest, endpoint,
                                                             // disabled
  let [ lastChecked, setLastChecked ] = useState( 0 );
  useMemo( () => {
    burst_api.doAction( 'tracking' ).then( ( response ) => {
      if ( 'beacon' === response.status || 'rest' === response.status ||
          'disabled' === response.status ) {
        let status = response.status ? response.status : 'error';
        let last_test = response.last_test ? response.last_test : __( 'Just now',
            'burst-statistics' );
        setTrackingType( status );
        setLastChecked( last_test );
      } else {
        setTrackingType( 'error' );
        setLastChecked( false );
      }
    });
  }, []);

  let trackingLastCheckedText = __( 'Last checked:', 'burst-statistics' ) + ' ' +
      getRelativeTime( new Date( lastChecked * 1000 ) ); // times 1000 because JS
                                                     // uses milliseconds
  let trackingTexts = {
    'loading': __( 'Loading tracking status...', 'burst-statistics' ),
    'error': __( 'Error checking tracking status', 'burst-statistics' ),
    'rest': __( 'Tracking with REST API', 'burst-statistics' ),
    'beacon': __( 'Tracking with an endpoint', 'burst-statistics' ),
    'disabled': __( 'Tracking is disabled', 'burst-statistics' )
  };
  let trackingTooltipTexts = {
    'loading': '',
    'error': __(
        'Tracking does not seem to work. Check manually or contact support.',
        'burst-statistics' ),
    'rest': __(
        'Tracking is working. You are using the REST API to collect statistics.',
        'burst-statistics' ),
    'beacon': __(
        'Tracking is working. You are using the Burst endpoint to collect statistics. This type of tracking is accurate and lightweight.',
        'burst-statistics' ),
    'disabled': __( 'Tracking is disabled', 'burst-statistics' )
  };
  let trackingIcons = {
    'loading': {
      'icon': 'loading',
      'color': 'black'
    },
    'error': {
      'icon': 'circle-times',
      'color': 'red'
    },
    'rest': {
      'icon': 'circle-check',
      'color': 'green'
    },
    'beacon': {
      'icon': 'circle-check',
      'color': 'green'
    },
    'disabled': {
      'icon': 'circle-times',
      'color': 'red'
    }
  };
  let trackingTooltipText = trackingTooltipTexts[trackingType] + ' ' +
      trackingLastCheckedText;
  let trackingText = trackingTexts[trackingType];
  let trackingIcon = trackingIcons[trackingType].icon;
  let trackingIconColor = trackingIcons[trackingType].color;
  let redirectToStatistics = ( e ) => {
    props.selectMainMenu( 'statistics' );
  };

  return (
      <>
      <a className={'burst-button burst-button--secondary'}
         href={'#statistics'}>{__( 'View my statistics', 'burst-statistics' )}</a>
      <Tooltip content={trackingTooltipText}>
      <div
          className="burst-legend burst-flex-push-right burst-tooltip-trackingtext"
         >
        <Icon name={trackingIcon} color={trackingIconColor}/>
        <div>{trackingText}</div>
      </div>
      </Tooltip>
</>
)
  ;
};

export default ProgressFooter;
