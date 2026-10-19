import { useState, useMemo, useCallback, memo } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getSourceReferrers } from '@/api/getSourceReferrers';
import { safeDecodeURI } from '@/utils/lib';
import { formatNumber } from '@/utils/formatting';
import useExpandableRowQuery from '@/hooks/useExpandableRowQuery';
import { useFilters } from '@/hooks/useFilters';
import ExpandableRowSkeleton from './ExpandableRowSkeleton';
import ParameterShareBar from './Parameters/ParameterShareBar';
import ParameterSearchInput from './Parameters/ParameterSearchInput';
import ParameterSortHeader from './Parameters/ParameterSortHeader';
import ParameterRowActions from './Parameters/ParameterRowActions';

/**
 * Sorts referrer rows by active column and direction.
 *
 * @param {Array}  rows          Referrer rows to sort.
 * @param {string} sortField     Active sort column.
 * @param {string} sortDirection 'asc' or 'desc'.
 * @return {Array} Sorted rows.
 */
// fallow-ignore-next-line complexity
const sortReferrers = ( rows, sortField, sortDirection ) => {
	const sorted = [ ...rows ];

	// fallow-ignore-next-line complexity
	sorted.sort( ( a, b ) => {
		let cmp = 0;
		if ( 'referrer' === sortField ) {
			const aRef = a?.referrer || '';
			const bRef = b?.referrer || '';
			cmp = aRef.localeCompare( bRef );
		} else {
			const aVis = Number( a?.visitors ?? 0 );
			const bVis = Number( b?.visitors ?? 0 );
			cmp = aVis - bVis;
		}
		return 'asc' === sortDirection ? cmp : -cmp;
	});
	return sorted;
};

/**
 * Row used inside react-data-table-component's `expandableRowsComponent`.
 *
 * Lazily fetches the raw referrers for the parent row's Source the
 * first time the row is expanded. Provides search filtering, sorting,
 * share bars, and filter/kebab actions matching the parameter sub-table pattern.
 *
 * @param {Object} props           Component props.
 * @param {Object} props.data      The parent row data from the referrers datatable.
 * @param {string} props.startDate Active start date for the current view.
 * @param {string} props.endDate   Active end date for the current view.
 * @param {string} props.range     Active date range identifier.
 *
 * @return {JSX.Element} Sub-table of raw referrers for the source row.
 */
