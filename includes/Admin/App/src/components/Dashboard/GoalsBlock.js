import { __ } from '@wordpress/i18n';
import { useState, useEffect, useMemo, memo } from 'react';
import Tooltip from '@/components/Common/Tooltip';
import ClickToFilter from '@/components/Common/ClickToFilter';
import Icon from '@//utils/Icon';
import { endOfDay, format, startOfDay } from 'date-fns';
import {
  getDateWithOffset
} from '@//utils/formatting';
import GoalStatus from './GoalStatus';
import useGoalsData from '@/hooks/useGoalsData';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockFooter } from '@/components/Blocks/BlockFooter';
import GoalsHeader from './GoalsHeader';
import { setOption } from '@//utils/api';
import { useQueries } from '@tanstack/react-query';
import getLiveGoals from '@//api/getLiveGoals';
import getGoalsData from '@//api/getGoalsData';
import { burst_get_website_url, safeDecodeURI } from '@//utils/lib';
import Overlay from '@/components/Common/Overlay';
import ButtonInput from '../Inputs/ButtonInput';

// Utility function to select the goal icon based on value
const selectGoalIcon = value => {
  value = parseInt( value );
  if ( 10 < value ) {
    return 'goals';
  } else if ( 0 < value ) {
    return 'goals';
  } else {
    return 'goals-empty';
  }
};

// Create memoized components for the ClickToFilter usage
const TodayFilterItem = memo( ({ filter, filterValue, label, startDate, icon, count }) => (
  <ClickToFilter
    filter={filter}
    filterValue={filterValue}
    label={label}
    startDate={startDate}
  >
    <div className="rounded-md flex flex-col justify-center items-center text-center flex-wrap bg-white py-4 [&.active]:shadow-greenShadow [&.active]:border-2 [&.active]:border-green">
      <Icon name={icon} size="26" />
      <h2 className="mt-1.5 font-extrabold">{count}</h2>
      <span className="flex gap-[3px] justify-center text-xs">
        <Icon name="sun" color={'yellow'} size="13" />{' '}
        {__( 'Today', 'burst-statistics' )}
      </span>
    </div>
  </ClickToFilter>
) );

const TotalFilterItem = memo( ({ filter, filterValue, label, startDate, icon, count, endDate }) => (
  <ClickToFilter
    filter={filter}
    filterValue={filterValue}
    label={label}
    startDate={startDate}
    endDate={endDate}
  >
    <div className="rounded-md flex flex-col justify-center items-center text-center flex-wrap bg-white py-4 [&.active]:shadow-greenShadow [&.active]:border-2 [&.active]:border-green">
      <Icon name={icon} size="26" />
      <h2 className="mt-1.5 font-extrabold">{count}</h2>
      <span className="flex gap-[3px] justify-center text-xs">
        <Icon name="calendar" size="13" />{' '}
        {__( 'Total', 'burst-statistics' )}
      </span>
    </div>
  </ClickToFilter>
) );

