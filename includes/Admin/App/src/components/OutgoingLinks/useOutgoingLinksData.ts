import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDate } from '@/store/useDateStore';
import { useCompareStore, COMPARE_MODES } from '@/store/useCompareStore';
import { getDatatableData } from '@/utils/api';
import useLicenseData from '@/hooks/useLicenseData';
import useFilters from '@/hooks/useFilters';

/**
 * A single outgoing link data row.
 */
export type OutgoingLinkRow = {

	/** The clicked outgoing URL. */
	url: string;

	/** Number of clicks on this URL in the current period. */
	clicks: number;

	/** Number of clicks in the previous period (previous period comparison). */
	previousClicks: number;

	/** Number of clicks in the same period one year ago (year-over-year comparison). */
	previousClicksYoy: number;
};

/**
 * Raw row shape returned directly from the burst/v1/data/datatable/outgoing-links endpoint.
 */
type ApiRow = {
	url: string;
	clicks: number;
	previous_clicks: number;
	previous_clicks_yoy: number;
};

type UseOutgoingLinksDataReturn = {

	/** All available rows, ordered by clicks descending. */
	data: OutgoingLinkRow[];

	/** True while the API request is in-flight. */
	isLoading: boolean;

	/** Non-null when the request failed. */
	error: Error | null;

	/**
	 * Estimated percentage of the first scraping cycle that has completed (0–100).
	 * 100 means the first cycle is fully done. Only relevant when firstCycleCompleted is false.
	 */
	scrapingProgress: number;
};

/**
 * Returns outgoing link click data for the current date range.
 *
 * Fetches from the `burst/v1/data/datatable/outgoing-links` REST endpoint which
 * returns current-period clicks alongside previous-period and year-over-year counts
 * in a single request. The `previousClicks` field is resolved client-side based
 * on the active comparison mode so the columns layer doesn't need to re-fetch.
 *
 * @return {UseOutgoingLinksDataReturn} The outgoing links dataset and request state.
 */
export function useOutgoingLinksData( enabled = true ): UseOutgoingLinksDataReturn {
	const { startDate, endDate, range } = useDate( ( state ) => state );
	const compareMode = useCompareStore( ( state ) => state.compareMode );
	const { isLicenseValid } = useLicenseData();
	const { getActiveFilters } = useFilters();
	const filters = getActiveFilters();

	const { data: apiData, isLoading, error } = useQuery({
		queryKey: [ 'outgoing-links', startDate, endDate, range, filters ],
		enabled: enabled && isLicenseValid,
		queryFn: async() => {
			const response = await getDatatableData(
				'outgoing-links',
				false,
				startDate,
				endDate,
				range,
				{ filters }
			);

			// getDatatableData returns the full REST response; the datatable data is in response.data.
			const rows: ApiRow[] = response?.data?.data ?? [];
			const scrapingProgress: number = response?.data?.scraping_progress ?? 0;
			return { rows, scrapingProgress };
		},
		placeholderData: { rows: [], scrapingProgress: 0 },
		refetchInterval: ( query ) => {
			const stateData = query.state.data as { scrapingProgress?: number } | undefined;
			const progress = stateData?.scrapingProgress ?? 0;
			const isCompleted = !! window.burst_settings?.external_links_first_cycle_completed;
			return ( ! isCompleted && 100 > progress ) ? 4000 : false;
		}
	});

	const data = useMemo( () => {
		const rows = ( apiData?.rows ?? []).map( ( row: ApiRow ) => ({
			url: row.url,
			clicks: row.clicks,
			previousClicks:
				COMPARE_MODES.YEAR_OVER_YEAR === compareMode ?
					row.previous_clicks_yoy :
					row.previous_clicks,
			previousClicksYoy: row.previous_clicks_yoy
		}) );

		return rows.sort( ( a, b ) => b.clicks - a.clicks );
	}, [ apiData?.rows, compareMode ]);

	return {
		data,
		isLoading,
		error: ( error as Error | null ),
		scrapingProgress: apiData?.scrapingProgress ?? 0
	};
}