// fallow-ignore-next-line complexity
const SourceReferrersRow = ({ data, startDate, endDate, range }) => {
	const source = data?.source || data?.referrer || '';
	const totalVisitors = Number( data?.visitors ?? 0 );

	const [ searchQuery, setSearchQuery ] = useState( '' );
	const [ sortField, setSortField ] = useState( 'visitors' );
	const [ sortDirection, setSortDirection ] = useState( 'desc' );

	const { setFilters } = useFilters();

	const { isLoading, error, rows } = useExpandableRowQuery({
		queryKey: [ 'source-referrers', source, startDate, endDate ],
		queryFn: () =>
			getSourceReferrers({
				source,
				startDate,
				endDate,
				range
			}),
		enabled: Boolean( source && startDate && endDate )
	});

	const handleSort = useCallback(
		( field ) => {
			if ( sortField === field ) {
				setSortDirection( ( prev ) => ( 'asc' === prev ? 'desc' : 'asc' ) );
			} else {
				setSortField( field );
				setSortDirection( 'desc' );
			}
		},
		[ sortField ]
	);

	const handleFilter = useCallback(
		( _key, value ) => {
			setFilters( 'referrer', value );
		},
		[ setFilters ]
	);

	const handleExclude = useCallback(
		( _key, value ) => {
			setFilters( 'referrer', `!${value}` );
		},
		[ setFilters ]
	);

	const filteredRows = useMemo( () => {
		const query = searchQuery.trim().toLowerCase();
		if ( ! query ) {
			return rows;
		}
		return rows.filter( ( row ) => {
			const ref = ( row?.referrer || '' ).toLowerCase();
			return ref.includes( query );
		});
	}, [ rows, searchQuery ]);

	const sortedRows = useMemo( () => {
		return sortReferrers( filteredRows, sortField, sortDirection );
	}, [ filteredRows, sortField, sortDirection ]);

	const totalLabel = sprintf(

		// translators: %d is the total visitors for this traffic source.
		__( 'Total: %d visitors', 'burst-statistics' ),
		totalVisitors
	);

	return (
		<div className="border-b border-gray-100 bg-gray-50 px-6 py-4 @max-xl:px-2.5">
			<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-baseline gap-2 text-sm">
					<span className="font-semibold text-text-black">
						{safeDecodeURI( source )}
					</span>
					<span className="text-xs text-text-gray">({totalLabel})</span>
				</div>

				{ ! isLoading && ! error && 0 < rows.length && (
					<ParameterSearchInput
						value={searchQuery}
						onChange={setSearchQuery}
						placeholder={__( 'Search referrers...', 'burst-statistics' )}
					/>
				)}
			</div>

			{isLoading && <ExpandableRowSkeleton />}

			{ ! isLoading && error && (
				<div className="rounded-md border border-red-200 bg-red-50 p-4 text-xs text-red-600">
					{__( 'Could not load raw referrers details.', 'burst-statistics' )}
				</div>
			)}

			{ ! isLoading && ! error && 0 === sortedRows.length && (
				<div className="rounded-md border border-gray-200 bg-white p-6 text-center text-xs text-text-gray">
					{searchQuery ?
						__( 'No referrers match your search.', 'burst-statistics' ) :
						__( 'No raw referrers recorded for this source.', 'burst-statistics' )}
				</div>
			)}

			{ ! isLoading && ! error && 0 < sortedRows.length && (
				<div className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-xs">
					<div className="overflow-x-auto">
						<table className="w-full border-collapse text-left text-xs">
							<thead>
								<tr className="border-b border-gray-200 bg-gray-50 text-text-gray font-medium">
									<ParameterSortHeader
										field="referrer"
										label={__( 'Referrer', 'burst-statistics' )}
										activeSortField={sortField}
										sortDirection={sortDirection}
										onSort={handleSort}
										align="left"
									/>
									<ParameterSortHeader
										field="visitors"
										label={__( 'Visitors', 'burst-statistics' )}
										activeSortField={sortField}
										sortDirection={sortDirection}
										onSort={handleSort}
										align="right"
									/>
									<th scope="col" className="py-2.5 pl-3 pr-4 text-right uppercase tracking-wider">
										{__( 'Share of source', 'burst-statistics' )}
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100">
								{

									// fallow-ignore-next-line complexity
									sortedRows.map( ( row, index ) => {
										const rawReferrer = row?.referrer || __( 'Direct / unknown', 'burst-statistics' );
										const visitors = Number( row?.visitors ?? 0 );
										const share = 0 < totalVisitors ? ( visitors / totalVisitors ) * 100 : 0;

										return (
											<tr
												key={`burst-referrer-${source}-${rawReferrer}-${index}`}
												onClick={() => handleFilter( 'referrer', rawReferrer )}
												className="group cursor-pointer transition-colors hover:bg-gray-50"
											>
												<td className="py-2 pl-4 pr-3">
													<div className="flex items-center justify-between gap-2">
														<div className="flex min-w-0 items-center gap-2">
															<span className="w-4 text-center text-text-gray-light" aria-hidden="true">
																{'\u21B3'}
															</span>
															<span className="truncate font-mono text-xs text-text-black">
																{rawReferrer}
															</span>
														</div>

														<ParameterRowActions
															paramKey="referrer"
															paramValue={rawReferrer}
															onFilter={handleFilter}
															onExclude={handleExclude}
														/>
													</div>
												</td>
												<td className="px-3 py-2 text-right font-medium tabular-nums text-text-black">
													{formatNumber( visitors, 0, false )}
												</td>
												<td className="py-2 pl-3 pr-4 text-right">
													<ParameterShareBar share={share} />
												</td>
											</tr>
										);
									})
								}
							</tbody>
						</table>
					</div>

					<div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2 text-xxs text-text-gray">
						<span>
							{sprintf(

								// translators: %d is the number of referrers displayed.
								__( 'All %d referrers shown', 'burst-statistics' ),
								sortedRows.length
							)}
						</span>
					</div>
				</div>
			)}
		</div>
	);
};

export default memo( SourceReferrersRow );
