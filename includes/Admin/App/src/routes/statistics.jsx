import { createFileRoute, notFound } from '@tanstack/react-router';
import { PageHeader } from '@/components/Common/PageHeader';
import InsightsBlock from '@/components/Statistics/InsightsBlock';
import CompareBlock from '@/components/Statistics/CompareBlock';
import DevicesBlock from '@/components/Statistics/DevicesBlock';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import { __ } from '@wordpress/i18n';
import { shouldLoadRoute } from '@/utils/helper';

export const Route = createFileRoute( '/statistics' )({
	component: Statistics,
	loader: ({ context }) => {
		if ( context?.menus && ! shouldLoadRoute( 'statistics', context.menus ) ) {
			throw notFound();
		}
	},
	errorComponent: ({ error }) => (
		<div className="p-4 text-red-500">
			{error.message ||
				__( 'An error occurred loading statistics', 'burst-statistics' )}
		</div>
	)
});

function Statistics() {
	return (
		<>
			<PageHeader />

			<ErrorBoundary>
				<InsightsBlock />
			</ErrorBoundary>

			<ErrorBoundary>
				<CompareBlock />
			</ErrorBoundary>

			<ErrorBoundary>
				<DevicesBlock />
			</ErrorBoundary>

			<ErrorBoundary>
				<DataTableBlock allowedConfigs={[ 'pages' ]} id="statistics_pages" />
			</ErrorBoundary>

			<ErrorBoundary>
				<DataTableBlock allowedConfigs={[ 'referrers' ]} id="statistics_referrers" />
			</ErrorBoundary>


		</>
	);
}
