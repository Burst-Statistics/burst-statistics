import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import { formatNumber } from '@/utils/formatting';
import { safeDecodeURI } from '@/utils/lib';
import { toast } from '@/utils/toast';
import useExpandableRowQuery from '@/hooks/useExpandableRowQuery';
import { getPageParameters } from '@/api/getPageParameters';
import ParameterSortHeader, {
	getNextSortDirection,
	sortSubTableRows
} from './ParameterSortHeader';
import ParameterMetricsHeaders from './ParameterMetricsHeaders';
import ParameterRowActions from './ParameterRowActions';
import ParameterMetricsCells from './ParameterMetricsCells';
import ExpandableRowSkeleton from '../ExpandableRowSkeleton';
import Tooltip from '@/components/Common/Tooltip';

interface ParameterMemberRow {
	value: string;
	pageviews: number;
	visitors: number;
}

interface ParameterValueRow {
	parameter?: string;
	value: string;
	pageviews: number;
	visitors: number;
	group?: boolean;
	member_count?: number;
	min_version?: string;
	max_version?: string;
	newest_value?: string;
	newest_views?: number;
	members?: ParameterMemberRow[];
}

interface ParameterLevelTwoPaneProps {

	/** Active parameter key being drilled into. */
	activeKey: string;

	/** Parent page URL. */
	pageUrl: string;

	/** Start date for query. */
	startDate: string;

	/** End date for query. */
	endDate: string;

	/** Date range identifier. */
	range: string;

	/** Total views for this parameter key (from Level 1). */
	keyViews: number;

	/** Total distinct values count for this parameter key. */
	totalValues: number;

	/** Whether this key was flagged as high cardinality. */
	isHighCardinality?: boolean;

	/** Whether this key was auto-skipped directly to Level 2. */
	isSingleKeyAutoSkip?: boolean;

	/** Callback to return to Level 1. */
	onBack: () => void;

	/** Callback when filtering on a specific value. */
	onFilter: ( key: string, value: string ) => void;

	/** Callback when excluding a specific value. */
	onExclude: ( key: string, value: string ) => void;

	/** Optional callback when search open state changes (for height freezing). */
	onSearchOpenChange?: ( isOpen: boolean ) => void;

	/** Optional additional CSS classes. */
	className?: string;
}

type SortField = 'value' | 'pageviews' | 'visitors';
type SortDirection = 'asc' | 'desc';

/**
 * Filter rows based on search query.
 *
 * @param {ParameterValueRow[]} rows        Raw rows.
 * @param {string}             searchQuery Search string.
 * @return {ParameterValueRow[]} Filtered rows.
 */
const filterRowsBySearch = ( rows: ParameterValueRow[], searchQuery: string ): ParameterValueRow[] => {
	const query = searchQuery.trim().toLowerCase();
	if ( ! query ) {
		return rows;
	}
	return rows.filter( ( row ) => {
		if ( row.value.toLowerCase().includes( query ) ) {
			return true;
		}
		if ( row.group && row.members ) {
			return row.members.some( ( member ) => member.value.toLowerCase().includes( query ) );
		}
		return false;
	});
};

interface ParameterBackButtonProps {
	onBack: () => void;
}

const ParameterBackButton: React.FC<ParameterBackButtonProps> = ({ onBack }) => (
	<button
		type="button"
		onClick={onBack}
		className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-medium text-text-gray shadow-2xs hover:bg-gray-50 hover:text-text-black cursor-pointer"
	>
		<Icon name="chevron-left" size={12} color="gray" />
		<span>{__( 'All parameters', 'burst-statistics' )}</span>
	</button>
);

/**
 * Level 2 detail pane: displays individual and rolled-up parameter values.
 *
 * Supports search filtering, sorting, inline group rollup expansion,
 * hover actions (filter / kebab), and the high-cardinality guard.
 *
 * @param {ParameterLevelTwoPaneProps} props Component props.
 * @return {JSX.Element} Level 2 table view.
 */
