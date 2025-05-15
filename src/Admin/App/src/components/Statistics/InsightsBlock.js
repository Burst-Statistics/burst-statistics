import { __ } from '@wordpress/i18n';
import Block from '@/components/Blocks/Block';
import BlockHeading from '@/components/Blocks/BlockHeading';
import BlockContent from '@/components/Blocks/BlockContent';

import InsightsHeader from './InsightsHeader';
import { useInsightsStore } from '../../store/useInsightsStore';
import InsightsGraph from './InsightsGraph';
import { useDate } from '../../store/useDateStore';
import { useQuery } from '@tanstack/react-query';
import getInsightsData from '../../api/getInsightsData';
import { useFiltersStore } from '../../store/useFiltersStore';

const InsightsBlock = () => {
  const metrics = useInsightsStore( ( state ) => state.getMetrics() );
  const { startDate, endDate, range } = useDate( ( state ) => state );
  const filters = useFiltersStore( ( state ) => state.filters );
  const args = { filters: filters, metrics: metrics };

  const query = useQuery({
    queryKey: [ 'insights', metrics, startDate, endDate, args ],
    queryFn: () => getInsightsData({ startDate, endDate, range, args }),
    placeholderData: {
      labels: [ '-', '-', '-', '-', '-', '-', '-' ],
      datasets: [
        {
          data: [ 0, 0, 0, 0, 0, 0, 0 ],
          backgroundColor: 'rgba(41, 182, 246, 0.2)',
          borderColor: 'rgba(41, 182, 246, 1)',
          label: '-',
          fill: 'false'
        },
        {
          data: [ 0, 0, 0, 0, 0, 0, 0 ],
          backgroundColor: 'rgba(244, 191, 62, 0.2)',
          borderColor: 'rgba(244, 191, 62, 1)',
          label: '-',
          fill: 'false'
        }
      ]
    }
  });

  const loading = query.isLoading || query.isFetching;
  return (
    <Block className="row-span-1 lg:col-span-12 xl:col-span-6 min-h-96">
      <BlockHeading
        title={__( 'Insights', 'burst-statistics' )}
        controls={
          <InsightsHeader selectedMetrics={metrics} filters={filters} />
        }
      />
      <BlockContent>
        {query.data && InsightsGraph && (
          <InsightsGraph loading={loading} data={query.data} />
        )}
      </BlockContent>
    </Block>
  );
};

export default InsightsBlock;
