import { __ } from '@wordpress/i18n';
import Tooltip from '@/components/Common/Tooltip';
import { useQueries, useQuery } from '@tanstack/react-query';
import getLiveVisitors from '@//api/getLiveVisitors';
import getTodayData from '@//api/getTodayData';
import Icon from '@//utils/Icon';
import { endOfDay, format, startOfDay } from 'date-fns';
import { useState, useRef, useMemo } from 'react';
import { getDateWithOffset } from '@//utils/formatting';
import { safeDecodeURI } from '@//utils/lib';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';

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
  const intervalRef = useRef( 5000 );
  const setInterval = ( value ) => {
    intervalRef.current = value;
  };

  const currentDateWithOffset = useMemo( () => getDateWithOffset(), []);
  const startDate = useMemo( () => format( startOfDay( currentDateWithOffset ), 'yyyy-MM-dd' ), [ currentDateWithOffset ]);
  const endDate = useMemo( () => format( endOfDay( currentDateWithOffset ), 'yyyy-MM-dd' ), [ currentDateWithOffset ]);

  const placeholderData = useMemo( () => ({
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
  }), []);

  const liveVisitorsQuery = useQuery({
    queryKey: [ 'live-visitors' ],
    queryFn: getLiveVisitors,
    refetchInterval: intervalRef.current,
    placeholderData: '-',
    onError: () => setInterval( 0 ),
    gcTime: 10000
  });

  const todayDataQuery = useQuery({
    queryKey: [ 'today', startDate, endDate ],
    queryFn: () => getTodayData({ startDate, endDate }),
    refetchInterval: intervalRef.current * 2,
    placeholderData,
    onError: () => setInterval( 0 ),
    gcTime: 20000
  });

  const live = liveVisitorsQuery.data;
  let data = todayDataQuery.data;
  if ([ liveVisitorsQuery, todayDataQuery ].some( ( query ) => query.isError ) ) {
    data = placeholderData;
  }
  let liveIcon = selectVisitorIcon( live ? live : 0 );
  let todayIcon = 'loading';
  if ( data && data.today ) {
    todayIcon = selectVisitorIcon( data.today.value ? data.today.value : 0 );
  }

  return (
    <Block className="row-span-2 lg:col-span-6 xl:col-span-3">
      <BlockHeading
        title={__( 'Today', 'burst-statistics' )}
        controls={undefined}
      />
      <BlockContent className={'px-0 py-0'}>
        <div className="burst-today">
          <div className="burst-today-select">
            <Tooltip content={data.live.tooltip}>
              <div className="burst-today-select-item burst-tooltip-live">
                <Icon name={liveIcon} size="26" />
                <h2>{live}</h2>
                <span>
                  <Icon name="live" size="12" color={'red'} />{' '}
                  {__( 'Live', 'burst-statistics' )}
                </span>
              </div>
            </Tooltip>
            <Tooltip content={data.today.tooltip}>
              <div className="burst-today-select-item burst-tooltip-today">
                <Icon name={todayIcon} size="26" />
                <h2>{data.today.value}</h2>
                <span>
                  <Icon name="total" size="13" color={'green'} />{' '}
                  {__( 'Total', 'burst-statistics' )}
                </span>
              </div>
            </Tooltip>
          </div>
          <div className="burst-today-list">
            <Tooltip content={data.mostViewed.tooltip}>
              <div className="burst-today-list-item burst-tooltip-mostviewed">
                <Icon name="winner" />
                <p className="burst-today-list-item-text">
                  {safeDecodeURI( data.mostViewed.title )}
                </p>
                <p className="burst-today-list-item-number">
                  {data.mostViewed.value}
                </p>
              </div>
            </Tooltip>
            <Tooltip content={data.referrer.tooltip}>
              <div className="burst-today-list-item burst-tooltip-referrer">
                <Icon name="referrer" />
                <p className="burst-today-list-item-text">
                  {safeDecodeURI( data.referrer.title )}
                </p>
                <p className="burst-today-list-item-number">
                  {data.referrer.value}
                </p>
              </div>
            </Tooltip>
            <Tooltip content={data.pageviews.tooltip}>
              <div className="burst-today-list-item burst-tooltip-pageviews">
                <Icon name="pageviews" />
                <p className="burst-today-list-item-text">
                  {data.pageviews.title}
                </p>
                <p className="burst-today-list-item-number">
                  {data.pageviews.value}
                </p>
              </div>
            </Tooltip>
            <Tooltip content={data.timeOnPage.tooltip}>
              <div className="burst-today-list-item burst-tooltip-timeOnPage">
                <Icon name="time" />
                <p className="burst-today-list-item-text">
                  {data.timeOnPage.title}
                </p>
                <p className="burst-today-list-item-number">
                  {data.timeOnPage.value}
                </p>
              </div>
            </Tooltip>
          </div>
        </div>
      </BlockContent>
    </Block>
  );
};
export default TodayBlock;
