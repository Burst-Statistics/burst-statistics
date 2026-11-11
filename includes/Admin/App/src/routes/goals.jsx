import { createFileRoute, notFound } from '@tanstack/react-router';
import { shouldLoadRoute } from '@/utils/helper';
import NotFoundModal from '@/components/Common/NotFoundModal';
import GoalsLayout from '@/components/Goals/Dashboard/GoalsLayout';

export const Route = createFileRoute( '/goals' )({

	// Throwing notFound in beforeLoad does not render header.
	loader: ({ context }) => {
		if ( context?.menus && ! shouldLoadRoute( 'goals', context.menus ) ) {
			throw notFound();
		}
	},
	notFoundComponent: NotFoundModal,
	component: GoalsLayout
});
