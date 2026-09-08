import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';
import Icon from '@/utils/Icon';
import { formatNumber } from '@/utils/formatting';
import type { SearchQueryRow } from '@/api/getSearchQueriesData';
import { getSearchQueryBarWidth } from './searchQueriesUtils';

const COLLAPSED_ROW_COUNT = 5;

type SearchQueriesTableProps = {
	rows: SearchQueryRow[];
	opportunity: SearchQueryRow | null;
};

type SearchQueriesRowsProps = SearchQueriesTableProps & {
	maxClicks: number;
};

type SearchQueriesToggleProps = {
	isExpanded: boolean;
	rowCount: number;
	onToggle: () => void;
};

/**
 * Return rows in the order used by both the table and its expand control.
 */
const sortSearchQueryRows = ( rows: SearchQueryRow[]): SearchQueryRow[] =>
	[ ...rows ].sort( ( first, second ) => second.clicks - first.clicks );

/**
 * Limit the initial table without changing the click-sorted source rows.
 */
const getVisibleSearchQueryRows = (
	rows: SearchQueryRow[],
	isExpanded: boolean
): SearchQueryRow[] => isExpanded ? rows : rows.slice( 0, COLLAPSED_ROW_COUNT );

/**
 * Highest click count used to scale the relative row bars.
 */
const getMaxSearchQueryClicks = ( rows: SearchQueryRow[]): number =>
	rows[ 0 ]?.clicks ?? 0;

/**
 * Render the metric rows independently from the table controls.
 */
const SearchQueriesRows = ({
	rows,
	opportunity,
	maxClicks
}: SearchQueriesRowsProps ) => (
	<>
		{rows.map( ( row ) => {
			const isOpportunity = opportunity?.query === row.query;
			const barWidth = getSearchQueryBarWidth( row.clicks, maxClicks );

			return (
				<tr key={ row.query } className="align-top">
					<td className="pb-3 pr-5">
						<p className="m-0 truncate font-medium text-text-black">
							{ row.query }
						</p>
						<div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-gray-50">
							<div
								className={ clsx(
									'h-full rounded-sm',
									isOpportunity ? 'bg-orange' : 'bg-green'
								) }
								style={{ width: `${ barWidth }%` }}
							/>
						</div>
					</td>
					<td className="pb-3 text-right font-medium text-text-black">
						{ formatNumber( row.clicks ) }
					</td>
					<td className="pb-3 text-right text-text-gray">
						{ formatNumber( row.impressions ) }
					</td>
					<td className="pb-3 text-right font-medium text-text-black">
						{ formatNumber( row.position, 1, false ) }
					</td>
				</tr>
			);
		}) }
	</>
);

/**
 * Expand or collapse query rows when more than the initial five are present.
 */
const SearchQueriesToggle = ({
	isExpanded,
	rowCount,
	onToggle
}: SearchQueriesToggleProps ) => {
	if ( rowCount <= COLLAPSED_ROW_COUNT ) {
		return null;
	}

	return (
		<button
			type="button"
			className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-green hover:underline focus:outline-hidden focus:ring-2 focus:ring-green focus:ring-offset-2"
			aria-expanded={ isExpanded }
			onClick={ onToggle }
		>
			{isExpanded ?
				__( 'Show top queries', 'burst-statistics' ) :
				sprintf(

					/* translators: %s: number of visible query rows. */
					__( 'All %s queries', 'burst-statistics' ),
					formatNumber( rowCount, 0, false )
				)
			}
			<Icon
				name={ isExpanded ? 'chevron-up' : 'chevron-down' }
				size={ 14 }
				aria-hidden="true"
			/>
		</button>
	);
};

/**
 * Displays click-sorted Search Console query rows with progressive disclosure.
 *
 * @param props             - Component properties.
 * @param props.rows        - Query rows.
 * @param props.opportunity - Opportunity row highlighted in amber.
 * @return Compact search query table.
 */
export const SearchQueriesTable = ({
	rows,
	opportunity
}: SearchQueriesTableProps ) => {
	const [ isExpanded, setIsExpanded ] = useState( false );
	const sortedRows = sortSearchQueryRows( rows );
	const visibleRows = getVisibleSearchQueryRows( sortedRows, isExpanded );
	const maxClicks = getMaxSearchQueryClicks( sortedRows );

	return (
		<div className="mt-5">
			<div className="overflow-x-auto">
				<table className="w-full min-w-[560px] table-fixed border-separate border-spacing-0 text-sm">
					<colgroup>
						<col />
						<col className="w-20" />
						<col className="w-24" />
						<col className="w-20" />
					</colgroup>
					<thead>
						<tr className="text-left text-text-gray-light">
							<th className="pb-2 font-normal">{ __( 'Query', 'burst-statistics' ) }</th>
							<th className="pb-2 text-right font-normal">{ __( 'Clicks', 'burst-statistics' ) }</th>
							<th className="pb-2 text-right font-normal">{ __( 'Impr.', 'burst-statistics' ) }</th>
							<th className="pb-2 text-right font-normal">{ __( 'Pos.', 'burst-statistics' ) }</th>
						</tr>
					</thead>
					<tbody>
						<SearchQueriesRows
							rows={ visibleRows }
							opportunity={ opportunity }
							maxClicks={ maxClicks }
						/>
					</tbody>
				</table>
			</div>

			<SearchQueriesToggle
				isExpanded={ isExpanded }
				rowCount={ sortedRows.length }
				onToggle={ () => setIsExpanded( ! isExpanded ) }
			/>
		</div>
	);
};
