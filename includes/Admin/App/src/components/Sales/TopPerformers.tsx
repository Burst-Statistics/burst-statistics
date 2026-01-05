/**
 * Top Performers Component.
 */
import getTopPerformers, {
	transformTopPerformersData
} from '@/api/getTopPerformersData';
import { useDate } from '@/store/useDateStore';
import { useFilters } from '@/hooks/useFilters';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { __ } from '@wordpress/i18n';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import SelectInput from '@/components/Inputs/SelectInput';
import TopPerformerStats from '@/components/Sales/TopPerformersStats';

const options = [
	{
		label: __( 'Revenue', 'burst-statistics' ),
		value: 'revenue'
	},
	{
		label: __( 'Sales', 'burst-statistics' ),
		value: 'count'
	}
];

const placeholderData = {
	'top-product': {
		title: __( 'Top product', 'burst-statistics' ),
		subtitle: '-',
		value: '-',
		exactValue: null,
		change: '-',
		changeStatus: '-'
	},
	'top-campaign': {
		title: __( 'Top campaign', 'burst-statistics' ),
		subtitle: '-',
		value: '-',
		exactValue: null,
		change: '-',
		changeStatus: '-'
	},
	'top-country': {
		title: __( 'Top country', 'burst-statistics' ),
		subtitle: '-',
		value: '-',
		exactValue: null,
		change: '-',
		changeStatus: '-'
	},
	'top-device': {
		title: __( 'Top device', 'burst-statistics' ),
		subtitle: '-',
		value: '-',
		exactValue: null,
		change: '-',
		changeStatus: '-'
	}
};

/**
 * Top Performers component.
 *
 * @return {JSX.Element} The Top Performers component.
 */
const TopPerformers = (): JSX.Element => {
	const { startDate, endDate, range } = useDate( ( state ) => state );
	const { filters } = useFilters();
	const [ selectedOption, setSelectedOption ] = useState( options[0].value );

	const { data: rawData, isLoading } = useQuery({
		queryKey: [ 'top-performers', startDate, endDate, range, filters ],
		queryFn: () => getTopPerformers({ startDate, endDate, range, filters }),
		placeholderData: null,
		gcTime: 10000
	});

	const topPerformers = useMemo(
		() => {

			// If loading or no data, use placeholder data.
			if ( isLoading || ! rawData || 0 === Object.keys( rawData ).length ) {
				return placeholderData;
			}

			// Check if rawData has the expected API structure (with 'label' property).
			const firstKey = Object.keys( rawData )[0];
			if ( ! rawData[firstKey] || ! ( 'label' in rawData[firstKey]) ) {
				return placeholderData;
			}

			// Transform the actual data.
			return transformTopPerformersData( rawData, selectedOption );
		},
		[ rawData, selectedOption, isLoading ]
	);

	const blockHeadingProps = {
		title: __( 'Top performers', 'burst-statistics' ),
		controls: (
			<div className="flex items-center gap-2.5">
				<SelectInput
					options={options}
					value={selectedOption}
					onChange={setSelectedOption}
				/>
			</div>
		)
	};

	return (
		<Block className="row-span-2 lg:col-span-6 xl:col-span-3 block-top-performers">
			<BlockHeading {...blockHeadingProps} />

			<BlockContent>
				{topPerformers &&
					Object.entries( topPerformers ).map( ([ key, value ]) => (
						<TopPerformerStats
							key={key}
							title={value.title}
							subtitle={value.subtitle}
							value={value.value}
							exactValue={value.exactValue}
							tooltipText={value.tooltipText}
							change={value.change}
							changeStatus={value.changeStatus}
							className={key}
						/>
					) )}
			</BlockContent>
		</Block>
	);
};

export default TopPerformers;
