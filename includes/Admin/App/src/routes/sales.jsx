/**
 * Sales Route
 */
import { createFileRoute } from '@tanstack/react-router';
import { __ } from '@wordpress/i18n';
import { PageHeader } from '@/components/Common/PageHeader';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
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
import UnauthorizedModal from '@/components/Common/UnauthorizedModal';

export const Route = createFileRoute( '/sales' )({
	beforeLoad: ({ context }) => {
		let canAccessSales = false;

		if ( '1' === context?.canViewSales ) {
			canAccessSales = true;
		}

		if ( ! canAccessSales ) {
			throw {
				type: 'UNAUTHORIZED',
				message: __(
					'You do not have permission to view sales data.',
					'burst-statistics'
				)
			};
		}
	},
	component: SalesComponent,
	errorComponent: ({ error }) => {
		if ( 'UNAUTHORIZED' === error.type ) {
			return (
				<UnauthorizedModal
					header={__( 'Unauthorized Access', 'burst-statistics' )}
					message={error.message}
					actionLabel={__( 'Go Back', 'burst-statistics' )}
				/>
			);
		}

		return (
			<div className="text-red-500 p-4">
				{error.message ||
					__(
						'An error occurred loading statistics',
						'burst-statistics'
					)}
			</div>
		);
	}
});

/**
 * Sales Component
 *
 * @return {JSX.Element}
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
					<UpsellCopy type="sales" />
				</UpsellOverlay>
			</>
		);
	}

	return (
		<>
			<TrialPopup type="sales" />

			<EcommerceNotices />

			<PageHeader />

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
					allowedConfigs={[ 'products' ]}
					id={6}
					isEcommerce={true}
				/>
			</ErrorBoundary>
		</>
	);
}
