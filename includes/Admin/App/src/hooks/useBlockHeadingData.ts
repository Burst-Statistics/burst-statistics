import { useMemo } from 'react';
import { useWizardStore } from '@/store/reports/useWizardStore';
import { useFilterDisplay } from '@/hooks/useFilterDisplay';
import { getDisplayDates } from '@/utils/formatting';

interface FilterItem {
	key: string;
	value: string;
	displayValue: string;
	config: Record<string, unknown> | null;
}

interface FilterDisplayResult {
	activeFilters: FilterItem[];
	hasActiveFilters: boolean;
	removeFilter: ( filterKey: string ) => void;
	getFilterConfig: ( filterKey: string ) => Record<string, unknown> | null;
	setFilter: ( filterKey: string, value: string ) => void;
	filters: Record<string, string>;
	filtersConf: Record<string, unknown>;
}

interface BlockHeadingData {
	dateRangeText: string;
	filtersText: string;
	hasDateRange: boolean;
	hasFilters: boolean;
}

/**
 * Custom hook to fetch and format block-specific filter and date range data as plain text strings.
 *
 * @param {number} reportBlockIndex - Index of the block in the report's content array.
 * @return {Object} Object containing formatted date range and filter text strings.
 */
export const useBlockHeadingData = ( reportBlockIndex?: number ): BlockHeadingData => {

	// Get date range methods from wizard store
	const getStartDate = useWizardStore( ( state ) => state.getStartDate );
	const getEndDate = useWizardStore( ( state ) => state.getEndDate );
	const blockDateRangeEnabled = useWizardStore( ( state ) => state.blockDateRangeEnabled );

	// Get filters using existing hook
	const filterDisplayResult = useFilterDisplay( reportBlockIndex ) as FilterDisplayResult;
	const activeFilters = filterDisplayResult.activeFilters;

	// Format date range text
	const dateRangeText = useMemo( () => {

		// Check if block has custom date range enabled
		if ( ! reportBlockIndex || ! blockDateRangeEnabled( reportBlockIndex ) ) {
			return '';
		}

		const startDateValue = getStartDate( reportBlockIndex );
		const endDateValue = getEndDate( reportBlockIndex );

		if ( ! startDateValue || ! endDateValue ) {
			return '';
		}

		const { startDate, endDate } = getDisplayDates( startDateValue, endDateValue );

		if ( ! startDate || ! endDate ) {
			return '';
		}

		return `${startDate} - ${endDate}`;
	}, [ reportBlockIndex, getStartDate, getEndDate, blockDateRangeEnabled ]);

	// Format filters text
	const filtersText = useMemo( () => {
		if ( ! activeFilters || 0 === activeFilters.length ) {
			return '';
		}

		return activeFilters
			.map( ( filter: FilterItem ) => filter.displayValue )
			.filter( ( val: string ) => val && '' !== val )
			.join( ', ' );
	}, [ activeFilters ]);

	// Return empty if no index (not in report context)
	if ( reportBlockIndex === undefined ) {
		return {
			dateRangeText: '',
			filtersText: '',
			hasDateRange: false,
			hasFilters: false
		};
	}

	return {
		dateRangeText,
		filtersText,
		hasDateRange: !! dateRangeText,
		hasFilters: !! filtersText
	};
};
