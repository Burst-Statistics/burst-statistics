import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { formatNumber } from '@/utils/formatting';
import { SearchQueriesProgress } from './SearchQueriesProgress';
import type { SearchQueriesStatus } from './searchQueriesViewModel';

interface SearchQueriesEmptyStateProps {
	dataStatus: SearchQueriesStatus;
	readyDays: number;
	totalDays: number;
	pendingDays: number;
	isPropertyPaused: boolean;
}

/**
 * Center an informational message inside the query block.
 */
const SearchQueriesCenteredMessage = ({ children }: { children: ReactNode }) => (
	<div className="flex min-h-52 items-center justify-center px-4">
		<p className="m-0 max-w-md text-center text-sm text-text-gray-light">
			{ children }
		</p>
	</div>
);

/**
 * Initial pending state before the first Search Console chunk completes.
 */
export const SearchQueriesInitialPending = ({
	readyDays,
	totalDays
}: { readyDays: number; totalDays: number }) => (
	<div className="flex min-h-52 items-center justify-center px-4">
		<SearchQueriesProgress
			readyDays={ readyDays }
			totalDays={ totalDays }
			className="w-full max-w-md text-center"
		>
			{ __( 'Fetching Search Console data for this page…', 'burst-statistics' ) }
		</SearchQueriesProgress>
	</div>
);

/**
 * Empty-state copy for completed and interrupted Search Console ranges.
 */
const getSearchQueriesEmptyMessage = (
	dataStatus: SearchQueriesStatus,
	isPropertyPaused: boolean
): string => {
	if ( 'failed' === dataStatus ) {
		return __( 'Search Console data could not be fetched. Please try again later.', 'burst-statistics' );
	}
	if ( 'unavailable' === dataStatus ) {
		if ( isPropertyPaused ) {
			return __( 'Search Console access to this property is paused. Reconnect an account with access to fetch data for this page.', 'burst-statistics' );
		}
		return __( 'Search Console data is not available for this page yet.', 'burst-statistics' );
	}
	return __( 'No Search Console queries were found for this page in the selected date range.', 'burst-statistics' );
};

/**
 * Query-free state after at least one range status is available.
 */
export const SearchQueriesEmptyState = ({
	dataStatus,
	readyDays,
	totalDays,
	pendingDays,
	isPropertyPaused
}: SearchQueriesEmptyStateProps ) => {
	if ( 'pending' === dataStatus ) {
		return (
			<div className="flex min-h-52 items-center justify-center px-4">
				<SearchQueriesProgress
					readyDays={ readyDays }
					totalDays={ totalDays }
					className="w-full max-w-md text-center"
				>
					{ sprintf(

						/* translators: 1: number of checked days, 2: number of pending days. */
						__( 'No queries were found in the checked dates. Checked days: %1$s. Pending days: %2$s.', 'burst-statistics' ),
						formatNumber( readyDays, 0, false ),
						formatNumber( pendingDays, 0, false )
					) }
				</SearchQueriesProgress>
			</div>
		);
	}

	return (
		<SearchQueriesCenteredMessage>
			{ getSearchQueriesEmptyMessage( dataStatus, isPropertyPaused ) }
		</SearchQueriesCenteredMessage>
	);
};
