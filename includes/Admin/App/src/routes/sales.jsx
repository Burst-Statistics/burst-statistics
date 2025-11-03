/**
 * Sales Route
 */
import { createFileRoute } from '@tanstack/react-router';
import { __ } from '@wordpress/i18n';
import { PageFilter } from '@/components/Statistics/PageFilter';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import DateRange from '@/components/Statistics/DateRange';
import TopPerformers from '@/components/Sales/TopPerformers';
import Sales from '@/components/Sales/Sales';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import QuickWins from '@/components/Sales/QuickWins';
import FunnelChartSection from '@/components/Sales/FunnelChartSection';
import UpsellOverlay from '@/components/Upsell/UpsellOverlay';
import useLicenseData from '@/hooks/useLicenseData';
import TrialPopup from '@/components/Upsell/TrialPopup';
import SalesUpsellBackground from '@/components/Upsell/Sales/SalesUpsellBackground';
import { EcommerceNotices } from '@/components/Upsell/Sales/EcommerceNotices';
import UpsellCopy from '@/components/Upsell/UpsellCopy';

export const Route = createFileRoute( '/sales' )({
	component: SalesComponent,
	errorComponent: ( { error } ) => (
	  <div className="text-red-500 p-4">
		  { error.message || __( 'An error occurred loading statistics', 'burst-statistics' ) }
	  </div>
	)
});

/**
 * Sales Component
 *
 * @returns {JSX.Element}
 */
function SalesComponent() {
	// Use the hook inside the component, not in the loader
	const { isLicenseValidFor, isFetching } = useLicenseData();

	if ( isFetching ) {
		return null;
	}

	if ( ! isLicenseValidFor( 'sales' ) ) {
		return (
			<>
				<SalesUpsellBackground />

				<UpsellOverlay>
					<UpsellCopy type="sales"/>
				</UpsellOverlay>
			</>
		);
	}

	return (
		<>
			<TrialPopup type='sales'/>

			<EcommerceNotices />

			<div className="col-span-12 flex justify-between items-center">
				<ErrorBoundary>
					<PageFilter/>
				</ErrorBoundary>

				<ErrorBoundary>
					<DateRange/>
				</ErrorBoundary>
			</div>

			<ErrorBoundary>
				<FunnelChartSection />
			</ErrorBoundary>

			<ErrorBoundary>
				<Sales />
			</ErrorBoundary>

			<ErrorBoundary>
				<TopPerformers />
			</ErrorBoundary>

			<ErrorBoundary>
				<QuickWins />
			</ErrorBoundary>

			<ErrorBoundary>
				<DataTableBlock
				  allowedConfigs={['products']}
				  id={6}
				  isEcommerce={true}
				/>
			</ErrorBoundary>
		</>
	)
}
