import { createFileRoute, Outlet } from '@tanstack/react-router';
import { SubNavigation } from '@/components/Common/SubNavigation';

export const Route = createFileRoute( '/settings' )({
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
