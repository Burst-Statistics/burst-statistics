import { createFileRoute } from '@tanstack/react-router';
import { notFound } from '@tanstack/react-router';
import { __ } from '@wordpress/i18n';
import Reporting from '@/components/Reporting/Reporting';

const ReportingLoader = ( reportingId ) => {
	const itemId = reportingId || 'reports';

	const menu = burst_settings.menu;
	const subMenu = menu.find( ( item ) => 'reporting' === item.id );

	if ( ! subMenu ) {
		throw notFound({
			message: __( 'Reporting section not found', 'burst-statistics' )
		});
	}

	const currentItem = subMenu.menu_items.find( ( item ) => item.id === itemId );

	if ( ! currentItem ) {
		throw notFound({
			message: __( 'Reporting page not found', 'burst-statistics' )
		});
	}

	return { currentItem };
};

// Create the Settings component
function ReportingRoute() {
	const { currentItem } = Route.useLoaderData();
	return (
		<>
			<div className="col-span-12 lg:col-span-9 flex flex-col">
				<Reporting currentSettingPage={currentItem} />
			</div>
		</>
	);
}

// Export the Route object directly
export const Route = createFileRoute( '/reporting/$reportingId' )({
	component: ReportingRoute,
	loader: ({ params }) => ReportingLoader( params.reportingId ),
	errorComponent: ({ error }) => (
		<div className="p-4 text-red-500">
			{error.message ||
				__( 'An error occurred loading reports', 'burst-statistics' )}
		</div>
	)
});
