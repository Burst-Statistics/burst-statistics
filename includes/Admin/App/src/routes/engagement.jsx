import { createFileRoute, notFound } from '@tanstack/react-router';
import { PageHeader } from '@/components/Common/PageHeader';
import { shouldLoadRoute } from '@/utils/helper';
import { SearchTermsBlock } from '@/components/SearchTerms';
import NotFoundPagesBlock from '@/components/NotFoundPages/NotFoundPagesBlock';
import { OutgoingLinksBlock } from '@/components/OutgoingLinks';
import { FormsBlock } from '@/components/Forms';
import { ReadingEngagementBlock } from '@/components/ReadingEngagement';
import { InternalLinksBlock } from '@/components/InternalLinks';

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
			<OutgoingLinksBlock className="row-span-1 @lg:col-span-6 @xl:col-span-4" />

			<ReadingEngagementBlock className="row-span-1 @lg:col-span-6 @xl:col-span-4" />

			<FormsBlock className="row-span-1 @lg:col-span-6 @xl:col-span-4" />

			<InternalLinksBlock className="row-span-1 @lg:col-span-6 @xl:col-span-4" />

			<SearchTermsBlock className="row-span-1 @lg:col-span-6 @xl:col-span-4" />

			<NotFoundPagesBlock className="row-span-1 @lg:col-span-6 @xl:col-span-4" />
		</>
	);
}
