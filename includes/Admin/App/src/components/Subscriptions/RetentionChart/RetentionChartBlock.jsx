import { useQuery } from '@tanstack/react-query';
import { __ } from '@wordpress/i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ResponsiveHeatMap } from '@nivo/heatmap';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import SelectInput from '@/components/Inputs/SelectInput';
import { useDate } from '@/store/useDateStore';
import { useSubscriptionsStore } from '@/store/useSubscriptionsStore';
import { RetentionTooltip } from './RetentionTooltip';
import {
	QUERY_CONFIG,
	fetchRetentionData
} from './retentionData';

const PLACEHOLDER_COLUMNS = [ 'M+0', 'M+1', 'M+2', 'M+3', 'M+4', 'M+5', 'M+6' ];
const PLACEHOLDER_ROWS = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun' ];

const createPlaceholderRows = () => {
	return PLACEHOLDER_ROWS.map( ( label ) => ({
		id: label,
		signup_count: 0,
		data: PLACEHOLDER_COLUMNS.map( ( column ) => ({
			x: column,
			y: null
		}) )
	}) );
};

const RETENTION_PLACEHOLDER_RESPONSE = {
	rows: createPlaceholderRows(),
	products: [],
	max_offset: PLACEHOLDER_COLUMNS.length
};

/**
 * Gradient legend displayed in the BlockHeading controls area.
 *
 * @return {JSX.Element} The gradient legend element.
 */
function RetentionLegend() {
	return (
		<div className="flex items-center gap-2">
			<span className="text-sm text-gray-500">{ __( 'Low', 'burst-statistics' ) }</span>
			<div
				className="w-24 h-3 rounded-sm"
				style={{ background: 'linear-gradient(to right, var(--color-primary-100), var(--color-primary-700))' }}
			/>
			<span className="text-sm text-gray-500">{ __( 'High retention', 'burst-statistics' ) }</span>
		</div>
	);
}

/**
 * Dynamically computes non-overlapping tick values for a Nivo heatmap x-axis.
 *
 * @param {Array}  data            - The heatmap data array
 * @param {number} containerWidth  - Total container width in px
 * @param {Object} options
 * @param {number} options.marginLeft    - default 104
 * @param {number} options.marginRight   - default 24
 * @param {number} options.fontSize      - label font size in px, default 12
 * @param {number} options.labelPadding  - minimum gap between labels in px, default 16
 * @param {string} options.fontFamily    - default 'sans-serif'
 * @param {number[]} options.preferredSteps - intervals to snap to, default [1,2,3,4,6,8,12,24]
 * @returns {string[]}
 */
function getDynamicTickValues( data, containerWidth, options = {}) {
	const {
		marginLeft = 104,
		marginRight = 24,
		charWidth = 8,
		labelPadding = 16,
		preferredSteps = [ 1, 2, 3, 4, 6, 8, 12, 24 ]
	} = options;

	const allXValues = ( data[0]?.data ?? [])
		.map( d => d.x )
		.filter( x => null != x );

	if ( 0 === allXValues.length ) {
		return [];
	}

	const chartWidth = containerWidth - marginLeft - marginRight;

	const maxChars = Math.max( ...allXValues.map( v => String( v ).length ) );
	const slotWidth = maxChars * charWidth + labelPadding;

	const rawStep = allXValues.length / Math.max( 1, Math.floor( chartWidth / slotWidth ) );
	const step = preferredSteps.find( s => s >= rawStep ) ?? Math.ceil( rawStep );

	return allXValues.filter( ( _, i ) => 0 === i % step );
}

/**
 * RetentionChartBlock component.
 * Displays a monthly cohort retention heatmap with a per-product filter.
 *
 * @return {JSX.Element} The RetentionChartBlock component.
 */
