import Icon from '../../utils/Icon';
import {useFiltersStore} from '../../store/useFiltersStore';
import {useDate} from '../../store/useDateStore';
import ExplanationAndStatsItem from '../common/ExplanationAndStatsItem';
import {__} from '@wordpress/i18n';
import GridItem from '../common/GridItem';
import CompareFooter from './CompareFooter';
import {useInsightsStore} from '../../store/useInsightsStore';
import {useQuery} from '@tanstack/react-query';
import getInsightsData from '../../api/getInsightsData';
import getCompareData from '../../api/getCompareData';

const CompareBlock = () => {
  const {startDate, endDate, range} = useDate( ( state ) => state );
  const filters = useFiltersStore( ( state ) => state.filters );
  const args = { 'filters': filters};

  const metrics = {
    'pageviews': __( 'Pageviews', 'burst-statistics' ),
    'sessions': __( 'Sessions', 'burst-statistics' ),
    'visitors': __( 'Visitors', 'burst-statistics' ),
    'bounced_sessions': __( 'Bounce Rate', 'burst-statistics' )
  };
  let emptyData = {};

  // loop through metrics and set default values
  Object.keys( metrics ).forEach( function( key ) {
    emptyData[key] = {
      'title': metrics[key],
      'subtitle': '-',
      'value': '-',
      'exactValue': '-',
      'change': '-',
      'changeStatus': ''
    };
  });

  const query = useQuery({
    queryKey: [ 'compare', startDate, endDate, args ],
    queryFn: () => getCompareData({startDate, endDate, range, args}),
    placeholderData: emptyData
  });

  const data = query.data || {};

  // if query is fetched and all .change values are empty, set compareNotAvailable to true
  let compareNotAvailable = ! Object.keys( data ).some( key => '' !== data[key].change );

  const loading = query.isLoading || query.isFetching;
  let loadingClass = loading ? 'burst-loading' : '';
  return (
      <GridItem
          title={__( 'Compare', 'burst-statistics' )}
          footer={<CompareFooter noCompare={compareNotAvailable} startDate={startDate} endDate={endDate} />}
      >
      <div className={'burst-loading-container ' + loadingClass}>
        {Object.keys( data ).map( ( key, i ) => {
          let m = data[key];
          return (
              <ExplanationAndStatsItem
                  key={i}
                  iconKey={key}
                  title={m.title}
                  subtitle={m.subtitle}
                  value={m.value}
                  exactValue={m.exactValue}
                  change={m.change}
                  changeStatus={m.changeStatus}
              />
          );
        })}
      </div>
      </GridItem>
  );
};

export default CompareBlock;

