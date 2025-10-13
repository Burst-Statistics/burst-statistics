import {createFileRoute, Outlet} from '@tanstack/react-router';
import SettingsNavigation from '@/components/Settings/SettingsNavigation';

export const Route = createFileRoute( '/settings' )({
  component: RouteComponent
});

function RouteComponent() {
  const menu = burst_settings.menu;

  // get submenu where id is 'settings'
  const subMenu = menu.filter( ( item ) => 'settings' === item.id )[0];

  return (
      <>
        <div className="col-span-12 lg:col-span-3">
          <SettingsNavigation subMenu={subMenu}/>
        </div>
        <Outlet/>
      </>
  );
}
