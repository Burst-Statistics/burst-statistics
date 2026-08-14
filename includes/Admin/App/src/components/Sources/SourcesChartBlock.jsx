import { useMemo, useCallback, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { ResponsiveBar } from '@nivo/bar';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockFooter } from '@/components/Blocks/BlockFooter';
import { ChartTooltip } from '@/components/Common/ChartTooltip';
import HelpTooltip from '@/components/Common/HelpTooltip';
import PopoverFilter from '@/components/Common/PopoverFilter';
import * as Popover from '@radix-ui/react-popover';
import Icon from '@/utils/Icon';
import { useBlockConfig } from '@/hooks/useBlockConfig';
import useSourcesOverTime from '@/hooks/useSourcesOverTime';
import { formatAxisLabel, formatNumber, getChartXAxisTickValues, getPercentage } from '@/utils/formatting';
import { getSourceCategoryMeta } from '@/api/getDataTableData';

const SOURCE_KEYS = [ 'search', 'social', 'referral', 'aiReferral', 'paid', 'email', 'direct' ];

const SOURCE_DESCRIPTIONS = {
	search: __( 'Visitors who found you through a search engine like Google, Bing or DuckDuckGo. No ad spend involved, just organic results.', 'burst-statistics' ),
	social: __( 'Traffic from social networks like Facebook, Instagram, LinkedIn or Reddit, either from posts, profiles or link shorteners like t.co.', 'burst-statistics' ),
	referral: __( 'Someone clicked a link to your site from another website. Not a search engine, not social, just a regular link somewhere on the web.', 'burst-statistics' ),
	aiReferral: __( 'Visitors who clicked a link in an AI tool like ChatGPT, Perplexity or Claude. A new channel worth watching as AI-generated answers increasingly link to sources.', 'burst-statistics' ),
	paid: __( 'Traffic from ads. Detected via click IDs like gclid (Google Ads) or msclkid (Bing Ads), or a UTM medium tagged as cpc, ppc or paid.', 'burst-statistics' ),
	email: __( 'Visitors from an email campaign or newsletter. Relies mostly on UTM parameters since most email clients strip the referrer before the visit reaches your site.', 'burst-statistics' ),
	direct: __( 'No referrer, no UTM parameters, no click IDs. Most analytics tools call this "Direct", which implies someone typed your URL by hand. In reality, this bucket also catches clicks from desktop apps, messaging tools, PDFs, browser extensions and any visit where tracking context got stripped along the way.', 'burst-statistics' )
};

const ALL_SOURCE_DEFINITIONS = SOURCE_KEYS.map( ( key ) => {
	const meta = getSourceCategoryMeta( key );
	return {
		key,
		label: meta.label,
		color: meta.color
	};
});

/**
 * Popover content explaining each traffic source category.
 *
 * @return {JSX.Element} Source descriptions list.
 */
function SourcesInfoContent() {
	return (
		<div className="flex flex-col gap-3">
			{ ALL_SOURCE_DEFINITIONS.map( ({ key, label, color }) => (
				<div key={ key } className="flex gap-2">
					<span
						className="mt-1 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
						style={{ backgroundColor: color }}
					/>
					<div className="min-w-0">
						<p className="text-sm font-semibold text-text-black">{ label }</p>
						<p className="text-sm text-text-gray">{ SOURCE_DESCRIPTIONS[ key ] }</p>
					</div>
				</div>
			) ) }
		</div>
	);
}

/**
 * Transform API response into flat rows for ResponsiveBar.
 * Each row represents one date with a value per source category.
 *
 * @param {Object}   data       - API response with timestamps and per-category arrays.
 * @param {number[]} timestamps - Unix timestamps (UTC seconds).
 * @return {Array} Array of bar data objects keyed by timestamp.
 */
function transformToBarData( data, timestamps ) {
	if ( ! data || ! timestamps?.length ) {
		return [];
	}

	return timestamps.map( ( ts, i ) => {
		const row = { timestamp: ts };
		SOURCE_KEYS.forEach( ( key ) => {
			row[ key ] = data[ key ]?.[ i ] ?? 0;
		});
		return row;
	});
}

