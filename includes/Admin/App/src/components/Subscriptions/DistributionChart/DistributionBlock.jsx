import { __ } from '@wordpress/i18n';
import { useQuery } from '@tanstack/react-query';
import { ResponsivePie } from '@nivo/pie';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import SelectInput from '@/components/Inputs/SelectInput';
import { useDate } from '@/store/useDateStore';
import { useFilters } from '@/hooks/useFilters';
import { useSubscriptionsStore } from '@/store/useSubscriptionsStore';
import { DistributionTooltip } from './DistributionTooltip';
import {
	DISTRIBUTION_COLORS,
	DISTRIBUTION_PLACEHOLDER_DATA,
	DISTRIBUTION_LOADING_COLORS,
	fetchDistributionData
} from './distributionData';

const options = [
	{ label: __( 'Gateways', 'burst-statistics' ), value: 'gateways' },
	{ label: __( 'Currencies', 'burst-statistics' ), value: 'currencies' },
	{ label: __( 'Countries', 'burst-statistics' ), value: 'countries' }
];

const EMPTY_STATE_DATA = [
	{ id: 'empty', label: __( 'No data', 'burst-statistics' ), value: 100 }
];

/**
 * Legend displayed below the pie chart.
 *
 * @param {Object}   props        - Component props.
 * @param {Array}    props.data   - The pie slice data array.
 * @param {string[]} props.colors - The color palette for slices.
 * @return {JSX.Element} The legend element.
 */
function DistributionLegend({ data, colors, isEmptyState }) {
	return (
		<div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-4 mb-4 mr-2 ml-2">
			{
				isEmptyState ?
					(
						<div className="mt-4 text-sm text-center text-gray-500">
							{ __( 'No distribution data for this period.', 'burst-statistics' ) }
						</div>
					) :
					data.map( ( item, index ) => (
						<div key={ item.id } className="flex items-center gap-1.5">
							<span
								className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
								style={{ backgroundColor: colors[ index % colors.length ] }}
							/>
							<span className="text-sm text-gray-500">{ item.label }</span>
							<span className="text-sm font-medium text-gray-700">{ item.value }%</span>
						</div>
					) )
			}
		</div>
	);
}

/**
 * DistributionBlock component.
 * Displays a pie chart showing the percentage distribution of
 * subscriptions by gateway or currency.
 *
 * @return {JSX.Element} The DistributionBlock component.
 */
export function DistributionBlock() {
	const selectedView = useSubscriptionsStore( ( state ) => state.distributionView );
	const onViewChange = useSubscriptionsStore( ( state ) => state.setDistributionView );


	const { startDate, endDate, range } = useDate( ( state ) => state );
	const { filters } = useFilters();

	const distributionQuery = useQuery({
		queryKey: [ 'distributionChart', selectedView, startDate, endDate, range, filters ],
		queryFn: () => fetchDistributionData( selectedView, { startDate, endDate, range, filters }),
		placeholderData: DISTRIBUTION_PLACEHOLDER_DATA,
		gcTime: 10000
	});

	const isFetching = distributionQuery.isFetching;
	const hasData = Array.isArray( distributionQuery.data ) && 0 < distributionQuery.data.length;
	const isEmptyState = ! isFetching && ! distributionQuery.isError && ! hasData;

	let data = distributionQuery.data ?? DISTRIBUTION_PLACEHOLDER_DATA;
	let colors = DISTRIBUTION_COLORS[ selectedView ];

	if ( isFetching ) {
		data = DISTRIBUTION_PLACEHOLDER_DATA;
		colors = DISTRIBUTION_LOADING_COLORS;
	} else if ( isEmptyState ) {
		data = EMPTY_STATE_DATA;
		colors = [ 'var(--color-gray-300)' ];
	}

	return (
		<Block className="row-span-1 lg:col-span-6 xl:col-span-3">
			<BlockHeading
				title={ __( 'Distribution', 'burst-statistics' ) }
				className="border-b border-gray-200"
				isLoading={ isFetching }
				controls={
					<div className="flex items-center gap-2.5">
						<SelectInput
							options={ options }
							value={ selectedView }
							onChange={ onViewChange }
						/>
					</div>
				}
			/>

			<BlockContent className="px-0 py-0">
				{ distributionQuery.isError && (
					<p className="px-6 py-4 text-sm text-red-600">
						{ __( 'Failed to load distribution data.', 'burst-statistics' ) }
					</p>
				) }

				<div
					style={{ height: 300 }}
					aria-busy={ isFetching }
					className={ isFetching ? 'animate-pulse' : undefined }
				>
					<ResponsivePie
						data={ data }
						colors={ colors }
						margin={{ top: 24, right: 24, bottom: 24, left: 24 }}
						innerRadius={ 0.55 }
						padAngle={ 1.5 }
						cornerRadius={ 3 }
						activeOuterRadiusOffset={ 6 }
						borderWidth={ 0 }
						enableArcLinkLabels={ false }
						arcLabel={ false }
						tooltip={ isFetching || isEmptyState ? () => null : DistributionTooltip }
						theme={{
							labels: {
								text: { fontSize: 12, fontWeight: 600 }
							}
						}}
					/>
				</div>

				<DistributionLegend data={ data } colors={ colors } isEmptyState={ isEmptyState } />
			</BlockContent>
		</Block>
	);
}
