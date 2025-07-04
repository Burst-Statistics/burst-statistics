import { createFileRoute } from '@tanstack/react-router';
import { PageFilter } from '@/components/Statistics/PageFilter';
import DateRange from '@/components/Statistics/DateRange';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import WorldMapBlock from '@/components/Sources/WorldMapBlock';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import { __ } from '@wordpress/i18n';
import useLicenseStore from '@/store/useLicenseStore';
import SourcesUpsellBackground from '@/components/Upsell/SourcesUpsellBackground';
import UpsellOverlay from '@/components/Upsell/UpsellOverlay';
import UpsellCopy from '@/components/Upsell/UpsellCopy';
import ButtonInput from '@/components/Inputs/ButtonInput';
import { burst_get_website_url } from '@/utils/lib';

export const Route = createFileRoute( '/sources' )({
  loader: () => {

    // Access the current state using getState()
    const { isLicenseValid, isPro } = useLicenseStore.getState();
    return { hasActiveLicense: isLicenseValid(), isPro }; // Return the status as loader data
  },
  component: Sources,
  errorComponent: ({ error }) => (
    <div className="text-red-500 p-4">
      {error.message ||
        __( 'An error occurred loading statistics', 'burst-statistics' )}
    </div>
  )
});

function Sources() {
  const { hasActiveLicense, isPro } = Route.useLoaderData();

  console.log( 'hasActiveLicense', hasActiveLicense );
  console.log( 'isPro', isPro );

  if ( ! isPro ) {
    return (
      <>
        <SourcesUpsellBackground />
        <UpsellOverlay>
          <UpsellCopy />
        </UpsellOverlay>
      </>
    );
  }

  if ( ! hasActiveLicense ) {
    return (
      <>
        <SourcesUpsellBackground />
        <UpsellOverlay>
          <div className="text-center space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">
              {__( 'Unlock Source Insights', 'burst-statistics' )}
            </h2>
            <p className="text-lg text-gray-600 max-w-md mx-auto">
              {__( 'Get detailed insights into where your traffic comes from.', 'burst-statistics' )}
            </p>
            <p className="text-base text-gray-500">
              {__( 'Already have a license? Activate it to access these features.', 'burst-statistics' )}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <ButtonInput
                btnVariant="primary"
                size="lg"
                link={{ to: '/settings/license' }}
              >
                {__( 'Activate License', 'burst-statistics' )}
              </ButtonInput>
              <ButtonInput
                btnVariant="secondary"
                size="lg"
                onClick={() => {
                  window.open( burst_get_website_url( 'pricing' ), '_blank' );
                }}
              >
                {__( 'Upgrade Plan', 'burst-statistics' )}
              </ButtonInput>
            </div>
          </div>
        </UpsellOverlay>
      </>
    );
  }

  return (
    <>
      <div className="col-span-12 flex items-center justify-between">
        <ErrorBoundary>
          <PageFilter />
        </ErrorBoundary>
        <ErrorBoundary>
          <DateRange />
        </ErrorBoundary>
      </div>
      <ErrorBoundary>
        <WorldMapBlock />
      </ErrorBoundary>
      <ErrorBoundary>
        <DataTableBlock allowedConfigs={[ 'countries' ]} id={5} />
      </ErrorBoundary>

      <ErrorBoundary>
        <DataTableBlock allowedConfigs={[ 'campaigns' ]} id={3} />
      </ErrorBoundary>
      <ErrorBoundary>
        <DataTableBlock allowedConfigs={[ 'referrers' ]} id={4} />
      </ErrorBoundary>
    </>
  );
}
