import { createFileRoute, notFound, Outlet, redirect } from '@tanstack/react-router';
import { SubNavigation } from '@/components/Common/SubNavigation';
import { shouldLoadRoute, shouldRedirectToFirstMenuItem } from '@/utils/helper';
import NotFoundModal from '@/components/Common/NotFoundModal';

export const Route = createFileRoute( '/reporting' )({
	beforeLoad: ({ routeId, context, params }) => {
		const { reportingId } = params;

		// Already in sub route.
		if ( undefined !== reportingId ) {
			return;
		}

		if ( ! context?.menus ) {
			return;
		}

		const result = shouldRedirectToFirstMenuItem( 'reporting', context.menus );

		if ( false === result ) {
			return;
		}

		const firstItem = result.menu_items[0];

		throw redirect({
			to: routeId + '/$reportingId',
			params: {
				reportingId: firstItem.id
			},

			// Replace it so that clicking back doesn’t take you to /reporting again, where beforeLoad would redirect you to the first sub-route.
			replace: true
		});
	},

	// Throwing notFound in beforeLoad does not render header.
	loader: ({ context }) => {
		if ( context?.menus && ! shouldLoadRoute( 'reporting', context.menus ) ) {
			throw notFound();
		}
	},
	notFoundComponent: NotFoundModal,
	component: ReportingComponent
});

function ReportingComponent() {
	const menu = burst_settings.menu;

	// Get submenu where id is 'settings'
	const subMenu = menu.filter( ( item ) => 'reporting' === item.id )[0];

	return (
		<>
			<div className="col-span-12 lg:col-span-3">
				<SubNavigation subMenu={ subMenu } from='/reporting/' to='$reportingId' paramKey='reportingId' />
			</div>

			<Outlet />
		</>
	);
}
