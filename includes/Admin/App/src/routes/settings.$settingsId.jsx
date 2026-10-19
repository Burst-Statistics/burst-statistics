import { createFileRoute, redirect } from '@tanstack/react-router';
import Settings from '@/components/Settings/Settings';
import SettingsNotices from '@/components/Settings/SettingsNotices';
import { notFound } from '@tanstack/react-router';
import { __ } from '@wordpress/i18n';

const SettingsLoader = ( settingsId ) => {
	const itemId = settingsId || 'general';
	const menu = burst_settings.menu;
	const subMenu = menu.find( ( item ) => 'settings' === item.id );

	if ( ! subMenu ) {
		throw notFound({
			message: __( 'Settings section not found', 'burst-statistics' )
		});
	}

	const currentItem = subMenu.menu_items.find( ( item ) => item.id === itemId );

	if ( ! currentItem ) {
		throw notFound({
			message: __( 'Settings page not found', 'burst-statistics' )
		});
	}

	return { currentItem };
};

// Create the Settings component
function SettingsRoute() {
	const { currentItem } = Route.useLoaderData();
	return (
		<>
			<div className="col-span-12 @lg:col-span-6 flex flex-col">
				<Settings currentSettingPage={currentItem} />
			</div>
			<div className="col-span-12 @lg:col-span-3">
				<SettingsNotices settingsGroup={currentItem} />
			</div>
		</>
	);
}

// Export the Route object directly
export const Route = createFileRoute( '/settings/$settingsId' )({

	// Goals moved out of settings to their own page; keep old links working.
	beforeLoad: ({ params }) => {
		if ( 'goals' === params.settingsId ) {
			throw redirect({ to: '/goals', replace: true });
		}
	},
	component: SettingsRoute,
	loader: ({ params }) => SettingsLoader( params.settingsId ),
	errorComponent: ({ error }) => (
		<div className="p-4 text-red-500">
			{error.message ||
				__( 'An error occurred loading settings', 'burst-statistics' )}
		</div>
	)
});
