import { createFileRoute, notFound } from '@tanstack/react-router';
import { __ } from '@wordpress/i18n';
import { PageHeader } from '@/components/Common/PageHeader';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import WorldMapBlock from '@/components/Sources/WorldMapBlock';
import SourcesChartBlock from '@/components/Sources/SourcesChartBlock';
import SourcesBlock from '@/components/Statistics/SourcesBlock';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import TrialPopup from '@/components/Upsell/TrialPopup';
import UpsellOverlay from '@/components/Upsell/UpsellOverlay';
import UpsellCopy from '@/components/Upsell/UpsellCopy';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import useLicenseData from '@/hooks/useLicenseData';
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

/**
 * Per-block upsell for the (Pro-only) campaigns table, mirroring the Engagement
 * tab's pattern (e.g. FormsBlock).
 *
 * @return {JSX.Element} The campaigns upsell block.
 */
function CampaignsUpsellBlock() {
	return (
		<Block className="relative min-h-[320px] overflow-hidden">
			<BlockHeading title={ __( 'Campaigns', 'burst-statistics' ) } />
			<BlockContent className="px-0 py-0 overflow-y-auto">
				<div className="flex h-48 flex-col items-center justify-center p-4 text-center text-sm text-gray-400 select-none blur-[1px]">
					<p className="font-medium text-gray-500 mb-1">
						{ __( 'Campaign tracking is a Pro feature.', 'burst-statistics' ) }
					</p>
				</div>
				<UpsellOverlay
					className="flex items-center justify-center pt-0 mt-0 m-0 border-0 bg-transparent"
					containerClassName="pt-1 m-1 mt-4"
					cardClassName="mx-4 min-w-fit rounded-md border border-gray-300 bg-gray-100 px-6 py-6 shadow-sm"
				>
					<UpsellCopy type="sources" compact={ true } />
				</UpsellOverlay>
			</BlockContent>
		</Block>
	);
}

function Sources() {

	// The Sources tab is no longer gated as a whole: the world map and locations
	// (country) data are free. Campaigns remain a Pro feature, gated per-block.
	const { isPro } = useLicenseData();

	return (
		<>
			<TrialPopup />
			<PageHeader />

			{ isPro && (
				<ErrorBoundary>
					<SourcesChartBlock />
				</ErrorBoundary>
			) }

			{ isPro && (
				<ErrorBoundary>
					<SourcesBlock />
				</ErrorBoundary>
			) }

			<ErrorBoundary>
				<WorldMapBlock />
			</ErrorBoundary>

			<ErrorBoundary>
				<DataTableBlock allowedConfigs={[ 'countries' ]} id="sources_countries" />
			</ErrorBoundary>

			<ErrorBoundary>
				{ isPro ? (
					<DataTableBlock allowedConfigs={[ 'campaigns' ]} id="sources_campaigns" />
				) : (
					<CampaignsUpsellBlock />
				) }
			</ErrorBoundary>
		</>
	);
}
