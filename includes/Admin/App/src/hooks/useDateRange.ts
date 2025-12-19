import { useLocation, useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { useDate } from '@/store/useDateStore';
import { availableRanges } from '@/utils/formatting';
import { TRAILING_PARAM_KEY } from '@/config/filterConfig';

// Date format for URL parameters.
const DATE_FORMAT = 'yyyy-MM-dd';

// Available range keys for validation.
const RANGE_KEYS = [
	'today',
	'yesterday',
	'last-7-days',
	'last-30-days',
	'last-90-days',
	'last-month',
	'week-to-date',
	'month-to-date',
	'year-to-date',
	'last-year',
	'custom'
] as const;

export type RangeKey = ( typeof RANGE_KEYS )[number];

// Date range search params type.
export interface DateRangeSearchParams {
	startDate?: string;
	endDate?: string;
	range?: RangeKey;
}

// Routes where URL date range sync is enabled.
const DATE_RANGE_ENABLED_ROUTES = [ '/statistics', '/sources', '/sales' ];

/**
 * Check if current route supports URL date range sync.
 *
 * @param pathname - The current route pathname.
 * @return True if date range should sync with URL on this route.
 */
const isDateRangeEnabledRoute = ( pathname: string ): boolean => {
	return DATE_RANGE_ENABLED_ROUTES.some( ( route ) =>
		pathname.startsWith( route )
	);
};

/**
 * Validate a date string in YYYY-MM-DD format.
 *
 * @param dateStr - The date string to validate.
 * @return True if valid date format.
 */
const isValidDateString = ( dateStr: string | undefined ): boolean => {
	if ( ! dateStr ) {
		return false;
	}
	const parsed = parseISO( dateStr );
	return isValid( parsed ) && /^\d{4}-\d{2}-\d{2}$/.test( dateStr );
};

/**
 * Validate a range key.
 *
 * @param rangeKey - The range key to validate.
 * @return True if valid range key.
 */
const isValidRangeKey = ( rangeKey: string | undefined ): rangeKey is RangeKey => {
	if ( ! rangeKey ) {
		return false;
	}
	return RANGE_KEYS.includes( rangeKey as RangeKey );
};

/**
 * Check if URL has valid date range params.
 *
 * @param searchParams - The current search params from URL.
 * @return True if URL contains valid date range params.
 */
const hasUrlDateRange = ( searchParams: DateRangeSearchParams ): boolean => {
	const { range, startDate, endDate } = searchParams;

	// Check for valid range key.
	if ( isValidRangeKey( range ) ) {

		// For custom range, also need valid dates.
		if ( 'custom' === range ) {
			return isValidDateString( startDate ) && isValidDateString( endDate );
		}
		return true;
	}

	// Also accept just startDate and endDate (implies custom).
	if ( isValidDateString( startDate ) && isValidDateString( endDate ) ) {
		return true;
	}

	return false;
};

// Type for availableRanges keys (excluding 'custom' which is handled separately).
type AvailableRangeKey = keyof typeof availableRanges;

/**
 * Check if a range key exists in availableRanges.
 *
 * @param rangeKey - The range key to check.
 * @return True if the key exists in availableRanges.
 */
const isAvailableRangeKey = ( rangeKey: string ): rangeKey is AvailableRangeKey => {
	return rangeKey in availableRanges;
};

/**
 * Get dates from a predefined range key.
 *
 * @param rangeKey - The range key.
 * @return Object with startDate and endDate strings, or null if invalid.
 */
const getDatesFromRange = (
	rangeKey: string
): { startDate: string; endDate: string } | null => {
	if ( 'custom' === rangeKey || ! isAvailableRangeKey( rangeKey ) ) {
		return null;
	}

	const { startDate, endDate } = availableRanges[rangeKey].range();
	return {
		startDate: format( startDate, DATE_FORMAT ),
		endDate: format( endDate, DATE_FORMAT )
	};
};

/**
 * Build search params object with date range params and trailing param last.
 * Preserves existing search params while updating date range.
 *
 * @param currentParams - Current search params.
 * @param dateParams    - Date range params to set.
 * @return Updated search params with trailing param last.
 */
const buildDateSearchParams = (
	currentParams: Record<string, string | undefined>,
	dateParams: DateRangeSearchParams
): Record<string, string> => {
	const result: Record<string, string> = {};

	// Copy existing params except date range and trailing param.
	Object.keys( currentParams ).forEach( ( key ) => {
		if (
			key !== TRAILING_PARAM_KEY &&
			'startDate' !== key &&
			'endDate' !== key &&
			'range' !== key &&
			currentParams[key] !== undefined
		) {
			result[key] = currentParams[key] as string;
		}
	});

	// Add date range params.
	if ( dateParams.range ) {
		result.range = dateParams.range;
	}
	if ( dateParams.startDate ) {
		result.startDate = dateParams.startDate;
	}
	if ( dateParams.endDate ) {
		result.endDate = dateParams.endDate;
	}

	// Always add trailing param last.
	result[TRAILING_PARAM_KEY] = '';

	return result;
};

/**
 * Hook to manage date range with URL sync using TanStack Router.
 * Uses Zustand persist for local storage, router for runtime state.
 * URL sync only works on specific routes: /statistics, /sources, /sales.
 *
 * @return Date range state and actions.
 */
export const useDateRange = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const hasInitialized = useRef( false );

	// Check if current route supports URL date range sync.
	const isDateRangeRoute = isDateRangeEnabledRoute( location.pathname );

	// Get persistence from Zustand store.
	const zustandStartDate = useDate( ( state ) => state.startDate );
	const zustandEndDate = useDate( ( state ) => state.endDate );
	const zustandRange = useDate( ( state ) => state.range );
	const setZustandStartDate = useDate( ( state ) => state.setStartDate );
	const setZustandEndDate = useDate( ( state ) => state.setEndDate );
	const setZustandRange = useDate( ( state ) => state.setRange );

	// Get current date range values from router search params.
	const searchParams = useSearch({ strict: false }) as DateRangeSearchParams &
		Record<string, string | undefined>;

	// Compute active date range (from URL or fallback to Zustand).
	const dateRange = useMemo( () => {
		if ( isDateRangeRoute && hasUrlDateRange( searchParams ) ) {
			const { range, startDate, endDate } = searchParams;

			// Handle predefined ranges.
			if ( isValidRangeKey( range ) && 'custom' !== range ) {
				const dates = getDatesFromRange( range );
				if ( dates ) {
					return {
						range,
						startDate: dates.startDate,
						endDate: dates.endDate
					};
				}
			}

			// Handle custom range or just dates.
			if ( isValidDateString( startDate ) && isValidDateString( endDate ) ) {
				return {
					range: ( range || 'custom' ) as RangeKey,
					startDate: startDate as string,
					endDate: endDate as string
				};
			}
		}

		// Fallback to Zustand values.
		return {
			range: zustandRange as RangeKey,
			startDate: zustandStartDate,
			endDate: zustandEndDate
		};
	}, [
		searchParams,
		isDateRangeRoute,
		zustandStartDate,
		zustandEndDate,
		zustandRange
	]);

	// Initialize: restore from Zustand if URL has no date range (only on enabled routes).
	useEffect( () => {
		if ( ! isDateRangeRoute || hasInitialized.current ) {
			return;
		}
		hasInitialized.current = true;

		// If URL already has date range, save to Zustand and use those.
		if ( hasUrlDateRange( searchParams ) ) {
			const { range, startDate, endDate } = searchParams;

			if ( isValidRangeKey( range ) && 'custom' !== range ) {

				// Predefined range - set the range key (Zustand will calculate dates).
				setZustandRange( range );
			} else if (
				isValidDateString( startDate ) &&
				isValidDateString( endDate )
			) {

				// Custom range - set dates directly.
				setZustandStartDate( startDate as string );
				setZustandEndDate( endDate as string );
				setZustandRange( 'custom' );
			}
			return;
		}

		// Load from Zustand store and apply to URL.
		if ( zustandRange ) {
			const dateParams: DateRangeSearchParams = {
				range: zustandRange as RangeKey
			};

			// For custom range, include the dates.
			if ( 'custom' === zustandRange ) {
				dateParams.startDate = zustandStartDate;
				dateParams.endDate = zustandEndDate;
			}

			const newSearch = buildDateSearchParams( searchParams, dateParams );
			navigate({
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				search: newSearch as any,
				replace: true // Replace to not create extra history entry on init.
			});
		}
	}, [ isDateRangeRoute ]); // eslint-disable-line react-hooks/exhaustive-deps

	// Sync date range to Zustand whenever it changes from URL.
	useEffect( () => {
		if ( ! isDateRangeRoute || ! hasInitialized.current ) {
			return;
		}

		// Only sync if URL has valid date range.
		if ( hasUrlDateRange( searchParams ) ) {
			const { range, startDate, endDate } = searchParams;

			if ( isValidRangeKey( range ) && 'custom' !== range ) {

				// Predefined range.
				if ( zustandRange !== range ) {
					setZustandRange( range );
				}
			} else if (
				isValidDateString( startDate ) &&
				isValidDateString( endDate )
			) {

				// Custom range.
				if ( zustandStartDate !== startDate ) {
					setZustandStartDate( startDate as string );
				}
				if ( zustandEndDate !== endDate ) {
					setZustandEndDate( endDate as string );
				}
				if ( 'custom' !== zustandRange ) {
					setZustandRange( 'custom' );
				}
			}
		}
	}, [
		searchParams,
		isDateRangeRoute,
		zustandStartDate,
		zustandEndDate,
		zustandRange,
		setZustandStartDate,
		setZustandEndDate,
		setZustandRange
	]);

	/**
	 * Set the date range and update URL.
	 *
	 * @param range     - The range key.
	 * @param startDate - Start date (only for custom range).
	 * @param endDate   - End date (only for custom range).
	 */
	const setDateRange = useCallback(
		( range: RangeKey, startDate?: string, endDate?: string ) => {

			// Update Zustand store.
			if ( 'custom' === range && startDate && endDate ) {
				setZustandStartDate( startDate );
				setZustandEndDate( endDate );
				setZustandRange( 'custom' );
			} else {
				setZustandRange( range );
			}

			// Only update URL on enabled routes.
			if ( ! isDateRangeRoute ) {
				return;
			}

			const dateParams: DateRangeSearchParams = { range };

			// For custom range, include the dates in URL.
			if ( 'custom' === range && startDate && endDate ) {
				dateParams.startDate = startDate;
				dateParams.endDate = endDate;
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const searchUpdater = ( prev: any ) => {
				return buildDateSearchParams( prev, dateParams );
			};

			navigate({
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				search: searchUpdater as any,
				replace: false // Create history entry for back button.
			});
		},
		[ navigate, isDateRangeRoute, setZustandStartDate, setZustandEndDate, setZustandRange ]
	);

	/**
	 * Set a predefined range.
	 *
	 * @param range - The predefined range key.
	 */
	const setRange = useCallback(
		( range: RangeKey ) => {
			if ( 'custom' === range ) {

				// For custom, just update the range type without changing dates.
				setZustandRange( 'custom' );

				if ( isDateRangeRoute ) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const searchUpdater = ( prev: any ) => {
						return buildDateSearchParams( prev, {
							range: 'custom',
							startDate: zustandStartDate,
							endDate: zustandEndDate
						});
					};
					navigate({
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						search: searchUpdater as any,
						replace: false
					});
				}
			} else {
				setDateRange( range );
			}
		},
		[ setDateRange, setZustandRange, isDateRangeRoute, navigate, zustandStartDate, zustandEndDate ]
	);

	/**
	 * Set custom start date.
	 *
	 * @param startDate - The start date in YYYY-MM-DD format.
	 */
	const setStartDate = useCallback(
		( startDate: string ) => {
			setDateRange( 'custom', startDate, dateRange.endDate );
		},
		[ setDateRange, dateRange.endDate ]
	);

	/**
	 * Set custom end date.
	 *
	 * @param endDate - The end date in YYYY-MM-DD format.
	 */
	const setEndDate = useCallback(
		( endDate: string ) => {
			setDateRange( 'custom', dateRange.startDate, endDate );
		},
		[ setDateRange, dateRange.startDate ]
	);

	return {

		// State.
		startDate: dateRange.startDate,
		endDate: dateRange.endDate,
		range: dateRange.range,
		isDateRangeRoute,

		// Actions.
		setDateRange,
		setRange,
		setStartDate,
		setEndDate
	};
};

export default useDateRange;

