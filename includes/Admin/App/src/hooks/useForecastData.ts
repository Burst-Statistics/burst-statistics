import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDate } from '@/store/useDateStore';
import { useFilters } from '@/hooks/useFilters';
import { getForecastData } from '@/api/getForecastData';
import { getForecastRange } from '@/utils/formatting';
import type {
	ForecastData,
	ForecastMode,
	ForecastSource
} from '@/types/api-endpoints';

interface UseForecastDataArgs {
	source: ForecastSource;
	chartMode: ForecastMode;
	enabled: boolean;
}

/**
 * Retrieve a source-specific forecast for an existing historical chart.
 *
 * Sales receives the active visitor filters. `getForecastData()` deliberately
 * omits those filters for Subscriptions.
 *
 * @param args - Forecast source, chart mode and toggle state.
 * @return TanStack Query result with a normalized placeholder payload.
 */
export function useForecastData({
	source,
	chartMode,
	enabled
}: UseForecastDataArgs ) {
	const { startDate, range } = useDate( ( state ) => state );
	const { filters } = useFilters();

	// The forecast view is anchored to now: the selection ends at the last
	// complete period (month, or year for selections beyond two years) — also
	// when the picked range ends earlier — so the forecast always starts at
	// the current period and never projects periods that are already
	// measured. Matches the chart blocks' end-date anchor; the bucket size is
	// passed along explicitly so the backend uses the same interval.
	const { endDate, groupBy } = getForecastRange( startDate );
	const placeholderData = useMemo<ForecastData>(
		() => ({
			interval: 'day',
			spans_multiple_years: false,
			rows: [],
			mode: chartMode,
			currency: null,
			metadata: {
				growth_rate: 0,
				limited_data: true
			}
		}),
		[ chartMode ]
	);

	return useQuery<ForecastData>({
		queryKey: [
			'forecast',
			source,
			startDate,
			endDate,
			range,
			chartMode,
			groupBy,
			'sales' === source ? filters : null
		],
		queryFn: () => getForecastData({
			source,
			startDate,
			endDate,
			range,
			filters: filters as Record<string, unknown>,
			chartMode,
			groupBy
		}),
		placeholderData,
		enabled,

		// A forecast for a fixed completed period cannot change between
		// refocuses, so avoid refiring the heaviest endpoint on window focus
		// and keep results around long enough for a toggle round-trip.
		staleTime: 5 * 60 * 1000,
		gcTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false
	});
}
