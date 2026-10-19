import { useMemo } from 'react';
import { useDatatableData } from '@/hooks/useDatatableData';

/**
 * A single custom event data row.
 */
export type EventRow = {

	/** The event name. */
	name: string;

	/** Number of times this event occurred in the current period. */
	count: number;
};

/**
 * Raw row shape returned directly from the burst/v1/data/datatable/events endpoint.
 */
type ApiRow = {
	name: string;
	count: number;
};

type UseEventsDataOptions = {

	/** When false, the query is not executed. */
	enabled?: boolean;
};

type UseEventsDataReturn = {

	/** All available rows, ordered by count descending. */
	data: EventRow[];

	/** True while the API request is in-flight. */
	isLoading: boolean;

	/** Non-null when the request failed. */
	error: Error | null;
};

/**
 * Returns custom event count data for the current date range.
 *
 * Fetches from the `burst/v1/data/datatable/events` REST endpoint which
 * returns event name/count pairs for the active date range.
 *
 * @param {UseEventsDataOptions} options - Query options.
 * @return {UseEventsDataReturn} The events dataset and request state.
 */
export function useEventsData(
	options: UseEventsDataOptions = {}
): UseEventsDataReturn {
	const { enabled = true } = options;

	const { data: apiData, isLoading, error } = useDatatableData<ApiRow>({
		id: 'events',
		enabled
	});

	const data = useMemo( () => {
		return [ ...( apiData ?? []) ].sort( ( a, b ) => b.count - a.count );
	}, [ apiData ]);

	return {
		data,
		isLoading,
		error
	};
}
