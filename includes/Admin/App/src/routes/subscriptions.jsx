/**
 * Sales Route
 */
import { createFileRoute, notFound } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { __ } from '@wordpress/i18n';
import { PageHeader } from '@/components/Common/PageHeader';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import useLicenseData from '@/hooks/useLicenseData';
import UnauthorizedModal from '@/components/Common/UnauthorizedModal';
import SubscriptionsBlock from '@/components/Subscriptions/SubscriptionsBlock';
import SubscriptionsProgressBar from '@/components/Subscriptions/SubscriptionsProgressBar';
import SubscriptionsLargeSiteNotice from '@/components/Subscriptions/SubscriptionsLargeSiteNotice';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import { RevenueChartBlock } from '@/components/Subscriptions/RevenueChart';
import { RetentionChartBlock } from '@/components/Subscriptions/RetentionChart';
import { DistributionBlock } from '@/components/Subscriptions/DistributionChart';
import getSubscriptionsProgressData from '@/api/getSubscriptionsProgressData';
import { shouldLoadRoute } from '@/utils/helper';
import NotFoundModal from '@/components/Common/NotFoundModal';
import useShareableLinkStore from '@/store/useShareableLinkStore';

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
	const isShareableLinkViewer = useShareableLinkStore( state => state.isShareableLinkViewer );

	// Shared queryKey with SubscriptionsProgressBar dedupes the fetch.
	// Polls every 60s while backfill is still running, then stops so open
	// dashboard tabs do not keep hitting the endpoint forever.
	const progressQuery = useQuery({
		queryKey: [ 'subscriptions-backfill-progress' ],
		queryFn: () => getSubscriptionsProgressData(),
		refetchInterval: ( query ) => {
			const d = query.state.data;
			if ( ! d ) {
				return 60000;
			}
			if ( d.backfill_completed && ! d.is_processing ) {
				return false;
			}
			return 60000;
		},
		refetchIntervalInBackground: true
	});

	if ( isFetching ) {
		return null;
	}

	// As we are not showing upsell for subscription, if it is accessed we will show Unauthorized access modal
	if ( ! isLicenseValidFor( 'sales' ) ) {
		return (
			<UnauthorizedModal
				header={__( 'Unauthorized Access', 'burst-statistics' )}
				message={
					__(
						'You do not have permission to view sales data.',
						'burst-statistics'
					)
				}
				actionLabel={__( 'Go Back', 'burst-statistics' )}
			/>
		);
	}

	// Block data blocks until the gate decision is known. Summary / chart /
	// product are cached-only on the server and would render empty cards
	// before backfill finishes. On query error we keep the gate engaged
	// rather than fire heavy REST calls in parallel.
	const isProgressLoading = undefined === progressQuery.data && ! progressQuery.isError;

	if ( isProgressLoading ) {
		return (
			<>
				<PageHeader />
			</>
		);
	}

	const progressData = progressQuery.data;
	const backfillCompleted = ! progressQuery.isError && !! progressData?.backfill_completed;
	const hasProviders = !! progressData?.has_providers;

	if ( hasProviders && ! backfillCompleted ) {
		return (
			<>
				<PageHeader />
				<SubscriptionsLargeSiteNotice />
			</>
		);
	}

	return (
		<>
			<PageHeader />
			{ ! isShareableLinkViewer && <SubscriptionsProgressBar /> }

			<ErrorBoundary>
				<RevenueChartBlock />
				<SubscriptionsBlock />
				<DistributionBlock />
				<RetentionChartBlock />
			</ErrorBoundary>

			<ErrorBoundary>
				<DataTableBlock
					allowedConfigs={[ 'subscription_products' ]}
					id="subscription_products"
					isEcommerce={true}
				/>
			</ErrorBoundary>
		</>
	);
}
