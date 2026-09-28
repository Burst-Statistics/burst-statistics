import { memo, useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { ExpandTableButton } from '@/components/Blocks/ExpandTableButton';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BarDataTable } from '@/components/DataTable/BarDataTable';
import { useOutgoingLinksData } from './useOutgoingLinksData';
import { getOutgoingLinksColumns } from './columns';
import useSettingsData from '@/hooks/useSettingsData';
import useLicenseData from '@/hooks/useLicenseData';
import OverlayBlock from '@/components/Upsell/OverlayBlock';
import UpsellCopy from '@/components/Upsell/UpsellCopy';
import ActivationCopy from '@/components/Upsell/ActivationCopy';
import MetricInfo from '@/components/Common/MetricInfo';
import { isTourActive } from '@/store/useTourStore';
import type { FilterSearchParams } from '@/config/filterConfig';

type OutgoingLinksBlockProps = {

	/** Additional CSS class names passed to the wrapping Block. */
	className?: string;

	/** Override filters (e.g. page-scoped page_url). */
	customFilters?: FilterSearchParams;
};

/** Maximum rows shown in the compact block view. */
const TOP_N = 5;

/**
 * Compact dashboard block showing the most clicked outgoing links.
 *
 * Displays the clicked URL, total click count with a proportional bar, and a
 * percentage change column that reflects the active comparison mode (previous
 * period or year-over-year). An expand button opens the full table in the
 * DataTableOverlay.
 *
 * @param {Object} props               - Component props.
 * @param {string} props.className     - Additional CSS classes for the Block wrapper.
 * @param {Object} props.customFilters - Optional filter overrides for the data query.
 * @return {JSX.Element} The outgoing links block.
 */
// fallow-ignore-next-line complexity
const OutgoingLinksBlock = memo( ({ className = '', customFilters }: OutgoingLinksBlockProps ) => {
	const { getValue } = useSettingsData();
	const { isLicenseValid } = useLicenseData();
	const tourActive = isTourActive();
	const isEnabled = tourActive || !! getValue( 'track_external_links' );
	const { data, isLoading, scrapingProgress } = useOutgoingLinksData({
		enabled: isEnabled,
		customFilters
	});

	const firstCycleCompleted = tourActive || !! window.burst_settings?.external_links_first_cycle_completed || 100 === scrapingProgress;

	const navigate = useNavigate();
	const location = useRouterState({ select: ( s ) => s.location });

	const columns = useMemo( () => getOutgoingLinksColumns(), []);

	const topData = useMemo( () => ( Array.isArray( data ) ? data : []).slice( 0, TOP_N ), [ data ]);

	/**
	 * Navigate to the fullscreen overlay with the outgoing_links variant active.
	 */
	const handleExpand = () => {
		navigate({
			to: '/table/$variant',
			params: { variant: 'outgoing_links' },
			search: {
				from: location.pathname,
				allowed: 'outgoing_links',
				dataTableId: 'outgoing-links',
				...location.search,
				...( customFilters ?? {})
			}
		});
	};

	const hasData = 0 < topData.length;

	if ( ! tourActive && ! isLicenseValid ) {
		return (
			<OverlayBlock
				className={ className }
				title={ __( 'Outgoing links', 'burst-statistics' ) }
				blurLabel={ __( 'Outgoing links tracking is a Pro feature.', 'burst-statistics' ) }
			>
				<UpsellCopy type="external_links" compact={ true } />
			</OverlayBlock>
		);
	}

	if ( ! isEnabled ) {
		return (
			<OverlayBlock
				className={ className }
				title={ __( 'Outgoing links', 'burst-statistics' ) }
				blurLabel={ __( 'Outgoing link tracking is disabled.', 'burst-statistics' ) }
				dataTour="outgoing-links-block"
			>
				<ActivationCopy type="outgoing_links" />
			</OverlayBlock>
		);
	}

	return (
		<Block className={ className } data-tour="outgoing-links-block">
			<BlockHeading
				className="border-b border-gray-200"
				isLoading={ isLoading }
				title={ <>
					<MetricInfo metricKey="outgoing_links" side="bottom">
						{ __( 'Outgoing links', 'burst-statistics' ) }
					</MetricInfo>
					{ hasData && (
						<ExpandTableButton onClick={ handleExpand } />
					) }
				</> }
			/>
			<BlockContent className="px-0 py-0 overflow-y-auto">
				<BarDataTable
					columns={ columns }
					data={ topData }
					rowKey={ ( row ) => row.url }
					barColumnKey="clicks"
					isLoading={ isLoading }
					emptyState={ firstCycleCompleted ? __( 'No outgoing link clicks recorded yet.', 'burst-statistics' ) : '' }
				/>
				{ ! firstCycleCompleted && (
					<div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
						<span>
							{ __( 'Burst is gathering all used external links on your site, data will appear when this is completed.', 'burst-statistics' ) }
							{ 'number' === typeof scrapingProgress && ` (${ scrapingProgress }%)` }
						</span>
					</div>
				) }
			</BlockContent>
		</Block>
	);
});

OutgoingLinksBlock.displayName = 'OutgoingLinksBlock';

export default OutgoingLinksBlock;
