import { __ } from '@wordpress/i18n';
import { getPercentage } from '@/utils/formatting';
import type {
	FlowDestinationRow,
	FlowSourceRow,
	RankedFlowItem,
	VisitorFlowPayload,
	VisitorFlowSankeyData
} from './types';

const DEFAULT_MAX_NAMED_ROWS = 6;

/**
 * Sums session counts in a collection of flow rows.
 *
 * @param rows - Rows to total.
 * @return Total sessions represented by the rows.
 */
const sumSessions = (
	rows: Array<FlowSourceRow | FlowDestinationRow>
): number => rows.reduce( ( total, row ) => total + row.sessions, 0 );

/**
 * Converts a count into the zero-to-one-hundred percentage used by formatting helpers.
 *
 * @param sessions - Item session count.
 * @param total    - Total sessions for the relevant side.
 * @return Percentage between zero and one hundred.
 */
const getDisplayPercentage = ( sessions: number, total: number ): number =>
	Number( getPercentage( sessions, total, false ) ) * 100;

/**
 * Keeps the highest-volume named rows and combines the remaining long tail.
 *
 * @param rows     - Rows from one side of the flow.
 * @param maxNamed - Maximum named rows to retain.
 * @return Ranked named rows followed by an optional Other row.
 */
const bucketRows = (
	rows: Array<FlowSourceRow | FlowDestinationRow>,
	maxNamed: number
): RankedFlowItem[] => {
	const sortedRows = [ ...rows ].sort(
		( left, right ) => right.sessions - left.sessions
	);
	const namedRows = sortedRows.slice( 0, maxNamed );
	const remainingRows = sortedRows.slice( maxNamed );
	const total = sumSessions( sortedRows );
	const rankedRows: RankedFlowItem[] = namedRows.map( ( row ) => ({
		...row,
		percentage: getDisplayPercentage( row.sessions, total )
	}) );
	const otherSessions = sumSessions( remainingRows );

	if ( 0 < otherSessions ) {
		rankedRows.push({
			id: 'other',
			label: __( 'Other', 'burst-statistics' ),
			type: 'other',
			sessions: otherSessions,
			percentage: getDisplayPercentage( otherSessions, total )
		});
	}

	return rankedRows;
};

/**
 * Buckets destinations while always preserving an explicit exit node.
 *
 * @param rows     - Immediate next-step rows.
 * @param maxNamed - Maximum non-exit named rows to retain.
 * @return Ranked destinations with the exit appended.
 */
const bucketDestinations = (
	rows: FlowDestinationRow[],
	maxNamed: number
): RankedFlowItem[] => {
	const nonExitRows = rows.filter( ( row ) => 'exit' !== row.type );
	const exitRows = rows.filter( ( row ) => 'exit' === row.type );
	const total = sumSessions( rows );
	const rankedRows = bucketRows( nonExitRows, maxNamed ).map( ( row ) => ({
		...row,
		percentage: getDisplayPercentage( row.sessions, total )
	}) );
	const exitSessions = sumSessions( exitRows );

	if ( 0 < exitSessions ) {
		rankedRows.push({
			id: 'exit',
			label: __( 'Left site', 'burst-statistics' ),
			type: 'exit',
			sessions: exitSessions,
			percentage: getDisplayPercentage( exitSessions, total )
		});
	}

	return rankedRows;
};

/**
 * Transforms a visitor-flow payload into Nivo Sankey and summary data.
 *
 * @param payload  - Mock visitor-flow payload.
 * @param maxNamed - Maximum named rows retained on each side.
 * @return Sankey nodes, links, ranked lists, insight, and path coverage.
 */
export const buildSankeyData = (
	payload: VisitorFlowPayload,
	maxNamed: number = DEFAULT_MAX_NAMED_ROWS
): VisitorFlowSankeyData => {
	const sourceTotal = sumSessions( payload.sources );
	const destinationTotal = sumSessions( payload.destinations );
	const sources = bucketRows(
		payload.sources,
		Math.max( 1, maxNamed )
	);
	const destinations = bucketDestinations(
		payload.destinations,
		Math.max( 1, maxNamed )
	);
	const sourceNodes = sources.map( ( source ) => ({
		id: `src:${ source.id }`,
		label: source.label,
		displayLabel: source.label,
		nodeType: source.type,
		sessions: source.sessions,
		percentage: source.percentage,
		side: 'source' as const
	}) );
	const destinationNodes = destinations.map( ( destination ) => ({
		id: `dst:${ destination.id }`,
		label: destination.label,
		displayLabel: destination.label,
		nodeType: destination.type,
		sessions: destination.sessions,
		percentage: destination.percentage,
		side: 'destination' as const
	}) );

	return {
		nodes: [
			...sourceNodes,
			{
				id: 'page',
				label: payload.pagePath,
				displayLabel: payload.pagePath,
				nodeType: 'page',
				sessions: payload.sequencedSessions,
				percentage: 100,
				side: 'page'
			},
			...destinationNodes
		],
		links: [
			...sources.map( ( source ) => ({
				source: `src:${ source.id }`,
				target: 'page',
				value: source.sessions,
				percentage: getDisplayPercentage( source.sessions, sourceTotal ),
				side: 'source' as const
			}) ),
			...destinations.map( ( destination ) => ({
				source: 'page',
				target: `dst:${ destination.id }`,
				value: destination.sessions,
				percentage: getDisplayPercentage(
					destination.sessions,
					destinationTotal
				),
				side: 'destination' as const
			}) )
		],
		sources,
		destinations,
		insight: sources[0] ?? null,
		coveragePercentage: getDisplayPercentage(
			payload.sequencedSessions,
			payload.totalSessions
		)
	};
};
