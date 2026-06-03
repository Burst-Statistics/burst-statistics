import { createFileRoute, notFound } from '@tanstack/react-router';
import { PageHeader } from '@/components/Common/PageHeader';
import { __ } from '@wordpress/i18n';

import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { shouldLoadRoute } from '@/utils/helper';
import { OutgoingLinksBlock } from '@/components/OutgoingLinks';


export const Route = createFileRoute( '/engagement' )({

	// Throwing notFound in beforeLoad does not render header.
	loader: ({ context }) => {
		if ( context?.menus && ! shouldLoadRoute( 'engagement', context.menus ) ) {
			throw notFound();
		}
	},
	component: Engagement
});

function Engagement() {
	return (
		<>
			<PageHeader />
			<OutgoingLinksBlock className="row-span-1 lg:col-span-6 xl:col-span-3" />

			<Block className="row-span-1 lg:col-span-6 xl:col-span-3">
				<BlockHeading title={__( 'Reading engagement', 'burst-statistics' )} />
				<BlockContent className="flex items-center justify-center h-48 text-gray-400 text-sm font-medium italic">
					{__( 'Coming soon', 'burst-statistics' )}
				</BlockContent>
			</Block>

			<Block className="row-span-1 lg:col-span-6 xl:col-span-3">
				<BlockHeading title={__( 'Forms', 'burst-statistics' )} />
				<BlockContent className="flex items-center justify-center h-48 text-gray-400 text-sm font-medium italic">
					{__( 'Coming soon', 'burst-statistics' )}
				</BlockContent>
			</Block>

			<Block className="row-span-1 lg:col-span-6 xl:col-span-3">
				<BlockHeading title={__( 'Internal links', 'burst-statistics' )} />
				<BlockContent className="flex items-center justify-center h-48 text-gray-400 text-sm font-medium italic">
					{__( 'Coming soon', 'burst-statistics' )}
				</BlockContent>
			</Block>

			{ /* Temporary placeholder — swap back to <SearchTermsBlock /> next release. */ }
			<Block className="row-span-1 lg:col-span-6 xl:col-span-3">
				<BlockHeading title={__( 'Search terms', 'burst-statistics' )} />
				<BlockContent className="flex items-center justify-center h-48 text-gray-400 text-sm font-medium italic">
					{__( 'Coming soon', 'burst-statistics' )}
				</BlockContent>
			</Block>

			<Block className="row-span-1 lg:col-span-6 xl:col-span-3">
				<BlockHeading title={__( 'Goals', 'burst-statistics' )} />
				<BlockContent className="flex items-center justify-center h-48 text-gray-400 text-sm font-medium italic">
					{__( 'Coming soon', 'burst-statistics' )}
				</BlockContent>
			</Block>
		</>
	);
}
