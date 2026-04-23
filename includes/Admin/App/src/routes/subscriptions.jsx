/**
 * Sales Route
 */
import { createFileRoute, notFound } from '@tanstack/react-router';
import { __ } from '@wordpress/i18n';
import { PageHeader } from '@/components/Common/PageHeader';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import UpsellOverlay from '@/components/Upsell/UpsellOverlay';
import useLicenseData from '@/hooks/useLicenseData';
import SalesUpsellBackground from '@/components/Upsell/Sales/SalesUpsellBackground';
import UpsellCopy from '@/components/Upsell/UpsellCopy';
import UnauthorizedModal from '@/components/Common/UnauthorizedModal';
import SubscriptionsBlock from '@/components/Subscriptions/SubscriptionsBlock';
import SubscriptionsProgressBar from '@/components/Subscriptions/SubscriptionsProgressBar';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import { RevenueChartBlock } from '@/components/Subscriptions/RevenueChart';
import { RetentionChartBlock } from '@/components/Subscriptions/RetentionChart';
import { DistributionBlock } from '@/components/Subscriptions/DistributionChart';
import { shouldLoadRoute } from '@/utils/helper';
import NotFoundModal from '@/components/Common/NotFoundModal';

export const Route = createFileRoute( '/subscriptions' )({
	notFoundComponent: NotFoundModal,
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

	// Throwing notFound in beforeLoad does not render header.
	loader: ({ context }) => {
		if ( context?.menus && ! shouldLoadRoute( 'subscriptions', context.menus ) ) {
			throw notFound();
		}
	},
	component: SubscriptionsComponent,
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
						'An error occurred loading subscriptions',
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
function SubscriptionsComponent() {

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
			<PageHeader />
			<SubscriptionsProgressBar />

			<ErrorBoundary>
				<RevenueChartBlock />
				<SubscriptionsBlock />
				<DistributionBlock />
				<RetentionChartBlock />
			</ErrorBoundary>

			<ErrorBoundary>
				<DataTableBlock
					allowedConfigs={[ 'subscription_products' ]}
					id={'subscription_products'}
					isEcommerce={true}
				/>
			</ErrorBoundary>
		</>
	);
}