export function RetentionChartBlock() {
	const { startDate, endDate, range } = useDate( ( state ) => state );
	const retentionProductId = useSubscriptionsStore( ( state ) => state.retentionProductId );
	const setRetentionProductId = useSubscriptionsStore( ( state ) => state.setRetentionProductId );

	const retentionQuery = useQuery({
		queryKey: [ 'retentionChart', retentionProductId, startDate, endDate, range ],
		queryFn: () =>
			fetchRetentionData({
				startDate,
				endDate,
				range,
				productId: retentionProductId
			}),
		placeholderData: RETENTION_PLACEHOLDER_RESPONSE,
		staleTime: QUERY_CONFIG.STALE_TIME,
		gcTime: QUERY_CONFIG.GC_TIME
	});

	const [ width, setWidth ] = useState( 800 );
	const ref = useRef( null );

	useEffect( () => {
		if ( ! ref.current ) {
			return;
		}
		const observer = new ResizeObserver( ([ entry ]) => {
			setWidth( entry.contentRect.width );
		});
		observer.observe( ref.current );
		return () => observer.disconnect();
	}, []);

	const isFetching = retentionQuery.isFetching;
	const retentionData = retentionQuery.data ?? RETENTION_PLACEHOLDER_RESPONSE;
	const data = retentionData.rows ?? RETENTION_PLACEHOLDER_RESPONSE.rows;

	const productOptions = useMemo( () => {
		const options = [
			{ label: __( 'All products', 'burst-statistics' ), value: 'all' }
		];

		retentionData.products.forEach( ( product ) => {
			if ( ! product?.id || ! product?.label ) {
				return;
			}

			options.push({
				label: product.label,
				value: String( product.id )
			});
		});

		return options;
	}, [ retentionData.products ]);

	// This useEffect will make sure, that product exists or not in our response, and if it does not it will go back to default option.
	// For example: We have a product from WooCommerce_Subscriptions client deactivates that plugin and moves to subscriben then the old product selected in our dashabord won't be valid so this will reset it to 'all'.
	useEffect( () => {
		if (
			'all' === retentionProductId ||
			isFetching ||
			retentionQuery.isError ||
			0 === retentionData.products.length
		) {
			return;
		}

		const hasSelectedProduct = productOptions.some(
			( option ) => option.value === retentionProductId
		);

		if ( ! hasSelectedProduct ) {
			setRetentionProductId( 'all' );
		}
	}, [ isFetching, productOptions, retentionData.products.length, retentionProductId, retentionQuery.isError, setRetentionProductId ]);

	const retentionColorScale = useCallback( ( cell ) => {
		const { value } = cell;
		if ( null == value ) {
			return 'var(--color-gray-100)';
		}
		if ( 15 > value ) {
			return 'var(--color-primary-100)';
		}
		if ( 29 > value ) {
			return 'var(--color-primary-200)';
		}
		if ( 43 > value ) {
			return 'var(--color-primary-300)';
		}
		if ( 57 > value ) {
			return 'var(--color-primary-400)';
		}
		if ( 71 > value ) {
			return 'var(--color-primary-500)';
		}
		if ( 86 > value ) {
			return 'var(--color-primary-600)';
		}
		return 'var(--color-primary-700)';
	}, []);

	const showEmptyState =
		! isFetching && ! retentionQuery.isError && 0 === data.length;

	return (
		<Block className="row-span-2 lg:col-span-12 xl:col-span-6">
			<BlockHeading
				title={__( 'Customer retention', 'burst-statistics' )}
				className="border-b border-gray-200"
				controls={
					<div className="flex items-center gap-3 flex-wrap justify-end">
						<RetentionLegend />

						<SelectInput
							options={productOptions}
							value={retentionProductId}
							onChange={setRetentionProductId}
						/>
					</div>
				}
				isLoading={isFetching}
			/>

			<BlockContent className="px-0 py-0">
				{retentionQuery.isError && (
					<p className="px-6 py-4 text-sm text-red-600">
						{__( 'Failed to load retention data.', 'burst-statistics' )}
					</p>
				)}

				{showEmptyState ? (
					<div className="h-[440px] flex items-center justify-center px-6 py-8 text-center">
						<div className="max-w-md">
							<h3 className="mb-1 text-base font-medium text-gray-600">
								{__( 'Not enough renewal history yet', 'burst-statistics' )}
							</h3>

							<p className="text-sm text-gray-400">
								{__(
									'Select a wider date range to see completed monthly retention cohorts.',
									'burst-statistics'
								)}
							</p>
						</div>
					</div>
				) : (
					<div
						style={{ height: 440 }}
						aria-busy={isFetching}
						className={isFetching ? 'animate-pulse' : undefined}
					>
						<ResponsiveHeatMap
							data={data}
							margin={{ top: 24, right: 24, bottom: 44, left: 104 }}
							valueFormat=">-.0f"
							emptyColor="var(--color-gray-100)"
							colors={retentionColorScale}
							axisTop={null}
							axisLeft={{
								tickSize: 0,
								tickPadding: 15,
								legendOffset: -100,
								legendPosition: 'middle'
							}}
							axisBottom={{
								tickSize: 0,
								tickPadding: 8,
								tickValues: getDynamicTickValues( data, width )
							}}
							animate={true}
							xInnerPadding={0.08}
							yInnerPadding={0.1}
							borderRadius={3}
							enableLabels={false}
							tooltip={isFetching ? () => null : RetentionTooltip}
							theme={{
								axis: {
									ticks: {
										text: { fill: 'var(--color-gray-600)', fontSize: 12 }
									},
									legend: {
										text: { fill: 'var(--color-gray-500)', fontSize: 11 }
									}
								}
							}}
						/>
					</div>
				)}
			</BlockContent>
		</Block>
	);
}
