import React, { useState, useMemo, useCallback, memo } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import Tooltip from '@/components/Common/Tooltip';
import ParameterSummaryBanner from './ParameterSummaryBanner';
import ParameterMetricsCells from './ParameterMetricsCells';
import ParameterSearchInput from './ParameterSearchInput';
import ParameterSortHeader, {
	SortDirection,
	getNextSortDirection,
	sortSubTableRows
} from './ParameterSortHeader';
import ParameterMetricsHeaders from './ParameterMetricsHeaders';

interface ParameterKeyRow {
	parameter: string;
	pageviews: number;
	visitors: number;
	value_count: number;
	high_cardinality?: boolean;
}

interface ParameterLevelOnePaneProps {

	/** List of parameter keys aggregated for this page. */
	rows: ParameterKeyRow[];

	/** Page URL being viewed. */
	pageUrl: string;

	/** Total pageviews recorded for this page URL. */
	totalPageviews: number;

	/** Number of pageviews that arrived with parameters. */
	taggedPageviews: number;

	/** Number of pageviews that arrived with no parameters. */
	untaggedPageviews: number;

	/** Number of visitors that arrived with no parameters. */
	untaggedVisitors: number;

	/** Callback when user drills down into a specific parameter key. */
	onSelectKey: ( key: string ) => void;

	/** Optional additional CSS classes. */
	className?: string;
}

type SortField = 'parameter' | 'pageviews' | 'visitors';

/**
 * Level 1 overview pane: displays parameter keys summary and tagged/untagged split.
 *
 * @param {ParameterLevelOnePaneProps} props Component props.
 * @return {JSX.Element} Level 1 table and summary.
 */
// fallow-ignore-next-line complexity
const ParameterLevelOnePane: React.FC<ParameterLevelOnePaneProps> = ({
	rows,
	pageUrl,
	totalPageviews,
	taggedPageviews,
	untaggedPageviews,
	untaggedVisitors,
	onSelectKey,
	className = ''
}) => {
	const [ searchQuery, setSearchQuery ] = useState<string>( '' );
	const [ sortField, setSortField ] = useState<SortField>( 'pageviews' );
	const [ sortDirection, setSortDirection ] = useState<SortDirection>( 'desc' );

	const topKey = 0 < rows.length ? rows[0].parameter : '';

	const handleSort = useCallback(
		( field: string ) => {
			setSortDirection( ( prevDir ) =>
				getNextSortDirection( sortField, prevDir, field, 'parameter' )
			);
			setSortField( field as SortField );
		},
		[ sortField ]
	);

	const filteredRows = useMemo( () => {
		const q = searchQuery.trim().toLowerCase();
		if ( ! q ) {
			return rows;
		}
		return rows.filter( ( row ) => {
			const key = ( row.parameter || '' ).toLowerCase();
			return key.includes( q );
		});
	}, [ rows, searchQuery ]);

	const sortedRows = useMemo(
		() => sortSubTableRows( filteredRows, sortField, sortDirection, 'parameter' ),
		[ filteredRows, sortField, sortDirection ]
	);

	return (
		<div className={`flex flex-col gap-4 ${className}`}>
			<div className="flex items-start justify-between gap-4 mb-2">
				<ParameterSummaryBanner
					pageUrl={pageUrl}
					totalPageviews={totalPageviews}
					taggedPageviews={taggedPageviews}
					untaggedPageviews={untaggedPageviews}
				/>

				<ParameterSearchInput
					value={searchQuery}
					onChange={setSearchQuery}
					placeholder={__( 'Search parameters...', 'burst-statistics' )}
				/>
			</div>

			<div className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-xs">
				<div className="overflow-x-auto">
					<table className="w-full border-collapse text-left text-xs">
						<thead>
							<tr className="border-b border-gray-200 bg-gray-50 text-text-gray font-semibold text-xxs">
								<ParameterSortHeader
									field="parameter"
									label={__( 'Parameter', 'burst-statistics' )}
									activeSortField={sortField}
									sortDirection={sortDirection}
									onSort={handleSort}
									align="left"
								/>
								<ParameterMetricsHeaders
									activeSortField={sortField}
									sortDirection={sortDirection}
									onSort={handleSort}
								/>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100">
							{

								// fallow-ignore-next-line complexity
								sortedRows.map( ( row ) => {
									const keyName = row.parameter || __( 'flags without a value', 'burst-statistics' );
									const isFlags = ! row.parameter;
									const views = Number( row.pageviews ) || 0;
									const visitors = Number( row.visitors ) || 0;
									const share = 0 < totalPageviews ? ( views / totalPageviews ) * 100 : 0;
									const isKeyTrimmed = 50 < keyName.length;
									const displayKeyName = isKeyTrimmed ? `${ keyName.slice( 0, 50 ) }...` : keyName;

									return (
										<tr
											key={`burst-param-key-${row.parameter || 'empty'}`}
											onClick={isFlags ? undefined : () => onSelectKey( row.parameter )}
											className={isFlags ? 'bg-white' : 'group cursor-pointer transition-colors hover:bg-gray-50'}
										>
											<td className="py-2.5 pl-4 pr-3">
												<div className="flex items-center gap-2">
													<span
														className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 group-hover:text-text-black"
														aria-hidden="true"
													>
														{ ! isFlags && <Icon name="chevron-right" size={13} color="gray" />}
													</span>
													<div className="min-w-0 flex-1">
														<div className="flex flex-wrap items-center gap-2">
															<Tooltip content={isKeyTrimmed ? <span className="break-all text-xs">{keyName}</span> : undefined}>
																<span className="font-semibold text-sm text-text-black">
																	{displayKeyName}
																</span>
															</Tooltip>
															<span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-text-gray">
																{isFlags ?
																	sprintf(

																		// translators: %d is the count of distinct parameter keys.
																		__( '%d keys', 'burst-statistics' ),
																		row.value_count
																	) :
																	sprintf(

																		// translators: %d is the count of distinct values for this parameter.
																		__( '%d values', 'burst-statistics' ),
																		row.value_count
																	)}
															</span>
															{row.high_cardinality && (
																<span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
																	{__( 'high cardinality', 'burst-statistics' )}
																</span>
															)}
														</div>
													</div>
												</div>
											</td>
											<ParameterMetricsCells
												views={views}
												visitors={visitors}
												share={share}
											/>
										</tr>
									);
								})
							}

							{/* Untagged remainder row. */}
							<tr className="bg-white">
								<td className="py-2.5 pl-11 pr-3">
									<span className="font-normal text-sm text-text-gray">
										{__( 'No parameter', 'burst-statistics' )}
									</span>
								</td>
								<ParameterMetricsCells
									views={untaggedPageviews}
									visitors={untaggedVisitors}
									share={0 < totalPageviews ? ( untaggedPageviews / totalPageviews ) * 100 : 0}
								/>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			{/* Sub-table footer outside the table container */}
			<div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-text-gray">
				<div>
					{__(
						'A view can carry several parameters, so shares overlap and do not add up to 100%.',
						'burst-statistics'
					)}
				</div>
				{topKey && (
					<button
						type="button"
						onClick={() => onSelectKey( topKey )}
						className="font-medium text-green hover:underline focus:outline-hidden cursor-pointer"
					>
						{sprintf(

							// translators: %s is the top parameter key name.
							__( 'Open %s >', 'burst-statistics' ),
							topKey
						)}
					</button>
				)}
			</div>
		</div>
	);
};

export default memo( ParameterLevelOnePane );