/**
 * Custom tooltip for the stacked bar chart.
 *
 * @param {Object} props          - Nivo bar tooltip props.
 * @param {Object} props.data     - The full data row for the hovered bar group.
 * @param {string} props.interval - Time grouping interval.
 * @return {JSX.Element} Tooltip content.
 */
function SourcesBarTooltip({ data, interval }) {
	const selectedMetric = useSourcesStore( ( state ) => state.selectedMetric );
	const metricLabel = METRIC_POPOVER_OPTIONS[ selectedMetric ]?.label ?? __( 'Visitors', 'burst-statistics' );
	const dateLabel = formatAxisLabel( data.timestamp, interval, false );

	const total = SOURCE_KEYS.reduce( ( sum, key ) => sum + Number( data[ key ] ?? 0 ), 0 );

	return (
		<ChartTooltip>
			<p className="mb-2 font-semibold text-gray-700">{ dateLabel }</p>
			<table className="w-full border-collapse text-sm">
				<thead>
					<tr className="border-b border-gray-200 text-xs text-gray-600">
						<th className="pb-1.5 text-left font-medium">{ __( 'Source', 'burst-statistics' ) }</th>
						<th className="pb-1.5 text-right font-medium">{ metricLabel }</th>
						<th className="pb-1.5 text-right font-medium">%</th>
					</tr>
				</thead>
				<tbody>
					{ SOURCE_KEYS.map( ( key ) => {
						const value = Number( data[ key ] ?? 0 );
						const pct = 0 < total ?
							getPercentage( value, total ) :
							getPercentage( 0, 1 );
						return (
							<tr key={ key }>
								<td className="py-0.5 pr-4">
									<span className="flex items-center gap-1.5 text-gray-800">
										<span
											className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm"
											style={{ backgroundColor: getSourceCategoryMeta( key ).color }}
										/>
										{ getSourceCategoryMeta( key ).label }
									</span>
								</td>
								<td className="py-0.5 text-right text-gray-600 tabular-nums">
									{ formatNumber( value, 0, false ) }
								</td>
								<td className="py-0.5 pl-2 text-right font-medium text-gray-900 tabular-nums">
									{ pct }
								</td>
							</tr>
						);
					}) }
				</tbody>
				<tfoot>
					<tr className="border-t border-gray-200">
						<td className="pt-1.5 text-gray-700">{ __( 'Total', 'burst-statistics' ) }</td>
						<td className="pt-1.5 text-right text-gray-700 tabular-nums">
							{ formatNumber( total, 0, false ) }
						</td>
						<td className="pt-1.5 pl-2 text-right text-gray-700 tabular-nums">100%</td>
					</tr>
				</tfoot>
			</table>
		</ChartTooltip>
	);
}

import useSourcesStore from '@/store/useSourcesStore';

const INTERVAL_OPTIONS = [
	{ value: 'auto', label: __( 'Auto', 'burst-statistics' ) },
	{ value: 'day', label: __( 'Day', 'burst-statistics' ) },
	{ value: 'week', label: __( 'Week', 'burst-statistics' ) },
	{ value: 'month', label: __( 'Month', 'burst-statistics' ) }
];

const METRIC_POPOVER_OPTIONS = {
	visitors: { label: __( 'Visitors', 'burst-statistics' ), default: true },
	pageviews: { label: __( 'Pageviews', 'burst-statistics' ) },
	sessions: { label: __( 'Sessions', 'burst-statistics' ) }
};

const INTERVAL_THRESHOLDS = {
	day: 90,   // disable 'day' when range > 90 days
	week: 365, // disable 'week' when range > 365 days
	month: Infinity,
	auto: Infinity
};

/**
 * SourcesHeader renders the popover for metric and grouping selection using PopoverFilter.
 *
 * @param {Object} props           - Component props.
 * @param {number} props.rangeDays - Active date range span in days.
 * @return {JSX.Element} Popover filter for sources chart header.
 */
