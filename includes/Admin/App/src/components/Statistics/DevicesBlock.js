import { __ } from '@wordpress/i18n';
import ClickToFilter from '../Common/ClickToFilter';
import { useFilters } from '@/hooks/useFilters';
import { useDate } from '@/store/useDateStore';
import ExplanationAndStatsItem from '@/components/Common/ExplanationAndStatsItem';
import { useQuery } from '@tanstack/react-query';
import {
	getDevicesTitleAndValueData,
	getDevicesSubtitleData
} from '@/api/getDevicesData';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { useMemo, memo } from 'react';

// Memoize the device item to prevent unnecessary re-renders.
const DeviceItem = memo( ({ deviceKey, deviceData }) => {
	return (
		<ClickToFilter
			key={deviceKey}
			filter="device_id"
			filterValue={deviceData?.device_id}
			label={deviceData.title}
		>
			<ExplanationAndStatsItem
				iconKey={deviceKey}
				title={deviceData.title}
				subtitle={deviceData.subtitle}
				value={deviceData.value}
				change={deviceData.change}
				changeStatus={deviceData.changeStatus}
			/>
		</ClickToFilter>
	);
});

DeviceItem.displayName = 'DeviceItem';

const DevicesBlock = () => {
	const { startDate, endDate, range } = useDate( ( state ) => state );
	const { filters } = useFilters();

	// Memoize args to prevent unnecessary recomputations
	const args = useMemo( () => ({ filters }), [ filters ]);

	// Memoize device names
	const deviceNames = useMemo(
		() => ({
			desktop: __( 'Desktop', 'burst-statistics' ),
			tablet: __( 'Tablet', 'burst-statistics' ),
			mobile: __( 'Mobile', 'burst-statistics' ),
			other: __( 'Other', 'burst-statistics' )
		}),
		[]
	);

	// Memoize empty data structures
	const { emptyDataTitleValue, emptyDataSubtitle, placeholderData } =
		useMemo( () => {
			const emptyDataTitleValue = {};
			const emptyDataSubtitle = {};
			const placeholderData = {};

			// loop through metrics and set default values
			Object.keys( deviceNames ).forEach( function( key ) {
				emptyDataTitleValue[key] = {
					title: deviceNames[key],
					value: '-%'
				};
				emptyDataSubtitle[key] = {
					subtitle: '-'
				};
				placeholderData[key] = {
					title: deviceNames[key],
					value: '-%',
					subtitle: '-'
				};
			});

			return { emptyDataTitleValue, emptyDataSubtitle, placeholderData };
		}, [ deviceNames ]);

	const titleAndValueQuery = useQuery({
		queryKey: [ 'devicesTitleAndValue', startDate, endDate, args ],
		queryFn: () =>
			getDevicesTitleAndValueData({ startDate, endDate, range, args }),
		placeholderData: emptyDataTitleValue
	});

	const subtitleQuery = useQuery({
		queryKey: [ 'devicesSubtitle', startDate, endDate, args ],
		queryFn: () =>
			getDevicesSubtitleData({ startDate, endDate, range, args }),
		placeholderData: emptyDataSubtitle
	});


	// Memoize the merged data to prevent unnecessary recomputations
	const data = useMemo( () => {
		if ( titleAndValueQuery.data && subtitleQuery.data ) {
			const mergedData = { ...titleAndValueQuery.data }; // Clone data to avoid mutation
			Object.keys( mergedData ).forEach( ( key ) => {
				if ( subtitleQuery.data[key]) {

					// Check if it exists in subtitle data
					mergedData[key] = {
						...mergedData[key],
						...subtitleQuery.data[key]
					};
				}
			});
			return mergedData;
		}
		return placeholderData;
	}, [ titleAndValueQuery.data, subtitleQuery.data, placeholderData ]);


	// Memoize the device keys to prevent recreation of the array on every render
	const deviceKeys = useMemo( () => Object.keys( data ), [ data ]);
	return (
		<Block className="row-span-1 lg:col-span-6 xl:col-span-3">
			<BlockHeading title={__( 'Devices', 'burst-statistics' )} />
			<BlockContent>
				{deviceKeys.map( ( key ) => (
					<DeviceItem
						key={key}
						deviceKey={key}
						deviceData={data[key]}
					/>
				) )}
			</BlockContent>
		</Block>
	);
};

// Export a memoized version of the component
export default memo( DevicesBlock );
