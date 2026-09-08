import { __, sprintf } from '@wordpress/i18n';
import { InsightCallout } from '@/components/Common/InsightCallout';
import { formatNumber, formatPercentage } from '@/utils/formatting';
import type { SearchQueryRow } from '@/api/getSearchQueriesData';
import { getQueryCtr } from './searchQueriesUtils';

type SearchQueriesInsightProps = {
	opportunity: SearchQueryRow;
};

/**
 * Explains why the selected query is a concrete search-growth opportunity.
 *
 * @param props             - Component properties.
 * @param props.opportunity - Query selected by the opportunity rule.
 * @return Search query insight.
 */
export const SearchQueriesInsight = ({
	opportunity
}: SearchQueriesInsightProps ) => (
	<InsightCallout>
		{ sprintf(

			/* translators: 1: query, 2: impressions, 3: click-through rate, 4: average position. */
			__(
				'“%1$s” gets %2$s impressions but only a %3$s click-through rate — less than half of what position %4$s typically earns. A stronger title or a dedicated section could win more of these clicks.',
				'burst-statistics'
			),
			opportunity.query,
			formatNumber( opportunity.impressions ),
			formatPercentage( getQueryCtr( opportunity ) ),
			formatNumber( opportunity.position, 1, false )
		) }
	</InsightCallout>
);
