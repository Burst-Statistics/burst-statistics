import { useMemo, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveBar } from '@nivo/bar';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockFooter } from '@/components/Blocks/BlockFooter';
import { ChartTooltip } from '@/components/Common/ChartTooltip';
import HelpTooltip from '@/components/Common/HelpTooltip';
import * as Popover from '@radix-ui/react-popover';
import Icon from '@/utils/Icon';
import { useBlockConfig } from '@/hooks/useBlockConfig';
import { getSourcesOverTimeData } from '@/api/getSourcesData';
import { formatAxisLabel, formatNumber, getChartXAxisTickValues, getPercentage } from '@/utils/formatting';

const SOURCE_KEYS = [ 'search', 'social', 'referral', 'aiReferral', 'paid', 'direct' ];

const SOURCE_LABELS = {
	search: __( 'Search', 'burst-statistics' ),
	social: __( 'Social', 'burst-statistics' ),
	referral: __( 'Referral', 'burst-statistics' ),
	aiReferral: __( 'AI referral', 'burst-statistics' ),
	paid: __( 'Paid', 'burst-statistics' ),
	direct: __( 'Direct / unknown', 'burst-statistics' )
};

const SOURCE_COLORS = {
	search: 'var(--color-blue-400)',
	social: 'var(--color-yellow-400)',
	referral: 'var(--color-orange-400)',
	aiReferral: 'var(--color-primary-400)',
	paid: 'var(--color-red-400)',
	direct: 'var(--color-gray-500)'
};

const SOURCE_DESCRIPTIONS = {
	search: __( 'Visitors who found you through a search engine like Google, Bing or DuckDuckGo. No ad spend involved, just organic results.', 'burst-statistics' ),
	social: __( 'Traffic from social networks like Facebook, Instagram, LinkedIn or Reddit, either from posts, profiles or link shorteners like t.co.', 'burst-statistics' ),
	referral: __( 'Someone clicked a link to your site from another website. Not a search engine, not social, just a regular link somewhere on the web.', 'burst-statistics' ),
	aiReferral: __( 'Visitors who clicked a link in an AI tool like ChatGPT, Perplexity or Claude. A new channel worth watching as AI-generated answers increasingly link to sources.', 'burst-statistics' ),
	paid: __( 'Traffic from ads. Detected via click IDs like gclid (Google Ads) or msclkid (Bing Ads), or a UTM medium tagged as cpc, ppc or paid.', 'burst-statistics' ),
	email: __( 'Visitors from an email campaign or newsletter. Relies mostly on UTM parameters since most email clients strip the referrer before the visit reaches your site.', 'burst-statistics' ),
	direct: __( 'No referrer, no UTM parameters, no click IDs. Most analytics tools call this "Direct", which implies someone typed your URL by hand. In reality, this bucket also catches clicks from desktop apps, messaging tools, PDFs, browser extensions and any visit where tracking context got stripped along the way.', 'burst-statistics' )
};

const ALL_SOURCE_DEFINITIONS = [
	{ key: 'search', label: SOURCE_LABELS.search, color: SOURCE_COLORS.search },
	{ key: 'social', label: SOURCE_LABELS.social, color: SOURCE_COLORS.social },
	{ key: 'referral', label: SOURCE_LABELS.referral, color: SOURCE_COLORS.referral },
	{ key: 'aiReferral', label: SOURCE_LABELS.aiReferral, color: SOURCE_COLORS.aiReferral },
	{ key: 'paid', label: SOURCE_LABELS.paid, color: SOURCE_COLORS.paid },
	{ key: 'email', label: __( 'Email', 'burst-statistics' ), color: 'var(--color-green-400)' },
	{ key: 'direct', label: SOURCE_LABELS.direct, color: SOURCE_COLORS.direct }
];

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
 * @param {Object} props      - Nivo bar tooltip props.
 * @param {Object} props.data - The full data row for the hovered bar group.
 * @return {JSX.Element} Tooltip content.
 */
