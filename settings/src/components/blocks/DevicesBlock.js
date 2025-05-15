import {__} from '@wordpress/i18n';
import {useState, useEffect, useRef} from '@wordpress/element';
import * as burst_api from '../../utils/api';
import {getPercentage} from '../../utils/formatting';
import Icon from '../../utils/Icon';
import ClickToFilter from './ClickToFilter';
import {useFiltersStore} from '../../store/useFiltersStore';
import {useDate} from '../../store/useDateStore';
import GridItem from '../common/GridItem';
import ExplanationAndStatsItem from '../common/ExplanationAndStatsItem';
import {useQuery} from '@tanstack/react-query';
import {getDevicesTitleAndValueData, getDevicesSubtitleData} from '../../api/getDevicesData';


const DevicesBlock = () => {
  const {startDate, endDate, range} = useDate( ( state ) => state );
  const filters = useFiltersStore( ( state ) => state.filters );
  const args = { 'filters': filters};

  const deviceNames = {
    'desktop': __( 'Desktop', 'burst-statistics' ),
    'tablet': __( 'Tablet', 'burst-statistics' ),
    'mobile': __( 'Mobile', 'burst-statistics' ),
    'other': __( 'Other', 'burst-statistics' )
  };
  let emptyDataTitleValue = {};
  let emptyDataSubtitle = {};
  let placeholderData = {};

// loop through metrics and set default values
  Object.keys( deviceNames ).forEach( function( key ) {
    emptyDataTitleValue[key] = {
      'title': deviceNames[key],
      'value': '-%'
    };
    emptyDataSubtitle[key] = {
      'subtitle': '-'
    };
    placeholderData[key] = {
      'title': deviceNames[key],
      'value': '-%',
      'subtitle': '-'
    };
  });
  const titleAndValueQuery = useQuery({
    queryKey: [ 'devicesTitleAndValue', startDate, endDate, args ],
    queryFn: () => getDevicesTitleAndValueData({startDate, endDate, range, args}),
    placeholderData: emptyDataTitleValue
  });

  const subtitleQuery = useQuery({
    queryKey: [ 'devicesSubtitle', startDate, endDate, args ],
    queryFn: () => getDevicesSubtitleData({startDate, endDate, range, args}),
    placeholderData: emptyDataSubtitle
  });

  let data = placeholderData;
  if ( titleAndValueQuery.data && subtitleQuery.data ) {
    data = {...titleAndValueQuery.data}; // Clone data to avoid mutation
    Object.keys( data ).forEach( ( key ) => {
      if ( subtitleQuery.data[key]) { // Check if it exists in subtitle data
        data[key] = { ...data[key], ...subtitleQuery.data[key] };
      }
    });
  }

  // const loading = query.isLoading || query.isFetching;
  const loading = titleAndValueQuery.isLoading || titleAndValueQuery.isFetching;

  let loadingClass = loading ? 'burst-loading' : '';

  return (
      <GridItem
          title={__( 'Devices', 'burst-statistics' )}
      >
        <div className={'burst-loading-container ' + loadingClass}>
          {Object.keys( data ).map( ( key, i ) => {
            let m = data[key];
            return (
                <ClickToFilter key={key} filter="device" filterValue={key}
                               label={m.title}>
                  <ExplanationAndStatsItem
                      iconKey={key}
                      title={m.title}
                      subtitle={m.subtitle}
                      value={m.value}
                      change={m.change}
                      changeStatus={m.changeStatus}
                  />
                </ClickToFilter>
            );
          })}
        </div>
      </GridItem>
  );
};

export default DevicesBlock;
