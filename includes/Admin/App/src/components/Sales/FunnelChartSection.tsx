import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDate } from '@/store/useDateStore';
import { useFilters } from '@/hooks/useFilters';
import { getFunnelData } from '@/api/getFunnelData';
import { __ } from '@wordpress/i18n';
import { Block } from '@/components/Blocks/Block';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { FunnelChartHeader } from '@/components/Sales/FunnelChartHeader';
import { useFunnelStore } from '@/store/useFunnelStore';
import { FunnelChart, FunnelStage } from './Funnel';

/**
 * Placeholder data for the funnel chart to prevent layout shifts.
 * Uses 0 values for numbers and '-' for text fields.
 * Note: IDs here don't affect animations since FunnelChart uses index-based IDs.
 */
const placeholderFunnelData: FunnelStage[] = [
	{
		id: 'placeholder-0',
		stage: '-',
		value: 0
	},
	{
		id: 'placeholder-1',
		stage: '-',
		value: 0
	},
	{
		id: 'placeholder-2',
		stage: '-',
		value: 0
	},
	{
		id: 'placeholder-3',
		stage: '-',
		value: 0
	},
	{
		id: 'placeholder-4',
		stage: '-',
		value: 0
	}
];

/**
 * FunnelChartSection component to fetch and display the funnel chart within a block.
 *
 * @return {JSX.Element} The FunnelChartSection component.
 */
const FunnelChartSection: React.FC = () => {
	const { startDate, endDate, range } = useDate( ( state ) => state );
	const { filters } = useFilters();
	const selectedPages = useFunnelStore( ( state ) => state.selectedPages );

	const funnelQuery = useQuery<FunnelStage[] | null>({
		queryKey: [
			'funnelData',
			startDate,
			endDate,
			range,
			filters,
			selectedPages
		],
		queryFn: () =>
			getFunnelData({
				startDate,
				endDate,
				range,
				filters,
				selectedPages
			}),
		placeholderData: placeholderFunnelData,
		gcTime: 10000
	});

	const data = funnelQuery.data ?? placeholderFunnelData;

	const blockHeadingProps = {
		title: __( 'Funnel', 'burst-statistics' ),
		controls: <FunnelChartHeader />
	};

	const blockContentProps = {
		className: 'p-0'
	};

	return (
		<Block className="row-span-2 xl:col-span-6 z-[1] group/root">
			<BlockHeading {...blockHeadingProps} />

			<BlockContent {...blockContentProps}>
					<FunnelChart data={data} />
			</BlockContent>
		</Block>
	);
};

export default FunnelChartSection;
