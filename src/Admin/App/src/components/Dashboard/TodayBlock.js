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
    <Block className="row-span-2 lg:col-span-6 xl:col-span-3 overflow-hidden">
      <BlockHeading
        title={__( 'Today', 'burst-statistics' )}
        controls={undefined}
      />
      <BlockContent className="px-0 py-0">
        <div className="burst-today">
          <div className="px-m py-l grid w-full grid-cols-2 gap-s bg-green-light">
            <Tooltip content={data.live.tooltip}>
              <div className="rounded-xs flex flex-col justify-center text-center py-s items-center flex-wrap bg-white burst-tooltip-live">
                <Icon name={liveIcon} size="26" />
                <h2 className="mt-xxs font-extrabold">{live}</h2>
                <span className="flex gap-[3px] justify-center text-xs">
                  <Icon name="live" size="12" color={'red'} />{' '}
                  {__( 'Live', 'burst-statistics' )}
                </span>
              </div>
            </Tooltip>
            <Tooltip content={data.today.tooltip}>
              <div className="rounded-xs flex flex-col justify-center text-center py-s items-center flex-wrap bg-white burst-tooltip-today">
                <Icon name={todayIcon} size="26" />
                <h2 className="mt-xxs font-extrabold">{data.today.value}</h2>
                <span className="flex gap-[3px] justify-center text-xs">
                  <Icon name="total" size="13" color={'green'} />{' '}
                  {__( 'Total', 'burst-statistics' )}
                </span>
              </div>
            </Tooltip>
          </div>
          <div className="w-full">
            <Tooltip content={data.mostViewed.tooltip}>
              <div className="w-full grid justify-items-start grid-cols-auto-1fr-auto gap-2 py-xs px-l even:bg-gray-100 burst-tooltip-mostviewed">
                <Icon name="winner" />
                <p className="burst-today-list-item-text w-full mr-auto">
                  {safeDecodeURI( data.mostViewed.title )}
                </p>
                <p className="font-semibold">
                  {data.mostViewed.value}
                </p>
              </div>
            </Tooltip>
            <Tooltip content={data.referrer.tooltip}>
              <div className="w-full grid justify-items-start grid-cols-auto-1fr-auto gap-2 py-xs px-l even:bg-gray-100 burst-tooltip-referrer">
                <Icon name="referrer" />
                <p className="burst-today-list-item-text w-full mr-auto">
                  {safeDecodeURI( data.referrer.title )}
                </p>
                <p className="font-semibold">
                  {data.referrer.value}
                </p>
              </div>
            </Tooltip>
            <Tooltip content={data.pageviews.tooltip}>
              <div className="w-full grid justify-items-start grid-cols-auto-1fr-auto gap-2 py-xs px-l even:bg-gray-100 burst-tooltip-pageviews">
                <Icon name="pageviews" />
                <p className="burst-today-list-item-text w-full mr-auto">
                  {data.pageviews.title}
                </p>
                <p className="font-semibold">
                  {data.pageviews.value}
                </p>
              </div>
            </Tooltip>
            <Tooltip content={data.timeOnPage.tooltip}>
              <div className="w-full grid justify-items-start grid-cols-auto-1fr-auto gap-2 py-xs px-l even:bg-gray-100 burst-tooltip-timeOnPage">
                <Icon name="time" />
                <p className="burst-today-list-item-text w-full mr-auto">
                  {data.timeOnPage.title}
                </p>
                <p className="font-semibold">
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
