import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import { formatNumber } from '@/utils/formatting';
import SearchVolume from './SearchVolume';
import type { BarColumn } from '@/components/DataTable/BarDataTable';
import type { SearchTermRow } from './useSearchTermsData';
import AiMatchCell from './AiMatchCell';
import AiMatchHeader from './AiMatchHeader';
import { isSmartMatchActive } from './isSmartMatchActive';

/**
 * The SmartMatch "AI match" column. The block is narrow, so it only shows the
 * link icon; the popover carries the page title and the history.
 */
const aiMatchColumn: BarColumn<SearchTermRow> = {
	key: 'ai_match',
	label: __( 'AI match', 'burst-statistics' ),
	header: <AiMatchHeader />,
	align: 'center',
	minWidth: 104,
	cell: ( row ) => <AiMatchCell row={ row } compact />
};

/**
 * Returns the column definitions for the search-terms table.
 *
 * @param {Object} options         - Options object.
 * @param {string} options.siteUrl - The WordPress site URL, used to build the search result links.
 * @return {BarColumn<SearchTermRow>[]} The column definitions, with the AI match column while SmartMatch is active.
 */
export function getSearchTermsColumns({
	siteUrl
}: {
	siteUrl: string;
}): BarColumn<SearchTermRow>[] {
	const columns: BarColumn<SearchTermRow>[] = [
		{
			key: 'term',
			label: __( 'Search term', 'burst-statistics' ),
			align: 'left',
			minWidth: 160,
			cell: ( row ) => (
				<span
					className="block truncate max-w-xs text-text-black"
					title={ row.term }
				>
					{ row.term }
				</span>
			)
		},
		{
			key: 'volume',
			label: __( 'Volume', 'burst-statistics' ),
			align: 'right',
			minWidth: 80,
			cell: ( row ) => (
				<span className="font-medium text-text-black">
					<SearchVolume volume={ row.volume } aiShown={ row.ai_shown } />
				</span>
			)
		},
		{
			key: 'results',
			label: __( 'Results', 'burst-statistics' ),
			align: 'right',
			minWidth: 80,
			cell: ( row ) => {
				const hasResults = 0 < row.results;
				const searchUrl = `${siteUrl.replace( /\/$/, '' )}/?s=${encodeURIComponent( row.term )}`;

				if ( ! hasResults ) {
					return (
						<span
							className="inline-flex items-center gap-1 text-red font-medium"
							title={ __( 'No results found', 'burst-statistics' ) }
						>
							<Icon name="warning-triangle" size={ 13 } color="red" />
							{ __( 'None', 'burst-statistics' ) }
						</span>
					);
				}

				return (
					<a
						href={ searchUrl }
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 text-text-black hover:text-blue-600 transition-colors font-medium"
						title={ __( 'View search results', 'burst-statistics' ) }
					>
						{ formatNumber( row.results ) }
						<Icon name="external-link" size={ 11 } color="gray" />
					</a>
				);
			}
		}
	];

	return isSmartMatchActive() ? [ ...columns, aiMatchColumn ] : columns;
}
