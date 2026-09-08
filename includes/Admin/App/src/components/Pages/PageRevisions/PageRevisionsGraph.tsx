import { useMemo, useCallback } from 'react';
import { ResponsiveLine } from '@nivo/line';
import type { DefaultSeries, LineCustomSvgLayerProps } from '@nivo/line';
import { formatAxisLabel, getChartXAxisTickValues } from '@/utils/formatting';
import type { RevisionMarker } from '@/api/getPageRevisionsData';

interface PageRevisionsGraphProps {
	timestamps: number[];
	engagementSeries: number[];
	revisions: RevisionMarker[];
	selectedRevisionId: number | null;
	onRevisionSelect: ( id: number | null ) => void;
}

type RevisionLayerProps = LineCustomSvgLayerProps<DefaultSeries> & {
	revisions: RevisionMarker[];
	selectedRevisionId: number | null;
	onRevisionSelect: ( id: number | null ) => void;
};

const CIRCLE_R = 6;
const CIRCLE_TOP = -20;

/** 7 days in milliseconds — half-width of the shaded highlight region. */
const SHADE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Custom Nivo SVG layer that renders revision markers:
 * - A shaded green region + vertical line for the selected revision.
 * - A clickable circle at the top of the chart for every revision.
 *
 * @param {RevisionLayerProps} props - Nivo layer context + revision props.
 * @return {JSX.Element|null} SVG layer content.
 */
// fallow-ignore-next-line complexity
function RevisionMarkersLayer( props: RevisionLayerProps ) {
	const { xScale, innerHeight, revisions, selectedRevisionId, onRevisionSelect } = props;

	if ( ! revisions.length || ! xScale ) {
		return null;
	}

	return (
		<>
			{

				// fallow-ignore-next-line complexity
				revisions.map( ( revision ) => {
				const tsMs = revision.timestamp * 1000;
				const x = xScale( new Date( tsMs ) as never );
				const isSelected = revision.id === selectedRevisionId;

				if ( isNaN( x ) ) {
					return null;
				}

				const shadeLeft = xScale( new Date( tsMs - SHADE_MS ) as never );
				const shadeRight = xScale( new Date( tsMs + SHADE_MS ) as never );

				return (
					<g key={revision.id}>
						{isSelected && (
							<rect
								x={shadeLeft}
								y={0}
								width={Math.max( 0, shadeRight - shadeLeft )}
								height={innerHeight}
								fill="rgba(34, 197, 94, 0.08)"
							/>
						)}

						{isSelected && (
							<line
								x1={x}
								x2={x}
								y1={CIRCLE_TOP + CIRCLE_R}
								y2={innerHeight}
								stroke="rgb(34, 197, 94)"
								strokeWidth={2}
							/>
						)}

						<circle
							cx={x}
							cy={CIRCLE_TOP}
							r={CIRCLE_R}
							fill={isSelected ? 'rgb(34, 197, 94)' : 'transparent'}
							stroke={isSelected ? 'rgb(34, 197, 94)' : 'var(--color-gray-400)'}
							strokeWidth={2}
							style={{ cursor: 'pointer' }}
							onClick={() => onRevisionSelect( isSelected ? null : revision.id )}
						/>
					</g>
				);
			})}
		</>
	);
}

/**
 * PageRevisionsGraph renders the engagement score line chart with revision markers.
 * Built on top of Nivo ResponsiveLine, following InsightsGraph.js patterns.
 *
 * @param {PageRevisionsGraphProps} props - Component props.
 * @return {JSX.Element} The engagement score chart.
 */
// fallow-ignore-next-line complexity
const PageRevisionsGraph = ({
	timestamps,
	engagementSeries,
	revisions,
	selectedRevisionId,
	onRevisionSelect
}: PageRevisionsGraphProps ) => {
	const nivoData = useMemo( () => {
		if ( ! timestamps.length ) {
			return [];
		}
		return [
			{
				id: 'engagement',
				color: 'var(--color-blue-500)',
				data: timestamps.map( ( ts, i ) => ({
					x: new Date( ts * 1000 ),
					y: engagementSeries?.[i] ?? 0
				}) )
			}
		];
	}, [ timestamps, engagementSeries ]);

	const xTickValues = useMemo(
		() => getChartXAxisTickValues( timestamps.map( ( ts ) => new Date( ts * 1000 ) ) ),
		[ timestamps ]
	);

	const formatTick = useCallback( ( value: Date | number ) => {
		const ts = value instanceof Date ? value.getTime() / 1000 : Number( value ) / 1000;
		return formatAxisLabel( ts, 'day', false );
	}, []);

	const revisionLayer = useCallback(
		( layerProps: LineCustomSvgLayerProps<DefaultSeries> ) => (
			<RevisionMarkersLayer
				{...layerProps}
				revisions={revisions}
				selectedRevisionId={selectedRevisionId}
				onRevisionSelect={onRevisionSelect}
			/>
		),
		[ revisions, selectedRevisionId, onRevisionSelect ]
	);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const layers: any[] = useMemo(
		() => [
			'grid',
			'axes',
			'areas',
			revisionLayer,
			'lines',
			'points',
			'mesh'
		],
		[ revisionLayer ]
	);

	return (
		<ResponsiveLine
			data={nivoData}
			margin={{ top: 30, right: 24, bottom: 48, left: 56 }}
			xScale={{ type: 'time', format: 'native' }}
			xFormat="time:%Q"
			yScale={{ type: 'linear', min: 0, max: 100, stacked: false }}
			colors={{ datum: 'color' }}
			axisBottom={{
				tickSize: 0,
				tickPadding: 12,
				tickValues: xTickValues,
				format: formatTick
			}}
			axisLeft={{
				tickSize: 0,
				tickPadding: 12,
				tickValues: 6
			}}
			enableGridX={false}
			enableGridY={true}
			gridYValues={6}
			pointSize={0}
			lineWidth={2}
			enableSlices={false}
			curve="catmullRom"
			layers={layers}
			theme={{
				grid: { line: { stroke: 'var(--color-gray-300)', strokeWidth: 1 } },
				axis: {
					ticks: { text: { fill: 'var(--color-gray-600)', fontSize: 12 } },
					domain: { line: { stroke: 'var(--color-gray-400)', strokeWidth: 1 } }
				}
			}}
		/>
	);
};


export default PageRevisionsGraph;
