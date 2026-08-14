import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFilters } from '@/hooks/useFilters';
import { useInsightsStore } from '../store/useInsightsStore';
import useFiltersData from '@/hooks/useFiltersData';
import { __, sprintf } from '@wordpress/i18n';
import { formatDuration } from '@/utils/formatting';
import { getFilterOperator, isExcluding, splitFilterValues } from '@/config/filterConfig';

const getCodeLabels = ( value, map ) => {
	if ( ! value ) {
		return '';
	}
	const codes = String( value ).split( ',' ).map( ( c ) => c.trim().toUpperCase() ).filter( Boolean );
	const labels = codes.map( ( code ) => map?.[code] || code );
	return labels.join( ', ' );
};

/**
 * Custom hook for managing filter display logic.
 * Centralizes filter operations and cross-store interactions.
 *
 * @return {Object} Filter display utilities and operations.
 */
export const useFilterDisplay = ( reportBlockIndex ) => {
	const {
		filters,
		filtersConf,
		setFilters,
		isPinned,
		savePinnedFilters,
		clearPinnedFilters,
		pinnedFilters
	} = useFilters( reportBlockIndex );
	const { getFilterOptionById } = useFiltersData();
	const { setMetrics, getMetrics } = useInsightsStore();

	// Get active filters with display information
	const [ activeFilters, setActiveFilters ] = useState([]);

	useEffect( () => {
		const loadFilters = async() => {
			const filtersWithDisplay = await getActiveFiltersWithDisplay();
			setActiveFilters( filtersWithDisplay );
		};
		loadFilters();
	}, [ filters ]); // eslint-disable-line react-hooks/exhaustive-deps

	const getActiveFiltersWithDisplay = useCallback( async() => {
		const active = Object.entries( filters ).filter(
			([ _, value ]) => '' !== value // eslint-disable-line @typescript-eslint/no-unused-vars
		);
		return await Promise.all(

			// fallow-ignore-next-line complexity
			active.map( async([ key, value ]) => {
				const config = filtersConf?.[key] || null;
				const exclusionAllowed = !! config?.exclusion_allowed;
				const isExcluded = exclusionAllowed && isExcluding( value );
				const cleanValue = isExcluded ? value.substring( 1 ) : value;
				const rawValues = splitFilterValues( cleanValue );
				const isMultiValue = 1 < rawValues.length;

				// Keep the joined display string for single-value chips and any other consumer.
				const displayValue = await getFilterDisplayValue( key, value );

				// Resolve each raw value's display label individually so the
				// multi-value chip's hover tooltip can list them one per row.
				const values = isMultiValue ?
					await Promise.all(
						rawValues.map( async( raw ) => ({
							raw,
							display: await getFilterDisplayValue( key, raw )
						}) )
					) :
					[ { raw: cleanValue, display: displayValue } ];

				return {
					key,
					value,
					displayValue,
					values,
					isExcluded,
					operator: getFilterOperator({ isExcluded, isMultiValue }),
					config
				};
			})
		);
	}, [ filters, filtersConf ]); // eslint-disable-line react-hooks/exhaustive-deps

	// fallow-ignore-next-line complexity
	const getFilterDisplayValue = async(
		filterKey,
		value
	) => {
		if ( ! value ) {
			return '';
		}

		if ( filtersConf[filterKey].exclusion_allowed && isExcluding( value ) ) {
			value = value.substring( 1 );
		}

		if ( Object.prototype.hasOwnProperty.call( filtersConf, filterKey ) ) {
			const filterType = filtersConf[filterKey]?.options || false;
			if ( filterType ) {

				//if value contains a , explode it into an array
				//check if value is a string and contains a comma
				if ( 'string' === typeof value && -1 !== value.indexOf( ',' ) ) {
					value = value.split( ',' ).map( ( v ) => v.trim() );

					// Map each value to its display option
					value = await Promise.all(
						value.map(
							async( v ) =>
								( await getFilterOptionById( v, filterType ) ) || v
						)
					);

					// Join back to a string
					value = value.join( ', ' );
				} else {
					value =
						( await getFilterOptionById( value, filterType ) ) || value;
				}
			}
		}

	switch ( filterKey ) {
		case 'country_code':
			return getCodeLabels( value, window.burst_settings?.countries );
		case 'continent_code':
			return getCodeLabels( value, window.burst_settings?.continents );
		case 'bounces':
			return 'include' === value ?
				__( 'Bounced', 'burst-statistics' ) :
				__( 'Active', 'burst-statistics' );

		case 'new_visitor':
			return 'include' === value ?
				__( 'New', 'burst-statistics' ) :
				__( 'Returning', 'burst-statistics' );

		case 'entry_exit_pages':
			if ( 'entry' === value ) {
				return __( 'Entry', 'burst-statistics' );
			}
			if ( 'exit' === value ) {
				return __( 'Exit', 'burst-statistics' );
			}
			return value;

		case 'status':
			if ( '200' === value ) {
				return __( 'OK', 'burst-statistics' );
			}
			if ( '404' === value ) {
				return __( 'Not Found', 'burst-statistics' );
			}
			if ( 'all' === value ) {
				return __( 'All statuses', 'burst-statistics' );
			}
			return value;

		case 'time_per_session': {
			const dashIdx = String( value ).indexOf( '-' );
			if ( -1 === dashIdx ) {
				return value;
			}
			const minRaw = String( value ).slice( 0, dashIdx );
			const maxRaw = String( value ).slice( dashIdx + 1 );
			const minSec = parseInt( minRaw, 10 );
			const formattedMin = formatDuration( isNaN( minSec ) ? 0 : minSec );
			if ( '' === maxRaw ) {

				/* translators: %s is a human-readable duration like 2m, 1h */
				return sprintf( __( '%s+', 'burst-statistics' ), formattedMin );
			}
			const maxSec = parseInt( maxRaw, 10 );
			const formattedMax = formatDuration( isNaN( maxSec ) ? 0 : maxSec );
			return `${formattedMin} – ${formattedMax}`;
		}

		default:
			return value;
	}
	};

	/**
	 * Remove a filter and handle any side effects
	 * @param {string} filterKey - The filter key to remove
	 */
	const removeFilter = useCallback(
		( filterKey ) => {

			// Clear the filter
			setFilters( filterKey, '' );

			// Handle side effects based on filter type
			if ( 'goal_id' === filterKey ) {

				// Remove conversions metric when goal filter is removed
				const currentMetrics = getMetrics();
				const updatedMetrics = currentMetrics.filter(
					( metric ) => 'conversions' !== metric
				);
				setMetrics( updatedMetrics );
			}
		},
		[ setFilters, setMetrics, getMetrics ]
	);

	/**
	 * Check if any filters are currently active
	 * @return {boolean} True if any filters have values
	 */
	const hasActiveFilters = useMemo( () => {
		return Array.isArray( activeFilters ) && 0 < activeFilters.length;
	}, [ activeFilters ]);

	/**
	 * Get filter configuration by key
	 * @param {string} filterKey - The filter key
	 * @return {Object|null} Filter configuration or null if not found
	 */
	const getFilterConfig = useCallback(
		( filterKey ) => {
			return filtersConf[filterKey] || null;
		},
		[ filtersConf ]
	);

	return {
		activeFilters,
		hasActiveFilters,
		removeFilter,
		getFilterConfig,

		// Expose underlying store methods for advanced usage
		setFilter: setFilters,
		filters,
		filtersConf,

		// Pinned filters
		isPinned,
		savePinnedFilters,
		clearPinnedFilters,
		pinnedFilters
	};
};

export default useFilterDisplay;