const GoalsBlock = () => {
  const [ interval, setInterval ] = useState( 15000 );
  const [ goalId, setGoalId ] = useState( false );

  // Replace useGoalsStore with useGoalsData
  const { goals, isLoading: isGoalsLoading } = useGoalsData();

  const currentDateWithOffset = useMemo( () => getDateWithOffset(), []);
  const startDate = useMemo( () => format( startOfDay( currentDateWithOffset ), 'yyyy-MM-dd' ), [ currentDateWithOffset ]);
  const endDate = useMemo( () => format( endOfDay( currentDateWithOffset ), 'yyyy-MM-dd' ), [ currentDateWithOffset ]);
  const today = useMemo( () => format( currentDateWithOffset, 'yyyy-MM-dd' ), [ currentDateWithOffset ]);

  useEffect(() => {
    if (!goalId && goals.length > 0) {
      setGoalId(goals[0].id);
    }
  }, [goals, goalId]);

  // Derive values using memoization instead of recalculating on every render
  const { goalStart, goalEnd } = useMemo( () => {
    let start = goals[goalId]?.date_start;
    let end = goals[goalId]?.date_end;

    if ( 0 == start || start === undefined ) {
      start = startDate;
    }
    if ( 0 == end || end === undefined ) {
      end = endDate;
    }

    return { goalStart: start, goalEnd: end };
  }, [ goalId, goals, startDate, endDate ]);

  // Prepare query args
  const args = useMemo( () => ({
    goal_id: goalId,
    startDate: startDate,
    endDate: endDate
  }), [ goalId, startDate, endDate ]);

  const placeholderData = useMemo( () => ({
    today: {
      title: __( 'Today', 'burst-statistics' ),
      icon: 'goals'
    },
    total: {
      title: __( 'Total', 'burst-statistics' ),
      value: '-',
      icon: 'goals'
    },
    topPerformer: {
      title: '-',
      value: '-'
    },
    conversionMetric: {
      title: '-',
      value: '-',
      icon: 'visitors'
    },
    conversionPercentage: {
      title: '-',
      value: '-'
    },
    bestDevice: {
      title: '-',
      value: '-',
      icon: 'desktop'
    },
    dateCreated: 0,
    dateStart: 0,
    dateEnd: 0,
    status: 'inactive'
  }), []);

  // Only run queries if we have a valid goalId
  const queries = useQueries({
    queries: [
      {
        queryKey: [ 'live-goals', goalId ],
        queryFn: () => {

          // Only fetch if we have a valid goalId
          if ( ! goalId ) {
            return '0';
          }
          return getLiveGoals( args );
        },
        refetchInterval: interval,
        placeholderData: '-',
        onError: ( error ) => {
          console.error( 'Error fetching live goals:', error );
          setInterval( 0 );
        },
        enabled: !! goalId
      },
      {
        queryKey: [ 'goals', goalId ],
        queryFn: () => {

          // Only fetch if we have a valid goalId
          if ( ! goalId ) {
            return placeholderData;
          }
          return getGoalsData( args );
        },
        refetchInterval: interval,
        placeholderData: placeholderData,
        onError: ( error ) => {
          console.error( 'Error fetching goals data:', error );
          setInterval( 0 );
        },
        enabled: !! goalId
      }
    ]
  });

  const onGoalsInfoClick = useMemo( () => {
    return () => {
      burst_settings.goals_information_shown = '1';
      setOption( 'goals_information_shown', true );
      window.location.hash = '#settings/goals';
    };
  }, []);

  // Safely extract data from queries
  const isLoading = queries.some( query => query.isLoading ) || isGoalsLoading;
  const isError = queries.some( query => query.isError );

  // Handle loading and error states properly
  const live = queries[0].data || '-';
  const data = isError ? placeholderData : ( queries[1].data || placeholderData );

  // Safe icon selection
  const todayIcon = selectGoalIcon( live );
  const totalIcon = selectGoalIcon( data.today?.value );

  // Memoize click to filter props to prevent unnecessary recalculations
  const todayFilterProps = useMemo( () => ({
    filter: 'goal_id',
    filterValue: data.goalId,
    label: data.today?.tooltip + __( 'Goal and today', 'burst-statistics' ),
    startDate: today,
    icon: todayIcon,
    count: live
  }), [ data.goalId, data.today?.tooltip, today, todayIcon, live ]);

  const totalFilterProps = useMemo( () => ({
    filter: 'goal_id',
    filterValue: data.goalId,
    label: data.today?.tooltip + __( 'Goal and the start date', 'burst-statistics' ),
    startDate: goalStart,
    endDate: goalEnd,
    icon: totalIcon,
    count: data.total?.value || '-'
  }), [ data.goalId, data.today?.tooltip, goalStart, goalEnd, totalIcon, data.total?.value ]);

  return (
    <Block className="row-span-2 lg:col-span-6 xl:col-span-3">
       {/* Example usage of the new Overlay component */}
       {'0' === burst_settings.goals_information_shown && (
          <Overlay>
           <h4 className='mb-4 text-lg font-bold'>{__( 'Goals', 'burst-statistics' )}</h4>
              <p className='mb-4'>
                {__(
                  'Keep track of customizable goals and get valuable insights. Add your first goal!',
                  'burst-statistics'
                )}
              </p>
              <p className='mb-4'>
                <a
                  className='text-blue underline'
                  href={burst_get_website_url( 'how-to-set-goals', {
                    utm_source: 'goals-block-overlay'
                  })}
                >
                  {__( 'Learn how to set your first goal', 'burst-statistics' )}
                </a>
              </p>
              <ButtonInput
                onClick={onGoalsInfoClick()}
                  btnVariant='secondary'
                  btnSize='small'
              >
                {__( 'Create my first goal', 'burst-statistics' )}
              </ButtonInput>
          </Overlay>
        )}

      <BlockHeading
        title={__( 'Goals', 'burst-statistics' )}
        controls={<GoalsHeader goalId={goalId} goals={goals} setGoalId={setGoalId} />}
        className='border-b border-gray-200'
      />
      <BlockContent className="px-0 py-0 relative">
        {isError ? (
          <div className="text-red p-4">
            {__( 'Error loading goals data. Please try again later.', 'burst-statistics' )}
          </div>
        ) : (
          <>
            <div className="px-6 py-5 grid w-full grid-cols-2 gap-4 bg-yellow-light">
              <TodayFilterItem {...todayFilterProps} />
              <TotalFilterItem {...totalFilterProps} />
            </div>
            <div className="w-full">
              <Tooltip content={data.topPerformer?.tooltip}>
                <div className="w-full grid justify-items-start grid-cols-auto-1fr-auto gap-4 py-2.5 px-6 even:bg-gray-100">
                  <Icon name="winner" />
                  <p className="w-full mr-auto">
                    {safeDecodeURI( data.topPerformer?.title || '-' )}
                  </p>
                  <p className="font-semibold">
                    {data.topPerformer?.value || '-'}
                  </p>
                </div>
              </Tooltip>
              <Tooltip arrow title={data.conversionMetric?.tooltip}>
                <div className="w-full grid justify-items-start grid-cols-auto-1fr-auto gap-4 py-2.5 px-6 even:bg-gray-100">
                  <Icon name={data.conversionMetric?.icon || 'visitors'} />
                  <p className="w-full mr-auto">
                    {data.conversionMetric?.title || '-'}
                  </p>
                  <p className="font-semibold">
                    {data.conversionMetric?.value || '-'}
                  </p>
                </div>
              </Tooltip>
              <Tooltip content={data.conversionPercentage?.tooltip}>
                <div className="w-full grid justify-items-start grid-cols-auto-1fr-auto gap-4 py-2.5 px-6 even:bg-gray-100">
                  <Icon name="graph" />
                  <p className="w-full mr-auto">
                    {data.conversionPercentage?.title || '-'}
                  </p>
                  <p className="font-semibold">
                    {data.conversionPercentage?.value || '-'}
                  </p>
                </div>
              </Tooltip>
              <Tooltip content={data.bestDevice?.tooltip}>
                <div className="w-full grid justify-items-start grid-cols-auto-1fr-auto gap-4 py-2.5 px-6 even:bg-gray-100">
                  <Icon name={data.bestDevice?.icon || 'desktop'} />
                  <p className="w-full mr-auto">
                    {data.bestDevice?.title || '-'}
                  </p>
                  <p className="font-semibold">
                    {data.bestDevice?.value || '-'}
                  </p>
                </div>
              </Tooltip>
            </div>
          </>
        )}
      </BlockContent>

      {0 !== goals.length && (
        <BlockFooter>
          <a
            className={'burst-button burst-button--secondary'}
            href={'#settings/goals'}
          >
            {__( 'View setup', 'burst-statistics' )}
          </a>
          <div className="ml-auto">
            {! isLoading && ! isError && <GoalStatus data={data} />}
          </div>
        </BlockFooter>
      )}
    </Block>
  );
};

// Export memoized component to prevent unnecessary re-renders
export default memo( GoalsBlock );
