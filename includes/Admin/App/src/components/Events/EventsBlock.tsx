import { memo, useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import ExpandableBlockTitle from '@/components/Blocks/ExpandableBlockTitle';
import { BarDataTable } from '@/components/DataTable/BarDataTable';
import { useExpandableTopBlock } from '@/hooks/useExpandableTopBlock';
import useSettingsData from '@/hooks/useSettingsData';
import { useEventsData } from './useEventsData';
import { getEventsColumns } from './columns';
import { isCustomEventsEnabled } from './isCustomEventsEnabled';

type EventsBlockProps = {

	/** Additional CSS class names passed to the wrapping Block. */
	className?: string;
};

/**
 * Compact dashboard block showing the most frequent custom events.
 *
 * Displays the event name and total occurrence count for the active date
 * range. An expand button opens the full table in the DataTableOverlay.
 *
 * @param {Object} props           - Component props.
 * @param {string} props.className - Additional CSS classes for the Block wrapper.
 * @return {JSX.Element} The events block.
 */
const EventsBlock = memo( ({ className = '' }: EventsBlockProps ) => {
	const { getValue } = useSettingsData();

	const isEnabled = isCustomEventsEnabled(
		getValue( 'enable_custom_events' ),
		window.burst_settings
	);
	const { data, isLoading } = useEventsData({ enabled: isEnabled });
	const columns = useMemo( () => getEventsColumns(), []);
	const { topData, hasData, handleExpand } = useExpandableTopBlock({
		data,
		variant: 'events'
	});

	return (
		<Block className={ className }>
			<BlockHeading
				className="border-b border-gray-200"
				isLoading={ isLoading }
				title={
					<ExpandableBlockTitle
						metricKey="events"
						label={ __( 'Events', 'burst-statistics' ) }
						hasData={ isEnabled && hasData }
						onExpand={ handleExpand }
					/>
				}
			/>
			<BlockContent className="px-0 py-0 overflow-y-auto">
				{ ! isEnabled && (
					<div className="flex h-48 flex-col items-center justify-center p-4 text-center text-sm text-gray-500">
						<p className="font-medium text-gray-600 mb-1">
							{ __( 'Custom event tracking is turned off.', 'burst-statistics' ) }
						</p>
						<p className="text-xs text-gray-400">
							{ __( 'Turn on "Track custom events" in the settings to start recording events.', 'burst-statistics' ) }
						</p>
					</div>
				) }
				{ isEnabled && (
					<BarDataTable
						columns={ columns }
						data={ topData }
						rowKey={ ( row ) => row.name }
						barColumnKey="count"
						isLoading={ isLoading }
						emptyState={ __( 'No events recorded yet.', 'burst-statistics' ) }
					/>
				) }
			</BlockContent>
		</Block>
	);
});

EventsBlock.displayName = 'EventsBlock';

export default EventsBlock;
