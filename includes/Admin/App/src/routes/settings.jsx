import { createFileRoute, notFound, Outlet, redirect } from '@tanstack/react-router';
import { SubNavigation } from '@/components/Common/SubNavigation';
import { shouldLoadRoute, shouldRedirectToFirstMenuItem } from '@/utils/helper';
import NotFoundModal from '@/components/Common/NotFoundModal';

export const Route = createFileRoute( '/settings' )({
	beforeLoad: ({ routeId, context, params }) => {
		const { settingsId } = params;

		// Already in sub route.
		if ( settingsId !== undefined ) {
			return;
		}

		if ( ! context?.menus ) {
			return;
		}

		const result = shouldRedirectToFirstMenuItem( 'settings', context.menus );

		if ( false === result ) {
			return;
		}

		const firstItem = result.menu_items[0];

		throw redirect({
			to: routeId + '/$settingsId',
			params: {
				settingsId: firstItem.id
			},

			// Replace it so that clicking back doesn’t take you to /settings again, where beforeLoad would redirect you to the first sub-route.
			replace: true
		});
	},

	// Throwing notFound in beforeLoad does not render header.
	loader: ({ context }) => {
		if ( context?.menus && ! shouldLoadRoute( 'settings', context.menus ) ) {
			throw notFound();
		}
	},
	notFoundComponent: NotFoundModal,
	component: RouteComponent
});

function RouteComponent() {
	const menu = burst_settings.menu;

	// Get submenu where id is 'settings'
	const subMenu = menu.filter( ( item ) => 'settings' === item.id )[0];

	return (
		<>
			<div className="col-span-12 lg:col-span-3">
				<SubNavigation subMenu={ subMenu } from='/settings/' to='$settingsId/' paramKey='settingsId' />
			</div>

			<Outlet />
		</>
	);
}