function SourcesHeader({ rangeDays }) {
	const groupBy = useSourcesStore( ( state ) => state.groupBy );
	const setGroupBy = useSourcesStore( ( state ) => state.setGroupBy );
	const selectedMetric = useSourcesStore( ( state ) => state.selectedMetric );
	const setSelectedMetric = useSourcesStore( ( state ) => state.setSelectedMetric );

	const onApply = ( selectedOptions ) => {
		if ( selectedOptions && selectedOptions[ 0 ]) {
			setSelectedMetric( selectedOptions[ 0 ]);
		}
	};

	const renderIntervalSelector = ( pendingValue, setPendingValue ) => (
		<div className="flex flex-col gap-1.5">
			<span className="text-xs font-semibold text-text-gray uppercase tracking-wide">
				{ __( 'Group by', 'burst-statistics' ) }
			</span>
			<div
				role="radiogroup"
				aria-label={ __( 'Group by', 'burst-statistics' ) }
				className="grid grid-flow-col auto-cols-fr gap-0.5 border border-gray-300 rounded-md bg-gray-200 p-0.5 shadow-xs"
			>
				{ INTERVAL_OPTIONS.map( ( option ) => {
					const isActive   = pendingValue === option.value;
					const isDisabled = 0 < rangeDays && INTERVAL_THRESHOLDS[ option.value ] < rangeDays;
					return (
						<button
							key={ option.value }
							type="button"
							role="radio"
							aria-checked={ isActive }
							disabled={ isDisabled }
							title={
								isDisabled ?
									__( 'Too many data points for this date range', 'burst-statistics' ) :
									undefined
							}
							onClick={ () => ! isDisabled && setPendingValue( option.value ) }
							className={ [
								'text-xs px-2 py-1 transition-colors rounded-xs focus:outline-hidden font-medium',
								isDisabled ?
									'bg-white text-gray-300 border border-transparent cursor-not-allowed' :
									isActive ?
										'bg-green-50 text-green border-green border' :
										'bg-white text-text-gray hover:bg-gray-50 border border-transparent'
							].join( ' ' ) }
						>
							{ option.label }
						</button>
					);
				}) }
			</div>
		</div>
	);

	return (
		<PopoverFilter
			id="sources_chart_filter"
			selectedOptions={ [ selectedMetric ] }
			options={ METRIC_POPOVER_OPTIONS }
			selectionMode="single"
			onApply={ onApply }
			extraSection={ renderIntervalSelector }
			extraSectionValue={ groupBy }
			onExtraSectionChange={ setGroupBy }
		/>
	);
}

/**
 * Sources over-time stacked bar chart block.
 *
 * @param {Object} props - Block component props.
 * @return {JSX.Element} The rendered block.
 */
