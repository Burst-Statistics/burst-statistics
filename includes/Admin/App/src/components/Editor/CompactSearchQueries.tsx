import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import type { SearchQueriesData, SearchQueryRow } from '@/api/getSearchQueriesData';
import useGSCData from '@/hooks/useGSCData';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface CompactSearchQueriesProps {
	searchData?: SearchQueriesData;
	isLoading?: boolean;
}

const SearchQueriesTable: React.FC<{ rows: SearchQueryRow[] }> = ({ rows }) => (
	<div className="overflow-x-auto">
		<table className="w-full text-left text-xs">
			<thead>
				<tr className="border-b border-gray-100 text-[11px] font-medium text-text-gray">
					<th className="pb-1.5 font-medium">{ __( 'Query', 'burst-statistics' ) }</th>
					<th className="pb-1.5 text-right font-medium">{ __( 'Clicks', 'burst-statistics' ) }</th>
					<th className="pb-1.5 text-right font-medium">{ __( 'Pos.', 'burst-statistics' ) }</th>
				</tr>
			</thead>
			<tbody className="divide-y divide-gray-50">
				{ rows.map( ( row, idx ) => (
					<tr key={ `${ row.query }-${ idx }` } className="hover:bg-gray-50/50">
						<td className="max-w-[130px] truncate py-1.5 pr-2 text-text-black" title={ row.query }>
							{ row.query }
						</td>
						<td className="py-1.5 text-right font-medium text-text-black">
							{ row.clicks }
						</td>
						<td className="py-1.5 text-right text-text-gray">
							{ 'number' === typeof row.position ? row.position.toFixed( 1 ) : row.position }
						</td>
					</tr>
				) ) }
			</tbody>
		</table>
	</div>
);

const SearchConsolePrompt: React.FC = () => (
	<div className="rounded-md bg-gray-50 p-2.5 text-center text-xs text-text-gray">
		<p className="mb-2">
			{ __(
				'Connect Google Search Console to see which search terms bring visitors here.',
				'burst-statistics'
			) }
		</p>
		<a
			href="admin.php?page=burst#/settings/integrations"
			target="_blank"
			rel="noopener noreferrer"
			className="inline-block text-xs font-medium text-green-700 hover:underline"
		>
			{ __( 'Connect Search Console ↗', 'burst-statistics' ) }
		</a>
	</div>
);

/**
 * Compact search queries section showing top search queries, clicks, and average ranking position.
 *
 * Falls back to connection prompt if Google Search Console is not configured.
 *
 * @param props            - Component properties.
 * @param props.searchData - Search Console queries dataset.
 * @param props.isLoading  - Whether request is in-flight.
 * @return Collapsible section element.
 */
// fallow-ignore-next-line complexity
export const CompactSearchQueries: React.FC<CompactSearchQueriesProps> = ({
	searchData,
	isLoading = false
}) => {
	const [ isOpen, setIsOpen ] = useState( false );
	const { status } = useGSCData();

	const isGscConnected = 'connected' === status;
	const rows: SearchQueryRow[] = React.useMemo( () => {
		return Array.isArray( searchData?.rows ) ? searchData.rows.slice( 0, 5 ) : [];
	}, [ searchData ]);

	return (
		<div className="border-t border-gray-200 py-3">
			<button
				type="button"
				onClick={ () => setIsOpen( ( prev ) => ! prev ) }
				className="flex w-full items-center justify-between text-left text-xs font-semibold text-text-black hover:text-gray-700"
			>
				<span>{ __( 'Search queries', 'burst-statistics' ) }</span>
				{ isOpen ? (
					<ChevronUp size={ 16 } className="text-gray-400" />
				) : (
					<ChevronDown size={ 16 } className="text-gray-400" />
				) }
			</button>

			{ isOpen && (
				<div className="mt-3">
					{ isLoading ? (
						<div className="flex flex-col gap-2 animate-pulse">
							{ [ 0, 1, 2 ].map( ( key ) => (
								<div key={ key } className="h-4 w-full rounded bg-gray-100" />
							) ) }
						</div>
					) : ! isGscConnected ? (
						<SearchConsolePrompt />
					) : 0 === rows.length ? (
						<p className="text-xs text-text-gray">
							{ __( 'No search queries recorded for this page yet.', 'burst-statistics' ) }
						</p>
					) : (
						<SearchQueriesTable rows={ rows } />
					) }
				</div>
			) }
		</div>
	);
};
