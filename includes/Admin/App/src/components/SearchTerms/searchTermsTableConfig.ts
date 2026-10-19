import { __ } from '@wordpress/i18n';

/**
 * Column option as used by DataTableBlock's columnsOptions.
 */
type SearchTermsColumnOption = {
	label: string;
	format: string;
	align: 'left' | 'right';
	default?: boolean;
	group_by?: boolean;

	/** Add the column to selections saved before it existed. */
	addWhenAvailable?: boolean;
};

export type SearchTermsTableConfig = {
	label: string;
	searchable: boolean;
	defaultColumns: string[];
	columnsOptions: Record<string, SearchTermsColumnOption>;
};

/**
 * DataTableBlock config for the "Website searches" table.
 *
 * The AI match column only exists while the SmartMatch Search plugin is active,
 * so it can neither be selected nor requested without it.
 *
 * @param {boolean} isSmartMatchActive Whether SmartMatch is active (burst_settings.smartmatch_active).
 * @return {SearchTermsTableConfig} The table config.
 */
export const getSearchTermsTableConfig = ( isSmartMatchActive: boolean ): SearchTermsTableConfig => {
	const columnsOptions: Record<string, SearchTermsColumnOption> = {
		term: {
			label: __( 'Search term', 'burst-statistics' ),
			default: true,
			format: 'string',
			align: 'left',
			group_by: true
		},
		volume: {
			label: __( 'Volume', 'burst-statistics' ),
			format: 'search_volume',
			align: 'right'
		},
		results: {
			label: __( 'Results', 'burst-statistics' ),
			format: 'search_results',
			align: 'right'
		}
	};
	const defaultColumns = [ 'term', 'volume', 'results' ];

	if ( isSmartMatchActive ) {
		columnsOptions.ai_match = {
			label: __( 'AI match', 'burst-statistics' ),
			format: 'ai_match',
			align: 'left',
			addWhenAvailable: true
		};
		defaultColumns.push( 'ai_match' );
	}

	return {
		label: __( 'Website searches', 'burst-statistics' ),
		searchable: true,
		defaultColumns,
		columnsOptions
	};
};
