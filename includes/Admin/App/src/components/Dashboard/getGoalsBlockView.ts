export type GoalsBlockView = 'loading' | 'error' | 'empty' | 'stats';

export interface GoalsBlockViewInput {

	// The goals list has not loaded yet.
	isGoalsListPending: boolean;
	isGoalsListError: boolean;
	goalsCount: number;

	// Real statistics are available, not the placeholder.
	hasStats: boolean;
	isStatsError: boolean;
}

export interface GoalsStatsQuery {
	data?: unknown;
	isPlaceholderData: boolean;
	isError: boolean;
	errorUpdatedAt: number;
}

/**
 * Read the statistics query for getGoalsBlockView.
 *
 * @param {GoalsStatsQuery} query The statistics query result.
 * @return {Pick<GoalsBlockViewInput, 'hasStats' | 'isStatsError'>} Whether real statistics are available, and whether the last attempt without them failed.
 */
export const getGoalsStatsState = ( query: GoalsStatsQuery ): Pick<GoalsBlockViewInput, 'hasStats' | 'isStatsError'> => ({

	// placeholderData makes a v5 query report success while it is still pending, so check isPlaceholderData.
	hasStats: ! query.isPlaceholderData && undefined !== query.data,

	// Without stored data each poll resets the query to pending, which clears isError until that poll ends.
	isStatsError: query.isError || 0 < query.errorUpdatedAt
});

/**
 * The state the goals list alone decides, before statistics matter.
 *
 * @param {GoalsBlockViewInput} input Query state of the goals list and statistics.
 * @return {GoalsBlockView | null} The state to render, or null when there are goals to show statistics for.
 */
const getGoalsListView = ({
	isGoalsListPending,
	isGoalsListError,
	goalsCount
}: GoalsBlockViewInput ): GoalsBlockView | null => {
	if ( isGoalsListPending ) {
		return 'loading';
	}

	// Goals still in the cache after a failed refetch are usable, so keep them.
	if ( 0 < goalsCount ) {
		return null;
	}

	return isGoalsListError ? 'error' : 'empty';
};

/**
 * Which state the dashboard goals block shows. Loading, error and empty stay
 * separate, so the block never shows the empty notice or placeholder values as
 * if they were the result.
 *
 * @param {GoalsBlockViewInput} input Query state of the goals list and statistics.
 * @return {GoalsBlockView} The state to render.
 */
export const getGoalsBlockView = ( input: GoalsBlockViewInput ): GoalsBlockView => {
	const goalsListView = getGoalsListView( input );
	if ( goalsListView ) {
		return goalsListView;
	}

	// Same for statistics: a failed refresh keeps the last result on screen.
	if ( input.hasStats ) {
		return 'stats';
	}

	return input.isStatsError ? 'error' : 'loading';
};
