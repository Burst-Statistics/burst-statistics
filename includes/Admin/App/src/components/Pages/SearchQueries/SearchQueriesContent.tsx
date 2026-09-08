import { __ } from '@wordpress/i18n';
import type { SearchQueriesData, SearchQueryRow } from '@/api/getSearchQueriesData';
import { SearchQueriesSummary } from './SearchQueriesSummary';
import { SearchQueriesTable } from './SearchQueriesTable';
import { SearchQueriesProgress } from './SearchQueriesProgress';
import { SearchQueriesEmptyState, SearchQueriesInitialPending } from './SearchQueriesEmptyState';
import { SearchQueriesLoadingState } from './SearchQueriesLoadingState';
import type { SearchQueriesViewModel } from './searchQueriesViewModel';

interface SearchQueriesContentProps extends SearchQueriesViewModel {
	data: SearchQueriesData | undefined;
	isLoading: boolean;
	isPropertyPaused: boolean;
}

interface SearchQueriesResultsProps {
	data: SearchQueriesData;
	rows: SearchQueryRow[];
	opportunity: SearchQueryRow | null;
	isPending: boolean;
	isFailed: boolean;
	isUnavailable: boolean;
	isPropertyPaused: boolean;
	readyDays: number;
	totalDays: number;
}

/**
 * Available rows and any non-final range notice.
 */
const SearchQueriesResults = ({
	data,
	rows,
	opportunity,
	isPending,
	isFailed,
	isUnavailable,
	isPropertyPaused,
	readyDays,
	totalDays
}: SearchQueriesResultsProps ) => (
	<>
		{isPending && (
			<SearchQueriesProgress
				readyDays={ readyDays }
				totalDays={ totalDays }
				className="mb-4"
			>
				{ __( 'Showing partial Search Console data while the rest of this date range is fetched in the background.', 'burst-statistics' ) }
			</SearchQueriesProgress>
		) }
		{isFailed && (
			<p className="mb-4 mt-0 text-sm text-text-gray-light">
				{ __( 'Some Search Console dates could not be fetched. Showing the available data.', 'burst-statistics' ) }
			</p>
		) }
		{isUnavailable && (
			<p className="mb-4 mt-0 text-sm text-text-gray-light">
				{isPropertyPaused ?
					__( 'Showing stored Search Console data. Reconnect an account with access to fetch missing dates.', 'burst-statistics' ) :
					__( 'Showing available Search Console data. Ask a site administrator to fetch the missing dates.', 'burst-statistics' )
				}
			</p>
		) }
		<SearchQueriesSummary totals={ data.totals } />
		<SearchQueriesTable rows={ rows } opportunity={ opportunity } />
	</>
);

/**
 * Select one connected data state without overlapping render conditions.
 */
export const SearchQueriesContent = ({
	data,
	isLoading,
	isPropertyPaused,
	rows,
	dataStatus,
	isPending,
	isFailed,
	isUnavailable,
	isInitialPending,
	readyDays,
	totalDays,
	pendingDays,
	opportunity
}: SearchQueriesContentProps ) => {
	if ( isLoading ) {
		return <SearchQueriesLoadingState />;
	}
	if ( isInitialPending ) {
		return <SearchQueriesInitialPending readyDays={ readyDays } totalDays={ totalDays } />;
	}
	if ( 0 === rows.length ) {
		return (
			<SearchQueriesEmptyState
				dataStatus={ dataStatus }
				readyDays={ readyDays }
				totalDays={ totalDays }
				pendingDays={ pendingDays }
				isPropertyPaused={ isPropertyPaused }
			/>
		);
	}
	if ( ! data ) {
		return null;
	}

	return (
		<SearchQueriesResults
			data={ data }
			rows={ rows }
			opportunity={ opportunity }
			isPending={ isPending }
			isFailed={ isFailed }
			isUnavailable={ isUnavailable }
			isPropertyPaused={ isPropertyPaused }
			readyDays={ readyDays }
			totalDays={ totalDays }
		/>
	);
};
