import { createFileRoute, Outlet } from '@tanstack/react-router';
import { SubNavigation } from '@/components/Common/SubNavigation';

export const Route = createFileRoute( '/reporting' )({
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
