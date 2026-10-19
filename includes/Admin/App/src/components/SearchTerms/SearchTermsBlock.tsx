import { memo, useMemo, useState } from 'react';
import { __ } from '@wordpress/i18n';
import * as Checkbox from '@radix-ui/react-checkbox';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import ExpandableBlockTitle from '@/components/Blocks/ExpandableBlockTitle';
import Icon from '@/utils/Icon';
import { BarDataTable } from '@/components/DataTable/BarDataTable';
import { useExpandableTopBlock } from '@/hooks/useExpandableTopBlock';
import { useSearchTermsData } from './useSearchTermsData';
import { getSearchTermsColumns } from './columns';
import useColumnsBySiteUrl from '@/hooks/useColumnsBySiteUrl';
import SmartMatchSummary from './SmartMatchSummary';
import { isSmartMatchActive } from './isSmartMatchActive';

type SearchTermsBlockProps = {

	/** Additional CSS class names passed to the wrapping Block. */
	className?: string;
};

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

	const columns = useColumnsBySiteUrl( getSearchTermsColumns );

	const filteredData = useMemo( () => {
		const safeData = Array.isArray( data ) ? data : [];
		return noResultsOnly ? safeData.filter( ( r ) => 0 === r.results ) : safeData;
	}, [ data, noResultsOnly ]);
	const { topData, hasData, handleExpand } = useExpandableTopBlock({
		data: filteredData,
		variant: 'search_terms',
		dataTableId: 'search-terms'
	});

	return (
		<Block className={className}>
			<BlockHeading
				className="border-b border-gray-200"
				isLoading={isLoading}
				title={
					<ExpandableBlockTitle
						metricKey="search_terms"
						label={__( 'Website searches', 'burst-statistics' )}
						hasData={hasData}
						onExpand={handleExpand}
					/>
				}
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
							{__( 'Without results', 'burst-statistics' )}
						</label>
					</div>
				}
			/>
			<BlockContent className="px-0 py-0 overflow-y-auto">
				<BarDataTable
					columns={columns}
					data={topData}
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
			{isSmartMatchActive() && <SmartMatchSummary rows={Array.isArray( data ) ? data : []} />}
		</Block>
	);
});

SearchTermsBlock.displayName = 'SearchTermsBlock';

export default SearchTermsBlock;
