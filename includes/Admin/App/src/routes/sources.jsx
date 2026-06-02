import { createFileRoute, notFound } from '@tanstack/react-router';
import { PageHeader } from '@/components/Common/PageHeader';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import WorldMapBlock from '@/components/Sources/WorldMapBlock';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import TrialPopup from '@/components/Upsell/TrialPopup';
import { shouldLoadRoute } from '@/utils/helper';


export const Route = createFileRoute( '/sources' )({
	component: Sources,

	// Throwing notFound in beforeLoad does not render header.
	loader: ({ context }) => {
		if ( context?.menus && ! shouldLoadRoute( 'sources', context.menus ) ) {
			throw notFound();
		}
	},
	errorComponent: ({ error }) => (
		<div className="text-red-500 p-4">
			{error.message || 'An error occurred loading sources'}
		</div>
	)
});

function Sources() {

	// Use the hook inside the component, not in the loader
	// const { isLicenseValidFor } = useLicenseData();
	// if ( ! isLicenseValidFor( 'sources' ) ) {
	// 	return (
	// 		<>
	// 			<SourcesUpsellBackground />

	// 			<UpsellOverlay>
	// 				<UpsellCopy type="sources" />
	// 			</UpsellOverlay>
	// 		</>
	// 	);
	// }

	return (
		<>
			<TrialPopup />
			<PageHeader />

			<ErrorBoundary>
				<WorldMapBlock />
			</ErrorBoundary>

			<ErrorBoundary>
				<DataTableBlock allowedConfigs={[ 'countries' ]} id="sources_countries" />
			</ErrorBoundary>

			<ErrorBoundary>
				<DataTableBlock allowedConfigs={[ 'campaigns' ]} id="sources_campaigns" />
			</ErrorBoundary>
		</>
	);
}
