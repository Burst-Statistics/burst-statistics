import { createFileRoute } from '@tanstack/react-router';
import { PageHeader } from '@/components/Common/PageHeader';
import InsightsBlock from '@/components/Statistics/InsightsBlock';
import CompareBlock from '@/components/Statistics/CompareBlock';
import DevicesBlock from '@/components/Statistics/DevicesBlock';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import { __ } from '@wordpress/i18n';
import useLicenseData from '@/hooks/useLicenseData';

export const Route = createFileRoute( '/statistics' )({
	component: Statistics,
	errorComponent: ({ error }) => (
		<div className="p-4 text-red-500">
			{error.message ||
				__( 'An error occurred loading statistics', 'burst-statistics' )}
		</div>
	)
});

function Statistics() {
	const { isPro } = useLicenseData();
	const blockOneItems = [ 'pages' ];
	const blockTwoItems = isPro ? [ 'parameters' ] : [ 'referrers' ];
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
				<DataTableBlock allowedConfigs={blockOneItems} id="1" />
			</ErrorBoundary>

			<ErrorBoundary>
				<DataTableBlock allowedConfigs={blockTwoItems} id="2" />
			</ErrorBoundary>
		</>
	);
}
