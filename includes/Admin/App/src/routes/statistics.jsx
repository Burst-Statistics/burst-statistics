import {createFileRoute} from '@tanstack/react-router';
import {PageFilter} from '@/components/Statistics/PageFilter';
import DateRange from '@/components/Statistics/DateRange';
import InsightsBlock from '@/components/Statistics/InsightsBlock';
import CompareBlock from '@/components/Statistics/CompareBlock';
import DevicesBlock from '@/components/Statistics/DevicesBlock';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import {__} from '@wordpress/i18n';
import useLicenseStore from '@/store/useLicenseStore';

export const Route = createFileRoute( '/statistics' )({
  component: Statistics,
  errorComponent: ({error}) => (
      <div className="p-4 text-red-500">
        {error.message ||
            __( 'An error occurred loading statistics', 'burst-statistics' )}
      </div>
  )
});

function Statistics() {
  const { isPro } = useLicenseStore();
  const blockOneItems = ['pages'];
  const blockTwoItems = isPro ? ['parameters'] : ['referrers'];
  return (
      <>
        <div className="col-span-12 flex justify-between items-center">
          <ErrorBoundary>
            <PageFilter/>
          </ErrorBoundary>
          <ErrorBoundary>
            <DateRange/>
          </ErrorBoundary>
        </div>
        <ErrorBoundary>
          <InsightsBlock/>
        </ErrorBoundary>
        <ErrorBoundary>
          <CompareBlock/>
        </ErrorBoundary>
        <ErrorBoundary>
          <DevicesBlock/>
        </ErrorBoundary>
        <ErrorBoundary>
          <DataTableBlock
              allowedConfigs={blockOneItems}
              id={1}
          />
        </ErrorBoundary>
        <ErrorBoundary>
          <DataTableBlock
              allowedConfigs={blockTwoItems}
              id={2}
          />
        </ErrorBoundary>
      </>
  );
}
