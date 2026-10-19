import { __ } from '@wordpress/i18n';
import { formatNumber, formatTimes } from '@/utils/formatting';
import type { SearchTermSuggestionsResponse } from '@/api/getSearchTermSuggestions';
import AiMatchMissRow from './AiMatchMissRow';

type AiMatchHistoryTableProps = {
	data: SearchTermSuggestionsResponse;
};

/**
 * Table of the pages SmartMatch showed for one term, with how often each was
 * shown and clicked, followed by the searches that showed no page.
 *
 * @param {AiMatchHistoryTableProps} props Component props.
 * @return {JSX.Element} The table.
 */
const AiMatchHistoryTable = ({ data }: AiMatchHistoryTableProps ) => (
	<table className="w-full text-sm">
		<thead>
			<tr className="text-[10px] font-semibold uppercase tracking-wider text-text-gray">
				<th scope="col" className="px-5 pt-3 pb-1 text-left font-semibold">{__( 'Suggested page', 'burst-statistics' )}</th>
				<th scope="col" className="px-2 pt-3 pb-1 text-right font-semibold">{__( 'Shown', 'burst-statistics' )}</th>
				<th scope="col" className="pl-2 pr-5 pt-3 pb-1 text-right font-semibold">{__( 'Clicked', 'burst-statistics' )}</th>
			</tr>
		</thead>
		<tbody>
			{data.rows.map( ( row ) => (
				<tr key={row.post_id}>
					<td className="px-5 py-2 align-top">
						<a
							href={row.url}
							target="_blank"
							rel="noopener noreferrer"
							className="block max-w-[240px] truncate font-medium text-text-black hover:text-blue"
							title={row.title}
						>
							{row.title}
						</a>
						<span className="block max-w-[240px] truncate text-xs text-text-gray" title={row.path}>
							{row.path}
						</span>
					</td>
					<td className="px-2 py-2 text-right align-top tabular-nums">{formatTimes( row.shown )}</td>
					<td className="pl-2 pr-5 py-2 text-right align-top tabular-nums text-green">
						{formatNumber( row.clicked, 0, false )}
					</td>
				</tr>
			) )}
			<AiMatchMissRow
				label={__( 'No relevant page found', 'burst-statistics' )}
				description={__( 'The AI found nothing that fits the search', 'burst-statistics' )}
				count={data.ai_found_nothing}
			/>
			<AiMatchMissRow
				label={__( 'No AI match shown', 'burst-statistics' )}
				description={__( 'Daily budget used up or AI unavailable', 'burst-statistics' )}
				count={data.no_suggestion}
			/>
		</tbody>
	</table>
);

export default AiMatchHistoryTable;
