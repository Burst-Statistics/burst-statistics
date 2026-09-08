import { __ } from '@wordpress/i18n';
import {
	BarCustomLayerProps,
	BarTooltipProps,
	ResponsiveBar
} from '@nivo/bar';
import { formatDuration } from '@/utils/formatting';
import { ChartTooltip } from '@/components/Common/ChartTooltip';
import { ScrollDepthDatum } from '@/api/getScrollAnalyticsData';
import { SCROLL_DEPTH_DATA } from './scrollDepthMockData';

/**
 * Custom tooltip for the scroll depth chart — uses the shared ChartTooltip
 * wrapper so dark-mode styling matches all other charts in the app.
 *
 * @param props - Nivo bar tooltip props.
 * @return Styled tooltip card.
 */
const ScrollDepthTooltip = ( props: BarTooltipProps<ScrollDepthDatum> ) => {
	const datum = props.data as ScrollDepthDatum;
	const dwell = 'number' === typeof datum.dwellSeconds && ! isNaN( datum.dwellSeconds ) ?
		formatDuration( datum.dwellSeconds ) :
		'—';

	const hasRaw = 0 < datum.visitors;

	return (
		<ChartTooltip>
			<p className="mb-1 font-semibold text-text-black">{ datum.range }</p>
			<div className="flex flex-col gap-0.5">
				<span className="text-text-gray">
					{ __( 'Reach', 'burst-statistics' ) }:{ ' ' }
					<span className="font-medium text-text-black">
						{ datum.percentage }%
						{ hasRaw && (
							<span className="ml-1 text-text-gray font-normal">({ datum.visitors })</span>
						) }
					</span>
				</span>
				<span className="text-text-gray">
					{ __( 'Avg. dwell', 'burst-statistics' ) }:{ ' ' }
					<span className="font-medium text-text-black">{ dwell }</span>
				</span>
			</div>
		</ChartTooltip>
	);
};

/**
 * Renders each track background, range label, and dwell time from the bar geometry.
 *
 * @param props - Nivo custom-layer properties.
 * @return SVG context for each scroll-depth row.
 */
const ScrollDepthTracks = ({
	bars,
	innerWidth
}: BarCustomLayerProps<ScrollDepthDatum> ) => (
	<g>
		{ bars.map( ( bar ) => {
			const centerY = bar.y + ( bar.height / 2 );
			const datum = bar.data.data;
			const dwellSeconds = 'number' === typeof datum.dwellSeconds && ! isNaN( datum.dwellSeconds ) ?
				datum.dwellSeconds :
				0;

			return (
				<g key={ bar.key }>
					<rect
						x={ 0 }
						y={ bar.y }
						width={ innerWidth }
						height={ bar.height }
						rx={ 5 }
						fill="var(--color-gray-100)"
					/>
					<text
						x={ -10 }
						y={ centerY }
						textAnchor="end"
						dominantBaseline="central"
						fontSize={ 12 }
						fill="var(--color-text-gray)"
					>
						{ datum.range }
					</text>
					<g
						transform={ `translate(${innerWidth + 12} ${centerY})` }
						stroke="var(--color-text-gray)"
						fill="none"
						strokeWidth={ 1.5 }
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<circle r={ 7 } />
						<path d="M 0 -4 V 0 L 3 2" />
					</g>
					<text
						x={ innerWidth + 23 }
						y={ centerY }
						dominantBaseline="central"
						fontSize={ 12 }
						fill="var(--color-text-gray)"
					>
						{ 0 === dwellSeconds ? '—' : formatDuration( dwellSeconds ) }
					</text>
				</g>
			);
		}) }
	</g>
);

interface ScrollDepthChartProps {
	data?: ScrollDepthDatum[];
	meaningfulVisits?: number;
}

/**
 * Displays scroll reach as horizontal bars with dwell time beside each zone.
 *
 * @param props      - Component props.
 * @param props.data - Live scroll depth chart data.
 * @return Scroll-depth bar chart.
 */
export const ScrollDepthChart = ({ data }: ScrollDepthChartProps ) => {
	const chartData = ( data && 0 < data.length ? [ ...data ] : [ ...SCROLL_DEPTH_DATA ]).reverse();

	return (
		<div className="h-56 min-w-0">
			<ResponsiveBar<ScrollDepthDatum>
				data={ chartData }
				keys={ [ 'percentage' ] }
				indexBy="range"
				layout="horizontal"
				margin={{ top: 4, right: 48, bottom: 4, left: 68 }}
				padding={ 0.28 }
				minValue={ 0 }
				maxValue={ 100 }
				colors={ [ 'var(--color-green-500)' ] }
				borderRadius={ 5 }
				enableGridX={ false }
				enableGridY={ false }
				axisTop={ null }
				axisRight={ null }
				axisBottom={ null }
				axisLeft={ null }
				label={ ( datum ) => `${ datum.value ?? 0 }%` }
				labelTextColor="var(--color-text-white)"
				labelSkipWidth={ 24 }
				layers={ [ ScrollDepthTracks, 'bars' ] }
				tooltip={ ScrollDepthTooltip as React.FC<BarTooltipProps<ScrollDepthDatum>> }
				motionConfig="gentle"
				role="application"
				ariaLabel={ __(
					'Percentage of pageviews reaching each scroll-depth range with average dwell time',
					'burst-statistics'
				) }
			/>
		</div>
	);
};
