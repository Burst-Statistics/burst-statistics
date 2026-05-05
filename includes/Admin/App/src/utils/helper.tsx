import { BurstMenuPage } from '@/index';

export const shouldLoadRoute = (
	route: string,
	menus: BurstMenuPage[]
): boolean => {

	// Root always loads
	if ( '' === route || '/' === route ) {
		return true;
	}

	const shouldLoad = menus.find( ( menu ) => menu.id === route );

	return Boolean( shouldLoad );
};

export const shouldRedirectToFirstMenuItem = ( route: string, menus: BurstMenuPage[]) => {
	const selectedMenu = menus.find(
		( menu ) => menu.id === route
	);

	if ( ! selectedMenu?.menu_items?.length || 0 >= selectedMenu.menu_items.length ) {
		return false;
	}

	return selectedMenu;
};
