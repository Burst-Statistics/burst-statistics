import { useQuery } from '@tanstack/react-query';
import useDateRange from '@/hooks/useDateRange';
import useFilters from '@/hooks/useFilters';
import getPageWeightData from '@/api/getPageWeightData';

/**
 * A single row in the heaviest-pages list.
 */
export type PageWeightRow = {

	/** The page URL path. */
	page_url: string;

	/** Measured uncached weight of the page in bytes. */
	page_weight: number;

	/** Pageviews recorded for this page in the period. */
	pageviews: number;
};

/**
 * The cached Green Web Foundation result and how it is being used.
 */
export type GreenHostingState = {

	/** Whether a check has ever been run for this site. */
	checked: boolean;

	/** The cached check result. */
	status: {
		green: boolean;
		hosted_by: string;
		checked_at: number;
		failed_attempts: number;
	};
};

/**
 * The full Page weight block payload.
 */
export type PageWeightData = {

	/** Average measured weight carried by one pageview, in bytes. */
	avg_bytes: number;

	/**
	 * The average now and over the preceding period, both over only the pages
	 * measured by that period's end, so new coverage does not read as a change
	 * in weight. Null when either side has nothing measured, so the block shows
	 * no trend rather than comparing against nothing.
	 */
	weight_trend: {
		current_avg_bytes: number;
		previous_avg_bytes: number;
	} | null;

	/** Pageviews in the period. */
	pageviews: number;

	/**
	 * Whether the range reaches now, so new samples can still change it. A
	 * closed range is weighed as of its end and stays as it is.
	 */
	is_ongoing: boolean;

	/** Share of pageviews on pages with enough samples to report, 0 to 1. */
	measured_ratio: number;

	/**
	 * How far sampling has come: each pageview counts its page's samples out
	 * of the samples needed, 0 to 1. Moves with every sample, where
	 * measured_ratio only moves once a page has all of them.
	 */
	sampling_progress: number;

	/** Estimated emissions for the period, in grams CO2e. */
	total_co2_grams: number;

	/** Estimated emissions for a single pageview, in grams CO2e. */
	co2_per_pageview_grams: number;

	/** Digital Carbon Rating for the per-pageview figure. */
	carbon_rating: string;

	/** The same three figures recalculated on green hosting, for the preview. */
	green_preview: {
		total_co2_grams: number;
		co2_per_pageview_grams: number;
		carbon_rating: string;
	};

	/** The heaviest measured pages of the period. */
	rows: PageWeightRow[];

	/** Green hosting state behind the footer. */
	green_hosting: GreenHostingState;
};

/**
 * Coverage below which the block reports that it is still measuring instead of
 * showing figures. Page weight is sampled, so an average built on a handful of
 * pageviews would move wildly between refreshes.
 */
const MIN_MEASURED_RATIO = 0.25;

/**
 * Whether the block is still measuring rather than reporting.
 *
 * Null counts as measuring: before the first response there is nothing to
 * report on, and nothing for the options menu to act on either.
 *
 * @param data - The block payload, or null before the first response.
 * @return Whether the block is in its measuring state.
 */
export const isMeasuring = ( data: PageWeightData | null ): boolean =>
	null === data || MIN_MEASURED_RATIO > data.measured_ratio;

type UsePageWeightDataReturn = {

	/** The block payload, or null before the first response. */
	data: PageWeightData | null;

	/** Whether the request is in flight. */
	isLoading: boolean;

	/** Request error, if any. */
	error: Error | null;
};

/**
 * Returns the Page weight block payload for the current date range.
 *
 * @return {UsePageWeightDataReturn} The payload and request state.
 */
export function usePageWeightData(): UsePageWeightDataReturn {
	const { startDate, endDate, range } = useDateRange();
	const { getActiveFilters } = useFilters();
	const filters = getActiveFilters();

	const query = useQuery({
		queryKey: [ 'page_weight', startDate, endDate, filters ],
		queryFn: () => getPageWeightData({ startDate, endDate, range, filters }),
		enabled: !! startDate && !! endDate
	});

	return {
		data: query.data ?? null,
		isLoading: query.isLoading || query.isFetching,
		error: ( query.error as Error | null ) ?? null
	};
}
