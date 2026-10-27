import React, { useMemo } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import type { InsightsData } from '@/types/insights-api';
import type { RevisionMarker } from '@/api/getPageRevisionsData';
import { formatDateShort } from '@/utils/formatting';

export interface PageviewsTrendProps {
	insightsData?: InsightsData;
	latestRevision?: RevisionMarker | null;
	isPro: boolean;
	startDate: string;
}

interface Point {
	x: number;
	y: number;
}

// fallow-ignore-next-line complexity
const calculatePoints = ( values: number[], width: number, height: number, paddingY: number ): Point[] => {
	const maxVal = Math.max( ...values, 1 );
	const minVal = Math.min( ...values, 0 );
	const range = 0 === maxVal - minVal ? 1 : maxVal - minVal;
	const innerH = height - ( paddingY * 2 );

	return values.map( ( val, idx ) => {
		const x = 1 >= values.length ? width / 2 : ( idx / ( values.length - 1 ) ) * width;
		const y = height - paddingY - ( ( ( val - minVal ) / range ) * innerH );
		return { x, y };
	});
};

// fallow-ignore-next-line complexity
const buildBezierPath = ( pts: Point[]): string => {
	let d = `M ${ pts[ 0 ].x } ${ pts[ 0 ].y }`;
	for ( let i = 0; i < pts.length - 1; i++ ) {
		const p0 = pts[ 0 < i ? i - 1 : 0 ];
		const p1 = pts[ i ];
		const p2 = pts[ i + 1 ];
		const p3 = pts[ i + 2 < pts.length ? i + 2 : i + 1 ];

		const cp1x = p1.x + ( ( p2.x - p0.x ) / 6 );
		const cp1y = p1.y + ( ( p2.y - p0.y ) / 6 );
		const cp2x = p2.x - ( ( p3.x - p1.x ) / 6 );
		const cp2y = p2.y - ( ( p3.y - p1.y ) / 6 );

		d += ` C ${ cp1x } ${ cp1y }, ${ cp2x } ${ cp2y }, ${ p2.x } ${ p2.y }`;
	}
	return d;
};

// fallow-ignore-next-line complexity
const findRevisionPoint = (
	revision: RevisionMarker,
	timestamps: number[],
	pts: Point[]
): Point | null => {
	const revTime = revision.timestamp || ( revision.date ? new Date( revision.date ).getTime() / 1000 : 0 );
	if ( 0 >= revTime || 0 === timestamps.length ) {
		return null;
	}

	let closestIdx = 0;
	let minDiff = Infinity;
	timestamps.forEach( ( ts, idx ) => {
		const diff = Math.abs( ts - revTime );
		if ( diff < minDiff ) {
			minDiff = diff;
			closestIdx = idx;
		}
	});

	return closestIdx < pts.length ? pts[ closestIdx ] : null;
};

/**
 * Renders an SVG sparkline of daily pageviews with an optional revision marker in Pro.
 *
 * @param props                - Component properties.
 * @param props.insightsData   - Daily pageviews dataset from useInsightsData.
 * @param props.latestRevision - Most recent revision marker if available.
 * @param props.isPro          - Whether Burst Pro is active.
 * @param props.startDate      - Start date ISO string.
 * @return Sparkline graph container.
 */
// fallow-ignore-next-line complexity
export const PageviewsTrend: React.FC<PageviewsTrendProps> = ({
	insightsData,
	latestRevision,
	isPro,
	startDate
}) => {
	const values = useMemo( () => {
		const dataset = insightsData?.datasets?.[ 0 ];
		return Array.isArray( dataset?.data ) ? dataset.data : [];
	}, [ insightsData ]);

	const timestamps = useMemo( () => {
		return Array.isArray( insightsData?.timestamps ) ? insightsData.timestamps : [];
	}, [ insightsData ]);

	const width = 300;
	const height = 60;
	const paddingY = 8;

	const { pathData, revisionPoint } = useMemo( () => {
		if ( 0 === values.length ) {
			return { pathData: '', revisionPoint: null };
		}
		const pts = calculatePoints( values, width, height, paddingY );
		const d = buildBezierPath( pts );
		const revPt = isPro && latestRevision ? findRevisionPoint( latestRevision, timestamps, pts ) : null;
		return { pathData: d, revisionPoint: revPt };
	}, [ values, timestamps, isPro, latestRevision ]);

	const startLabel = useMemo( () => ( startDate ? formatDateShort( startDate ) : '' ), [ startDate ]);
	const revisionDateLabel = useMemo( () => {
		if ( ! latestRevision ) {
			return '';
		}
		const input = latestRevision.timestamp || latestRevision.date;
		return input ? formatDateShort( input ) : '';
	}, [ latestRevision ]);

	return (
		<div className="mb-4 flex flex-col">
			<div className="h-[60px] w-full overflow-hidden">
				{ pathData ? (
					<svg
						viewBox={ `0 0 ${ width } ${ height }` }
						className="h-full w-full overflow-visible"
						preserveAspectRatio="none"
					>
						<path
							d={ pathData }
							fill="none"
							stroke="#16a34a"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						{ revisionPoint && (
							<circle
								cx={ revisionPoint.x }
								cy={ revisionPoint.y }
								r="4.5"
								fill="#16a34a"
								stroke="#ffffff"
								strokeWidth="2"
							/>
						) }
					</svg>
				) : (
					<div className="flex h-full w-full items-center justify-center text-xs text-text-gray">
						{ __( 'No trend data available', 'burst-statistics' ) }
					</div>
				) }
			</div>

			<div className="mt-1 flex items-center justify-between text-[11px] text-text-gray px-0.5">
				<span>{ startLabel }</span>
				<span>{ __( 'Today', 'burst-statistics' ) }</span>
			</div>
			{ isPro && latestRevision && revisionDateLabel && (
				<div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-text-gray">
					<span className="inline-block h-1.5 w-1.5 rounded-full bg-green-600" />
					<span>
						{ sprintf(

							/* translators: %s: revision date */
							__( 'Updated %s', 'burst-statistics' ),
							revisionDateLabel
						) }
					</span>
				</div>
			) }
		</div>
	);
};
