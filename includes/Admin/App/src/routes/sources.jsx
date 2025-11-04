import { createFileRoute } from '@tanstack/react-router';
import { PageFilter } from '@/components/Statistics/PageFilter';
import DateRange from '@/components/Statistics/DateRange';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import WorldMapBlock from '@/components/Sources/WorldMapBlock';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import { __ } from '@wordpress/i18n';
import SourcesUpsellBackground from '@/components/Upsell/Sources/SourcesUpsellBackground';
import UpsellOverlay from '@/components/Upsell/UpsellOverlay';
import UpsellCopy from '@/components/Upsell/UpsellCopy';
import ButtonInput from '@/components/Inputs/ButtonInput';
import { burst_get_website_url } from '@/utils/lib';
import useLicenseData from "@/hooks/useLicenseData";
import TrialPopup from "@/components/Upsell/TrialPopup";

export const Route = createFileRoute('/sources')({
    component: Sources,
    errorComponent: ({ error }) => (
        <div className="text-red-500 p-4">
            {error.message ||
                __('An error occurred loading statistics', 'burst-statistics')}
        </div>
    ),
});

function Sources() {
    // Use the hook inside the component, not in the loader
    const { isLicenseValidFor } = useLicenseData();
    if ( ! isLicenseValidFor('sources') ) {
        return (
            <>
                <SourcesUpsellBackground />

                <UpsellOverlay>
                    <UpsellCopy type="sources"/>
                </UpsellOverlay>
            </>
        );
    }

    return (
        <>
            <TrialPopup />
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
                <DataTableBlock allowedConfigs={['countries']} id={5} />
            </ErrorBoundary>

            <ErrorBoundary>
                <DataTableBlock allowedConfigs={['campaigns']} id={3} />
            </ErrorBoundary>
            <ErrorBoundary>
                <DataTableBlock allowedConfigs={['referrers']} id={4} />
            </ErrorBoundary>
        </>
    );
}