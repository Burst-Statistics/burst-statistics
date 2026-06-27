import { memo, useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import Icon from '@/utils/Icon';
import { BarDataTable } from '@/components/DataTable/BarDataTable';
import { useOutgoingLinksData } from './useOutgoingLinksData';
import { getOutgoingLinksColumns } from './columns';
import useSettingsData from '@/hooks/useSettingsData';
import useLicenseData from '@/hooks/useLicenseData';
import UpsellOverlay from '@/components/Upsell/UpsellOverlay';
import UpsellCopy from '@/components/Upsell/UpsellCopy';
import MetricInfo from '@/components/Common/MetricInfo';

type OutgoingLinksBlockProps = {

	/** Additional CSS class names passed to the wrapping Block. */
	className?: string;
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
 * @param {Object} props           - Component props.
 * @param {string} props.className - Additional CSS classes for the Block wrapper.
 * @return {JSX.Element} The outgoing links block.
 */
const OutgoingLinksBlock = memo( ({ className = '' }: OutgoingLinksBlockProps ) => {
	const { getValue } = useSettingsData();
	const { isLicenseValid } = useLicenseData();
	const isEnabled = !! getValue( 'track_external_links' );
	const { data, isLoading, scrapingProgress } = useOutgoingLinksData( isEnabled );

	const firstCycleCompleted = !! window.burst_settings?.external_links_first_cycle_completed || 100 === scrapingProgress;

	const navigate = useNavigate();
	const location = useRouterState({ select: ( s ) => s.location });

	const columns = useMemo( () => getOutgoingLinksColumns(), []);

	const topData = useMemo( () => data.slice( 0, TOP_N ), [ data ]);

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
				...location.search
			}
		});
	};

	const hasData = 0 < topData.length;

	if ( ! isLicenseValid ) {
		return (
			<Block className={ `${ className } relative min-h-[320px] overflow-hidden` }>
				<BlockHeading title={ __( 'Outgoing links', 'burst-statistics' ) } />
				<BlockContent className="px-0 py-0 overflow-y-auto">
					<div className="flex h-48 flex-col items-center justify-center p-4 text-center text-sm text-gray-400 select-none blur-[1px]">
						<p className="font-medium text-gray-500 mb-1">
							{ __( 'Outgoing links tracking is a Pro feature.', 'burst-statistics' ) }
						</p>
					</div>
					<UpsellOverlay
						className="flex items-center justify-center pt-0 mt-0 m-0 border-0 bg-transparent"
						containerClassName="pt-1 m-1 mt-4"
						cardClassName="mx-4 min-w-fit rounded-md border border-gray-300 bg-gray-100 px-6 py-6 shadow-sm"
					>
						<UpsellCopy type="external_links" compact={true} />
					</UpsellOverlay>
				</BlockContent>
			</Block>
		);
	}

	return (
		<Block className={ className }>
			<BlockHeading
				className="border-b border-gray-200"
				isLoading={ isLoading }
				title={ <>
					<MetricInfo metricKey="outgoing_links" side="bottom">
						{ __( 'Outgoing links', 'burst-statistics' ) }
					</MetricInfo>
					{ isEnabled && hasData && (
						<button
							type="button"
							className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
							onClick={ handleExpand }
							aria-label={ __( 'Expand table', 'burst-statistics' ) }
							title={ __( 'Expand table', 'burst-statistics' ) }
						>
							<Icon name="expand" size={ 14 } />
						</button>
					) }
				</> }
			/>
			<BlockContent className="px-0 py-0 overflow-y-auto">
				{ ! isEnabled && (
					<div className="flex h-48 flex-col items-center justify-center p-4 text-center text-sm text-gray-500">
						<p className="font-medium text-gray-600 mb-1">
							{ __( 'External link tracking has been disabled.', 'burst-statistics' ) }
						</p>
						<p className="text-xs text-gray-400">
							{ __( 'You can enable it in the settings page to start tracking outgoing link clicks.', 'burst-statistics' ) }
						</p>
					</div>
				) }
				{ isEnabled && (
					<BarDataTable
						columns={ columns }
						data={ topData }
						rowKey={ ( row ) => row.url }
						barColumnKey="clicks"
						isLoading={ isLoading }
						emptyState={ firstCycleCompleted ? __( 'No outgoing link clicks recorded yet.', 'burst-statistics' ) : '' }
					/>
				) }
				{ isEnabled && ! firstCycleCompleted && (
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