// fallow-ignore-next-line complexity
const SourcesChartBlock = ( props ) => {
	const { startDate, endDate, range, filters, isReport, index } = useBlockConfig( props );

	const groupBy = useSourcesStore( ( state ) => state.groupBy );
	const setGroupBy = useSourcesStore( ( state ) => state.setGroupBy );
	const selectedMetric = useSourcesStore( ( state ) => state.selectedMetric );

	const args = useMemo(
		() => ({ filters, group_by: groupBy, metric: selectedMetric }),
		[ filters, groupBy, selectedMetric ]
	);

	// Compute the date range in days so we can disable overly-granular intervals.
	// fallow-ignore-next-line complexity
	const rangeDays = useMemo( () => {
		const startMs = Date.parse( startDate || '' );
		const endMs   = Date.parse( endDate || '' );
		return ( ! isNaN( startMs ) && ! isNaN( endMs ) && endMs > startMs ) ?
			Math.round( ( endMs - startMs ) / 86400000 ) : 0;
	}, [ startDate, endDate ]);

	// Auto-reset groupBy to 'auto' if the current value is now disabled.
	useEffect( () => {
		if ( 0 < rangeDays && INTERVAL_THRESHOLDS[ groupBy ] < rangeDays ) {
			setGroupBy( 'auto' );
		}
	}, [ rangeDays, groupBy, setGroupBy ]);

	const query = useSourcesOverTime({
		startDate,
		endDate,
		range,
		args
	});

	const isLoading = query.isFetching || query.isLoading;

	// fallow-ignore-next-line complexity
	const timestamps = useMemo( () => {
		if ( query.data?.timestamps?.length ) {
			return query.data.timestamps;
		}
		const startMs = Date.parse( startDate || '' );
		const endMs   = Date.parse( endDate || '' );
		if ( ! isNaN( startMs ) && ! isNaN( endMs ) && endMs > startMs ) {
			const startSec = Math.floor( startMs / 1000 );
			const endSec   = Math.floor( endMs / 1000 );
			const step     = ( endSec - startSec ) / 6;
			const dummy    = [];
			for ( let i = 0; 7 > i; i++ ) {
				dummy.push( Math.round( startSec + i * step ) );
			}
			return dummy;
		}
		return [];
	}, [ query.data, startDate, endDate ]);

	/**
	 * Detect the time granularity from the gap between the first two timestamps.
	 * Falls back to 'day' when there is only one timestamp or no data.
	 * Thresholds (in seconds):
	 *   < 7 200  (~2 h)  → hour
	 *   < 172 800 (2 days) → day
	 *   < 1 209 600 (14 days) → week
	 *   < 10 368 000 (120 days) → month
	 *   else → year
	 */
	// fallow-ignore-next-line complexity
	const interval = useMemo( () => {
		if ( 2 > timestamps.length ) {
			return 'day';
		}
		const gap = timestamps[ 1 ] - timestamps[ 0 ];
		if ( 7200 > gap ) {
			return 'hour';
		}
		if ( 172800 > gap ) {
			return 'day';
		}
		if ( 1209600 > gap ) {
			return 'week';
		}
		if ( 10368000 > gap ) {
			return 'month';
		}
		return 'year';
	}, [ timestamps ]);

	const barData = useMemo(
		() => transformToBarData( query.data, timestamps ),
		[ query.data, timestamps ]
	);

	const displayedBarData = useMemo( () => {
		if ( isLoading ) {
			return timestamps.map( ( ts ) => {
				const emptyRow = { timestamp: ts };
				SOURCE_KEYS.forEach( ( key ) => {
					emptyRow[ key ] = 0;
				});
				return emptyRow;
			});
		}
		return barData;
	}, [ isLoading, timestamps, barData ]);

	const maxBarValue = useMemo( () => {
		if ( ! barData || 0 === barData.length ) {
			return 0;
		}
		return Math.max(
			...barData.map( ( row ) =>
				SOURCE_KEYS.reduce( ( sum, key ) => sum + Number( row[ key ] ?? 0 ), 0 )
			)
		);
	}, [ barData ]);

	// fallow-ignore-next-line complexity
	const yTickValues = useMemo( () => {
		const maxValue = maxBarValue;
		if ( 0 >= maxValue || isNaN( maxValue ) || ! isFinite( maxValue ) ) {
			return [ 0, 1 ];
		}

		// Aim for 5 ticks. Compute the raw interval per tick.
		const TARGET_TICKS = 5;
		const rawInterval = maxValue / TARGET_TICKS;
		if ( 0 >= rawInterval || isNaN( rawInterval ) || ! isFinite( rawInterval ) ) {
			return [ 0, 1 ];
		}

		// Round the interval UP to the nearest "nice" number (1, 2, 5 × power of 10).
		const power = Math.pow( 10, Math.floor( Math.log10( rawInterval ) ) );
		const fraction = rawInterval / power;

		let niceFraction;
		if ( 1 >= fraction ) {
			niceFraction = 1;
		} else if ( 2 >= fraction ) {
			niceFraction = 2;
		} else if ( 5 >= fraction ) {
			niceFraction = 5;
		} else {
			niceFraction = 10;
		}

		let niceInterval = Math.max( 1, niceFraction * power );

		// Guard: if we'd generate more than 6 ticks, keep doubling the interval.
		let maxTick = Math.ceil( maxValue / niceInterval ) * niceInterval;
		while ( 5 < maxTick / niceInterval ) {
			niceInterval *= 2;
			maxTick = Math.ceil( maxValue / niceInterval ) * niceInterval;
		}

		const ticks = [];
		for ( let val = 0; val <= maxTick; val += niceInterval ) {
			ticks.push( val );
		}
		return ticks;
	}, [ maxBarValue ]);

	const tickValues = useMemo(
		() => getChartXAxisTickValues( timestamps, 'hour' === interval ? 12 : 7 ),
		[ timestamps, interval ]
	);

	const labelByTimestamp = useMemo(
		() => new Map( timestamps.map( ( ts ) => [ String( ts ), formatAxisLabel( ts, interval, false ) ]) ),
		[ timestamps, interval ]
	);

	const formatTick = useCallback(
		( value ) => labelByTimestamp.get( String( value ) ) ?? '',
		[ labelByTimestamp ]
	);

	return (
		<Block className="row-span-2 @lg:col-span-12 @xl:col-span-9 group/root">
			<BlockHeading
				title={ __( 'Sources over time', 'burst-statistics' ) }
				isReport={ isReport }
				reportBlockIndex={ index }
				isLoading={ query.isFetching || query.isLoading }
				controls={
					<div className="flex items-center gap-2">
						<SourcesHeader rangeDays={ rangeDays } />
						<Popover.Root>
							<Popover.Trigger asChild>
								<button
									type="button"
									aria-label={ __( 'Source definitions', 'burst-statistics' ) }
									className="flex items-center justify-center rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
								>
									<Icon name="help" size={ 18 } />
								</button>
							</Popover.Trigger>
							<Popover.Content
								side="bottom"
								align="end"
								sideOffset={ 8 }
								className="z-[10001] w-[380px] rounded-lg border border-gray-200 bg-white shadow-xl animate-in fade-in-50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
							>
								<div className="border-b border-gray-100 px-4 py-3">
									<h5 className="m-0 text-sm font-semibold text-text-black">
										{ __( 'Source definitions', 'burst-statistics' ) }
									</h5>
								</div>
								<div className="max-h-[420px] overflow-y-auto px-4 py-3">
									<SourcesInfoContent />
								</div>
								<Popover.Arrow className="fill-white drop-shadow-xs" />
							</Popover.Content>
						</Popover.Root>
					</div>
				}
			/>
			<BlockContent className="px-0 py-0">
				<div
					className={ isLoading ? 'animate-pulse opacity-70 transition-opacity duration-300' : 'transition-opacity duration-300' }
					style={{ height: 320 }}
				>
					{ 0 < displayedBarData.length && (
						<ResponsiveBar
							data={ displayedBarData }
							keys={ SOURCE_KEYS }
							indexBy="timestamp"
							groupMode="stacked"
							margin={{ top: 20, right: 24, bottom: 56, left: 56 }}
							padding={ 0.3 }
							colors={ ({ id }) => getSourceCategoryMeta( id ).color }
							borderRadius={ 2 }
							enableLabel={ false }
							animate={ true }
							motionConfig="gentle"
							tooltip={ ( tooltipProps ) => isLoading ? null : <SourcesBarTooltip { ...tooltipProps } interval={ interval } /> }
							axisBottom={{
								tickSize: 0,
								tickPadding: 12,
								tickValues,
								format: formatTick
							}}
							axisLeft={{
								tickSize: 0,
								tickPadding: 12,
								tickValues: yTickValues,
								format: ( value ) => formatNumber( Number( value ), 0 )
							}}
							enableGridX={ false }
							enableGridY={ true }
							gridYValues={ yTickValues }
							theme={{
								grid: { line: { stroke: 'var(--color-gray-300)', strokeWidth: 1 } },
								axis: {
									ticks: { text: { fill: 'var(--color-gray-600)', fontSize: 12 } },
									domain: { line: { stroke: 'var(--color-gray-400)', strokeWidth: 1 } }
								}
							}}
						/>
					) }
				</div>
			</BlockContent>
			<BlockFooter>
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
					{ SOURCE_KEYS.map( ( key ) => (
						<HelpTooltip
							key={ key }
							content={ SOURCE_DESCRIPTIONS[ key ] }
							side="bottom"
							delayDuration={ 200 }
						>
							<span className="flex cursor-default items-center gap-1.5 text-sm text-gray-600">
								<span
									className="inline-block h-2.5 w-2.5 rounded-full"
									style={{ backgroundColor: getSourceCategoryMeta( key ).color }}
								/>
								{ getSourceCategoryMeta( key ).label }
							</span>
						</HelpTooltip>
					) ) }
				</div>
				<div>
					<p className="text-sm text-gray-600">
					{/* @TODO: Add bot detection block and link to it.  */}
						{__( 'Bot traffic is excluded from sources data.' )}
					</p>
				</div>
			</BlockFooter>
		</Block>
	);
};

SourcesChartBlock.displayName = 'SourcesChartBlock';

export default SourcesChartBlock;
