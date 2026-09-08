import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import useGSCData from '@/hooks/useGSCData';
import useSettingsData from '@/hooks/useSettingsData';
import { useSearchQueriesData } from '@/hooks/useSearchQueriesData';
import { Block } from '@/components/Blocks/Block';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockFooter } from '@/components/Blocks/BlockFooter';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { GoogleSearchConsoleIcon } from '@/components/Common/GoogleSearchConsoleIcon';
import type { SearchQueryRow } from '@/api/getSearchQueriesData';
import { SearchQueriesInsight } from './SearchQueriesInsight';
import { SearchQueriesContent } from './SearchQueriesContent';
import { SearchQueriesOverlay, SearchQueriesPropertyState } from './SearchQueriesAccessStates';
import {
	getSearchQueriesAccessState,
	getSearchQueriesViewModel,
	isBurstPro
} from './searchQueriesViewModel';
import type { SearchQueriesAccessState, SearchQueriesStatus } from './searchQueriesViewModel';

const blockClassName = '@lg:col-span-6 @xl:col-span-6';

interface SearchQueriesBlockProps {
	id?: string;
	pageUrl?: string;
}

interface SearchQueriesAccessProps extends SearchQueriesBlockProps {
	accessState: SearchQueriesAccessState;
	isEnabled: boolean;
	propertyStatus: string | null;
}

/**
 * Heading metadata for the latest completed Search Console date.
 */
const getSearchQueriesHeadingControls = (
	dataUntil: string
): ReactNode | undefined => {
	if ( ! dataUntil ) {
		return undefined;
	}

	return (
		<div className="flex items-center gap-2 whitespace-nowrap text-xs text-text-gray-light">
			<GoogleSearchConsoleIcon size={ 18 } />
			<span>
				{ sprintf(

					/* translators: %s: latest available Search Console date. */
					__( 'Search Console · until %s', 'burst-statistics' ),
					dataUntil
				) }
			</span>
		</div>
	);
};

/**
 * Ready-state insight footer.
 */
const SearchQueriesFooter = ({
	isLoading,
	dataStatus,
	opportunity
}: {
	isLoading: boolean;
	dataStatus: SearchQueriesStatus;
	opportunity: SearchQueryRow | null;
}) => {
	if ( isLoading || 'ready' !== dataStatus || ! opportunity ) {
		return null;
	}

	return (
		<BlockFooter className="justify-start border-t border-gray-200 py-4">
			<SearchQueriesInsight opportunity={ opportunity } />
		</BlockFooter>
	);
};

/**
 * Connected Search Console block. This is the only gate that mounts the query
 * data hook.
 */
const ConnectedSearchQueriesBlock = ({
	id,
	pageUrl,
	propertyStatus
}: SearchQueriesBlockProps & { propertyStatus: string | null }) => {
	const { data, isLoading, isError } = useSearchQueriesData({ id, pageUrl });
	const viewModel = getSearchQueriesViewModel( data, isError );

	return (
		<Block className={ blockClassName }>
			<BlockHeading
				title={ __( 'Search queries', 'burst-statistics' ) }
				className="border-b border-gray-200"
				isLoading={ isLoading || viewModel.isInitialPending }
				controls={ getSearchQueriesHeadingControls( viewModel.dataUntil ) }
			/>
			<BlockContent className="pb-5 pt-4">
				<SearchQueriesContent
					data={ data }
					isLoading={ isLoading }
					isPropertyPaused={ 'paused' === propertyStatus }
					{ ...viewModel }
				/>
			</BlockContent>
			<SearchQueriesFooter
				isLoading={ isLoading }
				dataStatus={ viewModel.dataStatus }
				opportunity={ viewModel.opportunity }
			/>
		</Block>
	);
};

/**
 * Render the selected top-level access state.
 */
const SearchQueriesAccess = ({
	accessState,
	isEnabled,
	propertyStatus,
	id,
	pageUrl
}: SearchQueriesAccessProps ) => {
	if ( 'queries' === accessState ) {
		return <ConnectedSearchQueriesBlock id={ id } pageUrl={ pageUrl } propertyStatus={ propertyStatus } />;
	}
	if ( 'property' === accessState ) {
		return <SearchQueriesPropertyState propertyStatus={ propertyStatus } className={ blockClassName } />;
	}
	return <SearchQueriesOverlay isEnabled={ isEnabled } className={ blockClassName } />;
};

/**
 * Displays locally synced page-level Search Console query data behind the GSC
 * connection and Pro gates.
 *
 * @return Gated search query block.
 */
export const SearchQueriesBlock = ({
	id,
	pageUrl
}: SearchQueriesBlockProps ) => {
	const { status, propertyStatus } = useGSCData();
	const { getValue } = useSettingsData();
	const isEnabled = !! getValue( 'enable_search_console' );
	const accessState = getSearchQueriesAccessState(
		isBurstPro(),
		status,
		propertyStatus
	);

	return (
		<SearchQueriesAccess
			accessState={ accessState }
			isEnabled={ isEnabled }
			propertyStatus={ propertyStatus }
			id={ id }
			pageUrl={ pageUrl }
		/>
	);
};
