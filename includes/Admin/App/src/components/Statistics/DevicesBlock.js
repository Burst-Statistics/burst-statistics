import { __, sprintf } from '@wordpress/i18n';
import ClickToFilter from '../Common/ClickToFilter';
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
import {useBlockConfig} from '@/hooks/useBlockConfig';
import useSettingsData from '@/hooks/useSettingsData';

// Memoize the device item to prevent unnecessary re-renders.
const DeviceItem = memo( ({ deviceKey, deviceData, communityTooltipText, communityTooltipLink }) => {
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
				metricKey={deviceKey}
				communityTooltipText={communityTooltipText}
				communityTooltipLink={communityTooltipLink}
			/>
		</ClickToFilter>
	);
});

DeviceItem.displayName = 'DeviceItem';

const DevicesBlock = ( props ) => {
	const { startDate, endDate, range, filters, isReport, index } = useBlockConfig( props );

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
			// fallow-ignore-next-line complexity
			Object.keys( mergedData ).forEach( ( key ) => {
				if ( subtitleQuery.data[key]) {
					let subtitle = subtitleQuery.data[key].subtitle;
					const count = titleAndValueQuery.data[key].count || 0;
					const topCount = subtitleQuery.data[key].top_count || 0;
					if ( 0 < count && 0 < topCount && '-' !== subtitle ) {
						const percentage = Math.round( ( topCount / count ) * 100 );
						subtitle = `${subtitle} (${percentage}%)`;
					}

					mergedData[key] = {
						...mergedData[key],
						...subtitleQuery.data[key],
						subtitle
					};
				}
			});
			return mergedData;
		}
		return placeholderData;
	}, [ titleAndValueQuery.data, subtitleQuery.data, placeholderData ]);


	const isLoading = titleAndValueQuery.isFetching || subtitleQuery.isFetching;
	const { getValue } = useSettingsData();

	// These are constant across all device rows — compute once outside the map.
	const anonymousUsageDataEnabled = getValue( 'anonymous_usage_data' );
	const communityData = window.burst_settings?.community_data;

	// Memoize the device keys to prevent recreation of the array on every render
	const deviceKeys = useMemo( () => Object.keys( data ), [ data ]);
	return (
		<Block className="row-span-1 @lg:col-span-6 @xl:col-span-3">
			<BlockHeading title={__( 'Devices', 'burst-statistics' )} isReport={isReport} reportBlockIndex={index} isLoading={isLoading} />
			<BlockContent>
				{/* fallow-ignore-next-line complexity */}
				{deviceKeys.map( ( key ) => {
					let communityTooltipText = null;
					let communityTooltipLink = false;

					if ( ! anonymousUsageDataEnabled ) {
						communityTooltipText = __( 'Opt in to data sharing to see how your site compares to peers.', 'burst-statistics' );
						communityTooltipLink = true;
					} else if ( communityData && ! communityData.insufficient_data && communityData.devices ) {
						const avg = communityData.devices[key];
						if ( 'number' === typeof avg ) {
							communityTooltipText = sprintf(
								__( 'Community average: %s%% of visitors use %s.', 'burst-statistics' ),
								avg.toFixed( 1 ),
								data[key].title.toLowerCase()
							);
						}
					}

					return (
						<DeviceItem
							key={key}
							deviceKey={key}
							deviceData={data[key]}
							communityTooltipText={communityTooltipText}
							communityTooltipLink={communityTooltipLink}
						/>
					);
				})}
			</BlockContent>
		</Block>
	);
};

// Export a memoized version of the component
export default memo( DevicesBlock );
