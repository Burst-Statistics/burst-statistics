import { memo, useMemo } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import { formatNumber } from '@/utils/formatting';
import { summarizeSmartMatchRows } from './smartMatchSummaryData';
import type { SmartMatchSummaryRow } from './smartMatchSummaryData';

type SmartMatchSummaryProps = {

	/** All search-term rows of the table (not just the visible page). */
	rows: SmartMatchSummaryRow[];
};

/**
 * One-line conclusion under the search-terms table: how many of the searches
 * that found nothing got a SmartMatch answer, and how many such terms still have
 * no page at all.
 *
 * @param {SmartMatchSummaryProps} props Component props.
 * @return {JSX.Element|null} The summary line, or null when no search came up empty.
 */
const SmartMatchSummary = memo( ({ rows }: SmartMatchSummaryProps ) => {
	const { answered, emptySearches, termsWithoutPage } = useMemo( () => summarizeSmartMatchRows( rows ), [ rows ]);

	if ( 0 === emptySearches ) {
		return null;
	}

	return (
		<div className="flex items-center gap-2 border-t border-gray-200 px-6 py-3 text-sm text-text-gray">
			<Icon name="check" size={14} color="green" className="shrink-0" />
			<span>
				<strong className="font-semibold text-text-black">
					{sprintf(

						/* translators: 1: searches answered by SmartMatch, 2: searches without native results. */
						__( 'SmartMatch answered %1$s of %2$s searches that found nothing.', 'burst-statistics' ),
						formatNumber( answered, 0, false ),
						formatNumber( emptySearches, 0, false )
					)}
				</strong>
				{0 < termsWithoutPage && (
					<>
						{' '}
						{sprintf(

							/* translators: %d: number of search terms without results or AI match. */
							_n( '%d term still has no page.', '%d terms still have no page.', termsWithoutPage, 'burst-statistics' ),
							termsWithoutPage
						)}
					</>
				)}
			</span>
		</div>
	);
});

SmartMatchSummary.displayName = 'SmartMatchSummary';

export default SmartMatchSummary;
