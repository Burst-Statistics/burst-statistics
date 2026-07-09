import { memo, useMemo, useState } from 'react';
import { __ } from '@wordpress/i18n';
import * as Checkbox from '@radix-ui/react-checkbox';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import Icon from '@/utils/Icon';
import { BarDataTable } from '@/components/DataTable/BarDataTable';
import { useSearchTermsData } from './useSearchTermsData';
import { getSearchTermsColumns } from './columns';
import MetricInfo from '@/components/Common/MetricInfo';

type SearchTermsBlockProps = {

	/** Additional CSS class names passed to the wrapping Block. */
	className?: string;
};

/** Maximum rows shown in the compact block view. */
const TOP_N = 5;

/**
 * Compact dashboard block showing the top site-search terms.
 *
 * Features an embedded volume bar, a clickable results column, a toggle to
 * filter for zero-result queries, and an expand button that opens the full
 * table in the DataTableOverlay.
 *
 * @param {Object} props           - Component props.
 * @param {string} props.className - Additional CSS classes for the Block wrapper.
 * @return {JSX.Element} The search terms block.
 */
const SearchTermsBlock = memo( ({ className = '' }: SearchTermsBlockProps ) => {
	const { data, isLoading } = useSearchTermsData();
	const [ noResultsOnly, setNoResultsOnly ] = useState( false );

	const navigate = useNavigate();
	const location = useRouterState({ select: ( s ) => s.location });

	const siteUrl =
		( window as unknown as { burst_settings?: { site_url?: string } })
			?.burst_settings?.site_url ?? window.location.origin;

	const columns = useMemo(
		() => getSearchTermsColumns({ siteUrl }),
		[ siteUrl ]
	);

	const filteredData = useMemo( () => {
		const base = noResultsOnly ? data.filter( ( r ) => 0 === r.results ) : data;
		return base.slice( 0, TOP_N );
	}, [ data, noResultsOnly ]);

	/**
	 * Navigate to the fullscreen overlay with the search_terms variant active.
	 */
	const handleExpand = () => {
		navigate({
			to: '/table/$variant',
			params: { variant: 'search_terms' },
			search: {
				from: location.pathname,
				allowed: 'search_terms',
				dataTableId: 'search-terms',
				...location.search
			}
		});
	};

	return (
		<Block className={className}>
			<BlockHeading
				className="border-b border-gray-200"
				isLoading={isLoading}
				title={<>
					<MetricInfo metricKey="search_terms" side="bottom">
						{__( 'Website searches', 'burst-statistics' )}
					</MetricInfo>
					{/* Expand to overlay. */}
					<button
						type="button"
						className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
						onClick={handleExpand}
						aria-label={__( 'Expand table', 'burst-statistics' )}
						title={__( 'Expand table', 'burst-statistics' )}
					>
						<Icon name="expand" size={14} />
					</button></>}
				controls={
					<div className="flex items-center gap-2">
						{/* No-results toggle. */}
						<label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-gray select-none">
							<Checkbox.Root
								className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-gray-300 bg-white transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
								id="search-terms-no-results"
								checked={noResultsOnly}
								aria-label={__( 'Show only searches with no results', 'burst-statistics' )}
								onCheckedChange={( checked ) => setNoResultsOnly( true === checked )}
							>
								<Checkbox.Indicator>
									<Icon name="check" size={11} color="green" strokeWidth={2.5} />
								</Checkbox.Indicator>
							</Checkbox.Root>
							{__( 'No results only', 'burst-statistics' )}
						</label>
					</div>
				}
			/>
			<BlockContent className="px-0 py-0 overflow-y-auto">
				<BarDataTable
					columns={columns}
					data={filteredData}
					rowKey={( row ) => row.term as string}
					barColumnKey="volume"
					isLoading={isLoading}
					emptyState={
						noResultsOnly ?
							__( 'No zero-result searches found.', 'burst-statistics' ) :
							__( 'No search terms recorded yet.', 'burst-statistics' )
					}
				/>
			</BlockContent>
		</Block>
	);
});

SearchTermsBlock.displayName = 'SearchTermsBlock';

export default SearchTermsBlock;
