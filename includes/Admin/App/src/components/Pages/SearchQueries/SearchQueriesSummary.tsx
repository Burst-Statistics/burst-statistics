import { __, sprintf } from '@wordpress/i18n';
import { formatNumber } from '@/utils/formatting';
import type { SearchQueriesData } from '@/api/getSearchQueriesData';

type SearchQueriesSummaryProps = {
	totals: SearchQueriesData['totals'];
};

/**
 * Displays the three headline Search Console metrics in one scan-friendly row.
 *
 * @param props        - Component properties.
 * @param props.totals - Search Console totals.
 * @return Search query summary.
 */
export const SearchQueriesSummary = ({
	totals
}: SearchQueriesSummaryProps ) => (
	<p className="m-0 text-sm text-text-gray">
		{ sprintf(

			/* translators: 1: clicks, 2: impressions, 3: average position. */
			__(
				'%1$s clicks · %2$s impressions · avg position %3$s',
				'burst-statistics'
			),
			formatNumber( totals.clicks ),
			formatNumber( totals.impressions ),
			formatNumber( totals.avgPosition, 1, false )
		) }
	</p>
);
