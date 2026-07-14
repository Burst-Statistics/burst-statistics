import { createFileRoute, notFound } from '@tanstack/react-router';
import { __ } from '@wordpress/i18n';
import { PageHeader } from '@/components/Common/PageHeader';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import WorldMapBlock from '@/components/Sources/WorldMapBlock';
import SourcesChartBlock from '@/components/Sources/SourcesChartBlock';
import SourcesBlock from '@/components/Statistics/SourcesBlock';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import TrialPopup from '@/components/Upsell/TrialPopup';
import OverlayBlock from '@/components/Upsell/OverlayBlock';
import UpsellCopy from '@/components/Upsell/UpsellCopy';
import useLicenseData from '@/hooks/useLicenseData';
import { shouldLoadRoute } from '@/utils/helper';
import SearchConsoleBlock from '@/components/Statistics/SearchConsoleBlock';


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
 * Per-block upsell for the Pro-only source blocks, mirroring the Engagement
 * tab's pattern (e.g. FormsBlock).
 *
 * @param {Object} props           - Component props.
 * @param {string} props.title     - Block heading title.
 * @param {string} props.blurLabel - Blurred placeholder label behind the overlay.
 * @param {string} props.className - Grid placement classes for the Block wrapper.
 * @return {JSX.Element} The upsell block.
 */
function SourcesUpsellBlock({ title, blurLabel, className }) {
	return (
		<OverlayBlock
			title={ title }
			blurLabel={ blurLabel }
			className={ className }
		>
			<UpsellCopy type="sources" compact={ true } />
		</OverlayBlock>
	);
}

function Sources() {

	// The Sources tab is no longer gated as a whole: the world map and locations
	// (country) data are free. The chart, top-sources and campaigns blocks remain
	// Pro features, gated per-block: hidden in free, upsell in Pro without a
	// valid license.
	const { isPro, isLicenseValidFor } = useLicenseData();
	const sourcesUnlocked = isLicenseValidFor( 'sources' );

	return (
		<>
			<TrialPopup />
			<PageHeader />

			{ isPro && (
				<ErrorBoundary>
					{ sourcesUnlocked ? (
						<SourcesChartBlock />
					) : (
						<SourcesUpsellBlock
							title={ __( 'Sources over time', 'burst-statistics' ) }
							blurLabel={ __( 'Source tracking is a Pro feature.', 'burst-statistics' ) }
							className="row-span-2 @lg:col-span-12 @xl:col-span-9"
						/>
					) }
				</ErrorBoundary>
			) }

			{ isPro && (
				<ErrorBoundary>
					{ sourcesUnlocked ? (
						<SourcesBlock />
					) : (
						<SourcesUpsellBlock
							title={ __( 'Traffic sources', 'burst-statistics' ) }
							blurLabel={ __( 'Source tracking is a Pro feature.', 'burst-statistics' ) }
							className="row-span-2 @lg:col-span-6 @xl:col-span-3"
						/>
					) }
				</ErrorBoundary>
			) }

			<ErrorBoundary>
				<WorldMapBlock />
			</ErrorBoundary>

			<ErrorBoundary>
				<DataTableBlock allowedConfigs={[ 'countries' ]} id="sources_countries" />
			</ErrorBoundary>

			<ErrorBoundary>
				{ sourcesUnlocked ? (
					<DataTableBlock allowedConfigs={[ 'campaigns' ]} id="sources_campaigns" />
				) : (
					<SourcesUpsellBlock
						title={ __( 'Campaigns', 'burst-statistics' ) }
						blurLabel={ __( 'Campaign tracking is a Pro feature.', 'burst-statistics' ) }
						className="row-span-2 @xl:col-span-6"
					/>
				) }
			</ErrorBoundary>

			<ErrorBoundary>
				<SearchConsoleBlock />
			</ErrorBoundary>
		</>
	);
}
