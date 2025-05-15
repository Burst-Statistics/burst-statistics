import {Filters} from '../blocks/Filters';
import InsightsBlock from '../blocks/InsightsBlock';
import CompareBlock from '../blocks/CompareBlock';
import DevicesBlock from '../blocks/DevicesBlock';
import PagesBlock from '../blocks/PagesBlock';
import AcquisitionBlock from '../blocks/AcquisitionBlock';
import DataTableBlock from '../blocks/DataTableBlock';

import {PageFilter} from '../blocks/PageFilter';
import DateRange from '../blocks/DateRange';
import {useFiltersStore} from '../../store/useFiltersStore';
import {useDate} from '../../store/useDateStore';

const StatisticsPage = () => {
  const { filters } = useFiltersStore( ( state ) => ({
    filters: state.filters
  }) );

  const { startDate, endDate, range } = useDate( ( state ) => ({
    startDate: state.startDate,
    endDate: state.endDate,
    range: state.range
  }) );

  const commonProps = { filters, startDate, endDate, range };

  return (
      <div className={'burst-content-area burst-grid burst-statistics'}>
        <Filters>
          <PageFilter />
          <DateRange />
        </Filters>
        <InsightsBlock filters={filters} />
        <CompareBlock {...commonProps} />
        <DevicesBlock {...commonProps} />
        <DataTableBlock {...commonProps} allowedConfigs={[ 'pages', 'parameters', 'campaigns' ]} id={1}/>
        <DataTableBlock {...commonProps} allowedConfigs={[ 'referrers', 'countries' ]} id={2} />
      </div>
  );
};
export default StatisticsPage;
