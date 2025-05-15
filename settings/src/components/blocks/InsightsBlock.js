import {__} from '@wordpress/i18n';
import GridItem from '../common/GridItem';
import InsightsHeader from './InsightsHeader';
import {useInsightsStore} from '../../store/useInsightsStore';
import {useDate} from '../../store/useDateStore';
import {useEffect, useState} from '@wordpress/element';
import {useQuery} from '@tanstack/react-query';
import getInsightsData from '../../api/getInsightsData';
import {useFiltersStore} from '../../store/useFiltersStore';

const InsightsBlock = () => {
  const [ InsightsGraph, setInsightsGraph ] = useState( null );

  useEffect( () => {
    if ( ! InsightsGraph ) {
      import ( './InsightsGraph' ).then( ({default: InsightsGraph}) => {
        setInsightsGraph( () => InsightsGraph );
      });
    }
  }, []);
  const metrics = useInsightsStore( ( state ) => state.getMetrics() );
  const {startDate, endDate, range} = useDate( ( state ) => state );
  const filters = useFiltersStore( ( state ) => state.filters );
  const args = { 'filters': filters, 'metrics': metrics };

  const query = useQuery({
        queryKey: [ 'insights', metrics, startDate, endDate, args ],
        queryFn: () => getInsightsData({ startDate, endDate, range, args}),
        placeholderData: {
          'labels': [
            '-',
            '-',
            '-',
            '-',
            '-',
            '-',
            '-'
          ],
          'datasets': [
            {
              'data': [
                0,
                0,
                0,
                0,
                0,
                0,
                0
              ],
              'backgroundColor': 'rgba(41, 182, 246, 0.2)',
              'borderColor': 'rgba(41, 182, 246, 1)',
              'label': '-',
              'fill': 'false'
            },
            {
              'data': [
                0,
                0,
                0,
                0,
                0,
                0,
                0
              ],
              'backgroundColor': 'rgba(244, 191, 62, 0.2)',
              'borderColor': 'rgba(244, 191, 62, 1)',
              'label': '-',
              'fill': 'false'
            }
          ]
        }
      }
  );

  const loading = query.isLoading || query.isFetching;

  return (
      <GridItem
          className={'burst-column-2 burst-insights'}
          title={__( 'Insights', 'burst-statistics' )}
          controls={<InsightsHeader selectedMetrics={metrics} filters={filters}/>}
      >
          { query.data && InsightsGraph && <InsightsGraph loading={loading} data={query.data}/> }
      </GridItem>
  );
};

export default InsightsBlock;