function SourcesBarTooltip({ data }) {
	const dateLabel = formatAxisLabel( data.timestamp, 'day', false );

	const total = SOURCE_KEYS.reduce( ( sum, key ) => sum + Number( data[ key ] ?? 0 ), 0 );

	return (
		<ChartTooltip>
			<p className="mb-2 font-semibold text-gray-700">{ dateLabel }</p>
			<table className="w-full border-collapse text-sm">
				<thead>
					<tr className="border-b border-gray-200 text-xs text-gray-600">
						<th className="pb-1.5 text-left font-medium">{ __( 'Source', 'burst-statistics' ) }</th>
						<th className="pb-1.5 text-right font-medium">{ __( 'Visits', 'burst-statistics' ) }</th>
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
											style={{ backgroundColor: SOURCE_COLORS[ key ] }}
										/>
										{ SOURCE_LABELS[ key ] }
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

/**
 * Sources over-time stacked bar chart block.
 *
 * @param {Object} props - Block component props.
 * @return {JSX.Element} The rendered block.
 */
const SourcesChartBlock = ( props ) => {
	const { startDate, endDate, range, filters, isReport, index } = useBlockConfig( props );

	const args = useMemo( () => ({ filters }), [ filters ]);

	const query = useQuery({
		queryKey: [ 'sources-over-time', startDate, endDate, range, args ],
		queryFn: () => getSourcesOverTimeData({ startDate, endDate, range, args }),
		placeholderData: { timestamps: [], search: [], social: [], referral: [], aiReferral: [], paid: [], direct: [] }
	});

	const timestamps = useMemo(
		() => query.data?.timestamps ?? [],
		[ query.data ]
	);

	const barData = useMemo(
		() => transformToBarData( query.data, timestamps ),
		[ query.data, timestamps ]
	);

	const tickValues = useMemo(
		() => getChartXAxisTickValues( timestamps ),
		[ timestamps ]
	);

	const labelByTimestamp = useMemo(
		() => new Map( timestamps.map( ( ts ) => [ String( ts ), formatAxisLabel( ts, 'day', false ) ]) ),
		[ timestamps ]
	);

	const formatTick = useCallback(
		( value ) => labelByTimestamp.get( String( value ) ) ?? '',
		[ labelByTimestamp ]
	);

	return (
		<Block className="row-span-2 @lg:col-span-12 @xl:col-span-9">
			<BlockHeading
				title={ __( 'Sources over time', 'burst-statistics' ) }
				isReport={ isReport }
				reportBlockIndex={ index }
				isLoading={ query.isFetching }
				controls={
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
								<Popover.Arrow className="fill-white drop-shadow-sm" />
							</Popover.Content>
					</Popover.Root>
				}
			/>
			<BlockContent className="px-0 py-0">
				<div
					className={ query.isFetching ? 'animate-pulse' : undefined }
					style={{ height: 320 }}
				>
					{ 0 < barData.length && (
						<ResponsiveBar
							data={ barData }
							keys={ SOURCE_KEYS }
							indexBy="timestamp"
							groupMode="stacked"
							margin={{ top: 20, right: 24, bottom: 56, left: 56 }}
							padding={ 0.3 }
							colors={ ({ id }) => SOURCE_COLORS[ id ] ?? 'var(--color-gray-400)' }
							borderRadius={ 2 }
							enableLabel={ false }
							tooltip={ SourcesBarTooltip }
							axisBottom={{
								tickSize: 0,
								tickPadding: 12,
								tickValues,
								format: formatTick
							}}
							axisLeft={{
								tickSize: 0,
								tickPadding: 12,
								tickValues: 5,
								format: ( value ) => formatNumber( Number( value ), 0 )
							}}
							enableGridX={ false }
							enableGridY={ true }
							gridYValues={ 5 }
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
									style={{ backgroundColor: SOURCE_COLORS[ key ] }}
								/>
								{ SOURCE_LABELS[ key ] }
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