// fallow-ignore-next-line complexity
const ParameterLevelTwoPane: React.FC<ParameterLevelTwoPaneProps> = ({
	activeKey,
	pageUrl,
	startDate,
	endDate,
	range,
	keyViews,
	totalValues,
	isHighCardinality = false,
	isSingleKeyAutoSkip = false,
	onBack,
	onFilter,
	onExclude,
	onSearchOpenChange,
	className = ''
}) => {
	const [ searchQuery, setSearchQuery ] = useState<string>( '' );
	const [ debouncedSearchQuery, setDebouncedSearchQuery ] = useState<string>( '' );
	const [ isSearchOpen, setIsSearchOpen ] = useState<boolean>( false );
	const [ sortField, setSortField ] = useState<SortField>( 'pageviews' );
	const [ sortDirection, setSortDirection ] = useState<SortDirection>( 'desc' );
	const [ expandedGroups, setExpandedGroups ] = useState<Record<string, boolean>>({});
	const [ showHighCardinality, setShowHighCardinality ] = useState<boolean>( false );
	const [ isDatasetTruncated, setIsDatasetTruncated ] = useState<boolean>( () => 100 < totalValues );

	useEffect( () => {
		const timer = setTimeout( () => {
			setDebouncedSearchQuery( searchQuery );
		}, 300 );
		return () => clearTimeout( timer );
	}, [ searchQuery ]);

	const handleClearSearch = useCallback( () => {
		setSearchQuery( '' );
		setDebouncedSearchQuery( '' );
	}, []);

	const handleCloseSearch = useCallback( () => {
		setSearchQuery( '' );
		setDebouncedSearchQuery( '' );
		setIsSearchOpen( false );
		onSearchOpenChange?.( false );
	}, [ onSearchOpenChange ]);

	const shouldFetchValues = ! isHighCardinality || showHighCardinality;
	const serverSearch = isDatasetTruncated ? debouncedSearchQuery.trim() : '';

	const { isLoading, error, rows, meta } = useExpandableRowQuery({
		queryKey: [ 'page-parameters', pageUrl, activeKey, startDate, endDate, serverSearch ],
		queryFn: () =>
			getPageParameters({
				pageUrl,
				parameter: activeKey,
				search: serverSearch,
				startDate,
				endDate,
				range
			}),
		enabled: Boolean( activeKey && shouldFetchValues && startDate && endDate )
	});

	const hasMore = Boolean( ( meta as { has_more?: boolean })?.has_more );

	useEffect( () => {
		if ( hasMore ) {
			setIsDatasetTruncated( true );
		}
	}, [ hasMore ]);

	const toggleGroup = useCallback( ( groupKey: string ) => {
		setExpandedGroups( ( prev ) => ({
			...prev,
			[groupKey]: ! prev[groupKey]
		}) );
	}, []);

	const handleSort = useCallback(
		( field: string ) => {
			setSortDirection( ( prevDir ) =>
				getNextSortDirection( sortField, prevDir, field, 'value' )
			);
			setSortField( field as SortField );
		},
		[ sortField ]
	);

	const typedRows = rows as ParameterValueRow[];
	const filteredRows = useMemo(
		() => filterRowsBySearch( typedRows, searchQuery ),
		[ typedRows, searchQuery ]
	);

	const sortedRows = useMemo(
		() => sortSubTableRows( filteredRows, sortField, sortDirection, 'value' ),
		[ filteredRows, sortField, sortDirection ]
	);

	// Footer counts values, not rows: a roll-up row holds member_count values.
	const shownValueCount = useMemo( () => {
		return typedRows.reduce( ( sum, row ) => {
			return sum + ( row.group ? ( row.member_count ?? row.members?.length ?? 0 ) : 1 );
		}, 0 );
	}, [ typedRows ]);

	const rolledUpCount = useMemo( () => {
		return typedRows.reduce( ( sum, row ) => {
			return row.group && row.member_count ? sum + row.member_count : sum;
		}, 0 );
	}, [ typedRows ]);

	// High-cardinality guard card.
	if ( isHighCardinality && ! showHighCardinality ) {
		return (
			<div className={`space-y-3.5 ${className}`}>
				<div className="flex items-center gap-2 text-xs">
					{ ! isSingleKeyAutoSkip && <ParameterBackButton onBack={onBack} />}
					{ ! isSingleKeyAutoSkip && <span className="text-gray-300">/</span>}
					<span className="font-bold text-sm text-text-black">{activeKey}</span>
				</div>

				<div className="rounded-md border border-gray-200 bg-white p-5 shadow-2xs space-y-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span className="text-sm font-semibold text-text-black">{activeKey}</span>
							<span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
								{sprintf(

									// translators: %s is the number of distinct values.
									__( '%s values, nearly all unique', 'burst-statistics' ),
									formatNumber( totalValues, 0, false )
								)}
							</span>
						</div>
						<span className="text-sm font-medium text-text-black">
							{formatNumber( keyViews, 0, false )}
						</span>
					</div>

					<p className="text-xs text-text-gray">
						{__(
							'Click identifiers carry no grouping value. This parameter stays collapsed and is counted, not listed.',
							'burst-statistics'
						)}
					</p>

					<div className="flex items-center gap-2 pt-1">
						<button
							type="button"
							onClick={() => setShowHighCardinality( true )}
							className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-text-black shadow-2xs hover:bg-gray-50 cursor-pointer"
						>
							{__( 'List them anyway', 'burst-statistics' )}
						</button>
						<button
							type="button"
							onClick={() => {
								toast.info(
									sprintf(

										// translators: %s is parameter key.
										__( 'To stop recording %s, add it to ignored parameters in Settings.', 'burst-statistics' ),
										activeKey
									)
								);
							}}
							className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-text-black shadow-2xs hover:bg-gray-50 cursor-pointer"
						>
							{sprintf(

								// translators: %s is parameter key.
								__( 'Stop recording %s', 'burst-statistics' ),
								activeKey
							)}
						</button>
					</div>
				</div>

				<div className="text-xs text-text-gray-light">
					{__(
						'The same treatment covers gclid, msclkid, _ga and session tokens: they are what turns 40 parameters into 200 rows.',
						'burst-statistics'
					)}
				</div>
			</div>
		);
	}

	return (
		<div className={`flex flex-col gap-4 ${className}`}>
			{/* Breadcrumb & Navigation / Search Header */}
			{isSearchOpen ? (
				<div className="flex flex-col gap-2.5 mb-2">
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleCloseSearch}
							className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 shadow-2xs hover:bg-gray-50 hover:text-text-black cursor-pointer"
							aria-label={__( 'Close search', 'burst-statistics' )}
						>
							<Icon name="chevron-left" size={14} color="gray" />
						</button>
						<div className="relative flex-1 flex items-center">
							<span className="pointer-events-none absolute left-3 text-gray-400">
								<Icon name="search" size={13} color="gray" />
							</span>
							<input
								type="text"
								role="searchbox"
								value={searchQuery}
								onChange={( event ) => setSearchQuery( event.target.value )}
								onKeyDown={( event ) => {
									if ( 'Escape' === event.key ) {
										handleCloseSearch();
									}
								}}
								autoFocus
								placeholder={sprintf(

									// translators: %s is the parameter key name.
									__( 'Search %s values...', 'burst-statistics' ),
									activeKey
								)}
								className="w-full rounded-md border border-green bg-white py-1.5 pl-8 pr-8 text-xs text-text-black placeholder:text-text-gray-light ring-1 ring-green focus:outline-hidden shadow-2xs"
								aria-label={sprintf(

									// translators: %s is the parameter key name.
									__( 'Search %s values...', 'burst-statistics' ),
									activeKey
								)}
							/>
							{searchQuery && (
								<button
									type="button"
									onClick={handleClearSearch}
									className="absolute right-2.5 flex items-center justify-center rounded p-0.5 text-gray-400 hover:text-text-black cursor-pointer"
									aria-label={__( 'Clear search query', 'burst-statistics' )}
								>
									<Icon name="times" size={12} color="gray" />
								</button>
							)}
						</div>
					</div>
					<div className="text-xs text-text-gray font-normal pl-10">
						{serverSearch ?
							sprintf(

								// translators: %1$s is parameter key, %2$d is matching rows.
								__( '%1$s · %2$d rows match', 'burst-statistics' ),
								activeKey,
								sortedRows.length
							) :
							sprintf(

								// translators: %1$s is parameter key, %2$d is matching rows, %3$d is total rows.
								__( '%1$s · %2$d of %3$d rows match', 'burst-statistics' ),
								activeKey,
								sortedRows.length,
								typedRows.length
							)}
					</div>
				</div>
			) : (
				<div className="flex flex-wrap items-center justify-between gap-3 mb-2">
					<div className="flex items-center gap-2 text-xs">
						{ ! isSingleKeyAutoSkip && <ParameterBackButton onBack={onBack} />}
						{ ! isSingleKeyAutoSkip && <span className="text-gray-300">/</span>}
						{50 < activeKey.length ? (
							<Tooltip content={<span className="break-all text-xs">{activeKey}</span>}>
								<span className="font-bold text-sm text-text-black">
									{`${ activeKey.slice( 0, 50 ) }...`}
								</span>
							</Tooltip>
						) : (
							<span className="font-bold text-sm text-text-black">{activeKey}</span>
						)}
						<span className="text-xs text-text-gray font-normal">
							{sprintf(

								// translators: %1$d is the total distinct values count, %2$d is the row count after roll-up, %3$s is total views.
								__( '%1$d values, %2$d rows after roll-up · %3$s views', 'burst-statistics' ),
								totalValues,
								typedRows.length,
								formatNumber( keyViews, 0, false )
							)}
						</span>
					</div>

					<button
						type="button"
						onClick={() => {
							setIsSearchOpen( true );
							onSearchOpenChange?.( true );
						}}
						className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-400 shadow-2xs transition-colors hover:bg-gray-50 hover:text-text-black cursor-pointer"
						aria-label={__( 'Open search', 'burst-statistics' )}
						title={__( 'Search', 'burst-statistics' )}
					>
						<Icon name="search" size={14} color="gray" />
					</button>
				</div>
			)}

			{/* Auto-skip notification banner when page is tagged with only 1 parameter */}
			{isSingleKeyAutoSkip && (
				<div className="text-sm font-semibold text-text-black">
					{sprintf(

						// translators: %s is the decoded page URL.
						__( '%s is tagged with one parameter, so its values show straight away', 'burst-statistics' ),
						safeDecodeURI( pageUrl )
					)}
				</div>
			)}

			{isLoading && <ExpandableRowSkeleton />}

			{ ! isLoading && error && (
				<div className="rounded-md border border-red-200 bg-red-50 p-4 text-xs text-red-600">
					{__( 'Could not load parameter values.', 'burst-statistics' )}
				</div>
			)}

			{ ! isLoading && ! error && 0 === sortedRows.length && (
				<div className="flex flex-col gap-3.5 rounded-md border border-gray-200 bg-white p-6 shadow-2xs">
					{searchQuery ? (
						<>
							<div className="text-sm font-semibold text-text-black">
								{sprintf(

									// translators: %s is the search query.
									__( 'No value matches "%s"', 'burst-statistics' ),
									searchQuery
								)}
							</div>
							<div>
								<button
									type="button"
									onClick={handleClearSearch}
									className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-text-black shadow-2xs hover:bg-gray-50 cursor-pointer"
								>
									{__( 'Clear search', 'burst-statistics' )}
								</button>
							</div>
						</>
					) : (
						<div className="text-xs text-text-gray">
							{__( 'No values recorded for this parameter.', 'burst-statistics' )}
						</div>
					)}
				</div>
			)}

			{ ! isLoading && ! error && 0 < sortedRows.length && (
				<div className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-xs">
					<div className="overflow-x-auto">
						<table className="w-full border-collapse text-left text-xs">
							<thead>
								<tr className="border-b border-gray-200 bg-gray-50 text-text-gray font-medium">
									<ParameterSortHeader
										field="value"
										label={__( 'Value', 'burst-statistics' )}
										activeSortField={sortField}
										sortDirection={sortDirection}
										onSort={handleSort}
										align="left"
									/>
									<ParameterMetricsHeaders
										activeSortField={sortField}
										sortDirection={sortDirection}
										onSort={handleSort}
										shareLabel={sprintf(

											// translators: %s is the active parameter key.
											__( 'Share of %s', 'burst-statistics' ),
											activeKey.toUpperCase()
										)}
									/>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100">
								{

									// fallow-ignore-next-line complexity
									sortedRows.map( ( row ) => {
										const isGroup = Boolean( row.group );
										const isExpanded = Boolean( expandedGroups[row.value]);
										const views = Number( row.pageviews ) || 0;
										const visitors = Number( row.visitors ) || 0;
										const share = 0 < keyViews ? ( views / keyViews ) * 100 : 0;
										const val = String( row.value ?? '' );
										const isValTrimmed = 50 < val.length;
										const displayVal = isValTrimmed ? `${ val.slice( 0, 50 ) }...` : val;

										return (
											<React.Fragment key={`burst-val-${activeKey}-${row.value}`}>
												<tr
													onClick={() => {
														if ( isGroup ) {
															toggleGroup( row.value );
														}
													}}
													className={`group transition-colors hover:bg-gray-50 ${isGroup ? 'cursor-pointer' : ''}`}
												>
													<td className="relative py-2.5 pl-4 pr-3">
														{/* Green left accent on hover */}
														{isGroup && (
															<div className="absolute left-0 top-0 bottom-0 w-0.5 bg-green opacity-0 group-hover:opacity-100 transition-opacity" />
														)}

														<div className="flex items-center gap-2">
															{isGroup ? (
																<button
																	type="button"
																	onClick={( event ) => {
																		event.stopPropagation();
																		toggleGroup( row.value );
																	}}
																	className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 hover:text-text-black cursor-pointer"
																	aria-label={__( 'Toggle versions roll-up', 'burst-statistics' )}
																>
																	<Icon
																		name={isExpanded ? 'chevron-down' : 'chevron-right'}
																		size={13}
																		color="gray"
																	/>
																</button>
															) : null}

															<div className="min-w-0">
																<div className="flex flex-wrap items-center gap-2">
																	<Tooltip content={isValTrimmed ? <span className="break-all text-xs">{val}</span> : undefined}>
																		<span className="font-semibold text-sm text-text-black">
																			{displayVal}
																		</span>
																	</Tooltip>
																	{isGroup && (
																		<span className="rounded-full bg-gray-100 px-2 py-0.5 text-xxs font-medium text-text-gray">
																			{sprintf(

																				// translators: %d is the count of rolled-up versions.
																				__( '%d versions rolled up', 'burst-statistics' ),
																				row.member_count ?? 0
																			)}
																		</span>
																	)}
																</div>
																{isGroup && row.min_version && row.max_version && (
																	<div className="truncate text-xxs text-text-gray-light mt-0.5">
																		{sprintf(

																			// translators: %1$s is min version, %2$s is max version, %3$s is newest version, %4$s is views of newest version.
																			__( '%1$s -> %2$s · newest %3$s, %4$s views', 'burst-statistics' ),
																			row.min_version,
																			row.max_version,
																			row.newest_value ?? '',
																			formatNumber( row.newest_views ?? 0, 0, false )
																		)}
																	</div>
																)}
															</div>

															{/* Action buttons on row hover - right beside value */}
															{ ! isGroup && (
																<ParameterRowActions
																	paramKey={activeKey}
																	paramValue={row.value}
																	pageUrl={pageUrl}
																	onFilter={onFilter}
																	onExclude={onExclude}
																/>
															)}
														</div>
													</td>
													<ParameterMetricsCells
														views={views}
														visitors={visitors}
														share={share}
													/>
												</tr>

												{/* Expanded group members */}
												{isGroup && isExpanded && row.members && (

													// fallow-ignore-next-line complexity
													row.members.map( ( member ) => {
														const memViews = Number( member.pageviews ) || 0;
														const memVisitors = Number( member.visitors ) || 0;
														const memShare = 0 < keyViews ? ( memViews / keyViews ) * 100 : 0;
														const memVal = String( member.value ?? '' );
														const isMemTrimmed = 50 < memVal.length;
														const displayMemVal = isMemTrimmed ? `${ memVal.slice( 0, 50 ) }...` : memVal;

														return (
															<tr
																key={`burst-val-${activeKey}-${member.value}`}
																className="group/member bg-gray-50/60 transition-colors hover:bg-gray-100/70"
															>
																<td className="relative py-2 pl-9 pr-3">
																	<div className="flex items-center gap-2 border-l-2 border-gray-200 pl-3">
																		<Tooltip content={isMemTrimmed ? <span className="break-all text-xs">{memVal}</span> : undefined}>
																			<span className="font-mono text-xs text-text-black">
																				{displayMemVal}
																			</span>
																		</Tooltip>
																		<ParameterRowActions
																			paramKey={activeKey}
																			paramValue={member.value}
																			pageUrl={pageUrl}
																			onFilter={onFilter}
																			onExclude={onExclude}
																			className="group-hover/member:opacity-100"
																		/>
																	</div>
																</td>
																<ParameterMetricsCells
																	views={memViews}
																	visitors={memVisitors}
																	share={memShare}
																/>
															</tr>
														);
													})
												)}
											</React.Fragment>
										);
									})
								}
							</tbody>
						</table>
					</div>

					<div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2 text-xxs text-text-gray">
						<div>
							{hasMore && serverSearch ?
								sprintf(

									// translators: %d is the count of shown matching values.
									__( 'Showing the top %d matching values', 'burst-statistics' ),
									shownValueCount
								) :
								hasMore ?
									sprintf(

										// translators: %1$d is the count of shown values, %2$d is the total distinct values count.
										__( 'Showing the top %1$d of %2$d values', 'burst-statistics' ),
										shownValueCount,
										totalValues
									) :
									searchQuery ?
									__( 'Closing the search lets the panel settle back', 'burst-statistics' ) :
									sprintf(

										// translators: %d is the count of shown rows.
										__( 'All %d rows shown', 'burst-statistics' ),
										sortedRows.length
									)}
						</div>
						{0 < rolledUpCount && (
							<div className="text-text-gray-light">
								{sprintf(

									// translators: %d is the number of versions rolled up.
									__( '%d versions are rolled into the first row', 'burst-statistics' ),
									rolledUpCount
								)}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

export default memo( ParameterLevelTwoPane );
