import {__} from '@wordpress/i18n';
import Tooltip from '../common/Tooltip';
import { useQueries } from '@tanstack/react-query';
import getLiveVisitors from '../../api/getLiveVisitors';
import getTodayData from '../../api/getTodayData';

import Icon from '../../utils/Icon';
import {endOfDay, format, startOfDay} from 'date-fns';
import GridItem from '../common/GridItem';
import {getDateWithOffset} from '../../utils/formatting';
import {memo, useState, useEffect} from '@wordpress/element';
import {safeDecodeURI} from '../../utils/lib';

function selectVisitorIcon( value ) {
  value = parseInt( value );
  if ( 100 < value ) {
    return 'visitors-crowd';
  } else if ( 10 < value ) {
    return 'visitors';
  } else {
    return 'visitor';
  }
}

const TodayBlock = () => {
  const [ interval, setInterval ] = useState( 5000 );
  const currentDateWithOffset = getDateWithOffset();
  const startDate = format( startOfDay( currentDateWithOffset ), 'yyyy-MM-dd' );
  const endDate = format( endOfDay( currentDateWithOffset ), 'yyyy-MM-dd' );
  const [refetchCount, setRefetchCount] = useState(0);

  const placeholderData = {
    live: {
      title: __( 'Live', 'burst-statistics' ),
      icon: 'visitor'
    },
    today: {
      title: __( 'Total', 'burst-statistics' ),
      value: '-',
      icon: 'visitor'
    },
    mostViewed: {
      title: '-',
      value: '-'
    },
    pageviews: {
      title: '-',
      value: '-'
    },
    referrer: {
      title: '-',
      value: '-'
    },
    timeOnPage: {
      title: '-',
      value: '-'
    }
  };

  useEffect(() => {
    if ( refetchCount > 700 ) {
        console.log("Burst: refetching paused after 700 requests, to prevent rate limiting on the server. Refresh page to start again.");
        setInterval( 0 );
    }
  }, [refetchCount]);
  const queries = useQueries({
        queries: [
          {
            queryKey: [ 'live-visitors' ],
            queryFn: getLiveVisitors,
            refetchInterval: interval,
            placeholderData: '-',
            onError: ( error ) => {
              setInterval( 0 );
            },
            onSuccess: () => {
              setRefetchCount(prevCount => prevCount + 1);
            },
          },
          {
            queryKey: [ 'today' ],
            queryFn: () => getTodayData({startDate, endDate}),
            refetchInterval: interval * 2,
            placeholderData: placeholderData,
            onError: ( error ) => {
              setInterval( 0 );
            }
          }
        ]
      }
  );


  // Your existing code
  const live = queries[0].data;
  let data = queries[1].data;
  if ( queries.some( ( query ) => query.isError ) ) {
    data = placeholderData;
  }
  let liveIcon = selectVisitorIcon( live ? live : 0 );
  let todayIcon = 'loading';
  if ( data && data.today ) {
    todayIcon = selectVisitorIcon( data.today.value ? data.today.value : 0 );
  }


  return (
      <GridItem
          className={'border-to-border burst-today'}
          title={__( 'Today', 'burst-statistics' )}
          controls={<>{queries[0].isFetching ? <Icon name={'loading'} /> : null }</>}
      >
        <div className="burst-today">
          <div className="burst-today-select">
            <Tooltip content={data.live.tooltip}>
              <div className="burst-today-select-item burst-tooltip-live">
                <Icon name={liveIcon} size="23"/>
                <h2>{live}</h2>
                <span><Icon name="live" size="12" color={'red'}/> {__( 'Live', 'burst-statistics' )}</span>
              </div>
            </Tooltip>
            <Tooltip content={data.today.tooltip} >
              <div className="burst-today-select-item burst-tooltip-today">
                <Icon name={todayIcon} size="23"/>
                <h2>{data.today.value}</h2>
                <span><Icon name="total" size="13"
                            color={'green'}/> {__( 'Total', 'burst-statistics' )}</span>
              </div>
            </Tooltip>
          </div>
          <div className="burst-today-list">
            <Tooltip  content={data.mostViewed.tooltip}>
              <div className="burst-today-list-item burst-tooltip-mostviewed">
                <Icon name="winner"/>
                <p className="burst-today-list-item-text">{safeDecodeURI( data.mostViewed.title )}</p>
                <p className="burst-today-list-item-number">{data.mostViewed.value}</p>
              </div>
            </Tooltip>
            <Tooltip content={data.referrer.tooltip}>
              <div className="burst-today-list-item burst-tooltip-referrer">
                <Icon name="referrer"/>
                <p className="burst-today-list-item-text">{safeDecodeURI( data.referrer.title )}</p>
                <p className="burst-today-list-item-number">{data.referrer.value}</p>
              </div>
            </Tooltip>
            <Tooltip content={data.pageviews.tooltip}>
              <div className="burst-today-list-item burst-tooltip-pageviews">
                <Icon name="pageviews"/>
                <p className="burst-today-list-item-text">{data.pageviews.title}</p>
                <p className="burst-today-list-item-number">{data.pageviews.value}</p>
              </div>
            </Tooltip>
            <Tooltip content={data.timeOnPage.tooltip}>
              <div className="burst-today-list-item burst-tooltip-timeOnPage">
                <Icon name="time"/>
                <p className="burst-today-list-item-text">{data.timeOnPage.title}</p>
                <p className="burst-today-list-item-number">{data.timeOnPage.value}</p>
              </div>
            </Tooltip>
          </div>
        </div>
      </GridItem>
  );
};
export default memo (TodayBlock);
