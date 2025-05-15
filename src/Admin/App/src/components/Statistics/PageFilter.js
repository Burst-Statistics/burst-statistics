import { useFiltersStore } from '../../store/useFiltersStore';
import Icon from '../../utils/Icon';
import { __ } from '@wordpress/i18n';
import useGoalsData from '@/hooks/useGoalsData';
import { useInsightsStore } from '../../store/useInsightsStore';
import { safeDecodeURI } from '../../utils/lib';

export const PageFilter = () => {
  const filters = useFiltersStore( ( state ) => state.filters );
  const filtersConf = useFiltersStore( ( state ) => state.filtersConf );
  const setFilters = useFiltersStore( ( state ) => state.setFilters );
  const { getGoal } = useGoalsData();
  const setInsightsMetrics = useInsightsStore( ( state ) => state.setMetrics );
  const insightsMetrics = useInsightsStore( ( state ) => state.getMetrics() );
  let title = '';

  const getGoalsTitle = ( id ) => {
    let goal = getGoal( id );
    if ( goal ) {
      return goal.title;
    }
    return '';
  };

  const getCountryTitle = ( code ) => {
    if ( ! code ) {
      return '';
    }
    code = code.toUpperCase();
    const countryLabel = burst_settings.countries[code];
    return countryLabel ? countryLabel : code;
  };

  const getDeviceTitle = ( device ) => {
    switch ( device ) {
      case 'desktop':
        return __( 'Desktop', 'burst-statistics' );
      case 'tablet':
        return __( 'Tablet', 'burst-statistics' );
      case 'mobile':
        return __( 'Mobile', 'burst-statistics' );
      default:
        return __( 'Other', 'burst-statistics' );
    }
  };

  // if animate is set, add the class to the filter
  const getFilterClass = ( filter ) => {
    let className =
      'inline-flex items-center gap-2 px-3 py-2 bg-gray-100 border border-gray-400 shadow-md rounded-md text-sm';
    return className;
  };

  const removeFilter = ( filter ) => {
    setFilters( filter, '' );

    if ( 'goal_id' === filter ) {

      // also remove insight metrics conversions
      setInsightsMetrics(
        insightsMetrics.filter( ( metric ) => 'conversions' !== metric )
      );
    }
  };

  // map through the filtersConf and get filters that are set
  return (
    <div className="flex flex-wrap gap-2">
      {Object.keys( filtersConf ).map( ( filter, index ) => {
        if ( '' !== filters[filter]) {
          if ( 'goal_id' === filter ) {
            title = getGoalsTitle( filters[filter]);
          } else if ( 'device' === filter ) {
            title = getDeviceTitle( filters[filter]);
          } else if ( 'country_code' === filter ) {
            title = getCountryTitle( filters[filter]);
          } else {
            title = filters[filter];
          }
          const icon =
            '' !== filtersConf[filter].icon ?
              filtersConf[filter].icon :
              'filter';
          return (
            <div className={getFilterClass( filter )} key={index}>
              <Icon name={filtersConf[filter].icon} size="16" />
              <p className="font-medium">{filtersConf[filter].label}</p>
              <span className="h-4 w-px bg-gray-400"></span>
              <p className="text-gray-600">{safeDecodeURI( title )}</p>
              <button
                onClick={() => removeFilter( filter )}
                className="rounded-full p-1 transition-colors hover:bg-gray-200"
              >
                <Icon name="times" color={'var(--rsp-grey-500)'} size="16" />
              </button>
            </div>
          );
        }
      })}
    </div>
  );
};
