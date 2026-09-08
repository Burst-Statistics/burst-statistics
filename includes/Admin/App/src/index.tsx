import { Suspense, StrictMode } from 'react';
import { createRoot, render } from '@wordpress/element';
import {
	QueryClient,
	QueryCache,
	QueryClientProvider
} from '@tanstack/react-query';

import {
	RouterProvider,
	createRouter,
	createBrowserHistory,
	createHashHistory,
	type AnyRoute
} from '@tanstack/react-router';

import { ThemeProvider } from './hooks/useTheme';
import { shouldLoadRoute } from './utils/helper';
import { startScrollLockWatchdog } from './utils/scrollLockWatchdog';

// Import the generated route tree
import { routeTree } from './routeTree.gen';

export type {
	BurstMenuPro,
	BurstMenuGroup,
	BurstMenuItem,
	BurstMenuPage,
	BurstMenuConfig,
	BurstSettings
} from './types/burst-settings';

declare global {
	interface Window {
		burstLoaded?: boolean;
	}
}

// This bundle is mounted in wp-admin and on shared dashboard URLs. wp-admin
// still needs hash routing, while /burst-dashboard/<tab>/ should behave like a
// normal path-based app.
const isSharedDashboardRoute = /\/burst-dashboard(\/|$)/.test( window.location.pathname );
const routerHistory = isSharedDashboardRoute ? createBrowserHistory() : createHashHistory();
const HOUR_IN_SECONDS = 3600;

interface QueryConfig {
	defaultOptions: {
		queries: {
			staleTime: number;
			refetchOnWindowFocus: boolean;
			retry: boolean;
			suspense: boolean;
		};
	};
	queryCache?: QueryCache;
}

const queryCache = new QueryCache();

let config: QueryConfig = {
	defaultOptions: {
		queries: {
			staleTime: HOUR_IN_SECONDS * 1000, // hour in ms
			refetchOnWindowFocus: false,
			retry: false,
			suspense: false // Disable Suspense for React Query, as it leads to loading the proper layout earlier.
		}
	}
};

// merge queryCache with config
config = { ...config, ...{ queryCache } };

const queryClient = new QueryClient( config );
const isPro = window.burst_settings?.is_pro;
const canViewSales = window.burst_settings?.view_sales_burst_statistics;
const menus = window.burst_settings?.menu;

const normalizedMenus = Array.isArray( menus ) ?
	menus :
	Object.values( menus ?? {});

if ( window.burst_settings ) {

	// Normalize menu here itself.
	window.burst_settings.menu = normalizedMenus;
}

// Create the router with improved loading state
const router = createRouter({
	routeTree,
	context: {
		queryClient,
		isPro,
		canViewSales,
		menus: normalizedMenus
	},
	defaultPendingComponent: () => <PendingComponent />,
	defaultErrorComponent: ({ error }) => (
		<div className="p-5 bg-red-50 text-red-700 rounded-md">
			<h3 className="text-lg font-medium mb-2">Error</h3>
			<p>{error?.message || 'An unexpected error occurred'}</p>
		</div>
	),
	history: routerHistory,

	// Shared links are mounted under /burst-dashboard, but the route tree itself
	// still uses app-relative paths such as /statistics and /story.
	...( isSharedDashboardRoute ? { basepath: '/burst-dashboard' } : {}),

	// Preload on hover/focus only. The remaining route chunks are fetched by
	// preloadRemainingRoutes() once the current page has rendered, so the
	// first paint does not compete with chunks for other pages.
	defaultPreload: 'intent'

	// Since we're using React Query, we don't want loader calls to ever be stale
	// This will ensure that the loader is always called when the route is preloaded or visited
	// defaultPreloadStaleTime: 0,
});

const ROUTE_COMPONENT_KEYS = [ 'component', 'errorComponent', 'pendingComponent', 'notFoundComponent' ] as const;

// Routes without a menu entry, reached from within other pages.
const NON_MENU_ROUTES = new Set([ 'page', 'table', 'story' ]);

interface PreloadableComponent {
	preload?: () => Promise<unknown>;
}

/**
 * Fetches the code-split chunks of a route without running its loaders.
 *
 * @param route - The route whose component chunks should be fetched.
 */
const preloadRouteChunks = ( route: AnyRoute ): void => {
	ROUTE_COMPONENT_KEYS.forEach( ( key ) => {
		const component = route.options[key] as PreloadableComponent | undefined;
		component?.preload?.().catch( () => {

			// A failed preload is harmless: the chunk is fetched again on navigation.
		});
	});
};

/**
 * Whether a route is reachable for the current user, so its chunk is worth
 * fetching ahead of time. Menu routes are gated the same way their loaders are.
 *
 * @param route - The route to check.
 * @return True if the route should be preloaded.
 */
const isRouteReachable = ( route: AnyRoute ): boolean => {
	const segment = route.fullPath.split( '/' )[1] ?? '';
	if ( NON_MENU_ROUTES.has( segment ) ) {
		return true;
	}
	return shouldLoadRoute( '' === segment ? 'dashboard' : segment, normalizedMenus );
};

/**
 * Fetches the chunks of every other reachable route once the current page has
 * rendered, so navigation stays instant without slowing down the first paint.
 */
const preloadRemainingRoutes = (): void => {
	const schedule = window.requestIdleCallback ?? ( ( callback: () => void ) => window.setTimeout( callback, 1000 ) );
	schedule( () => {
		Object.values( router.routesById ).forEach( ( route ) => {
			if ( isRouteReachable( route ) ) {
				preloadRouteChunks( route );
			}
		});
	});
};

const unsubscribeFromFirstResolve = router.subscribe( 'onResolved', () => {
	unsubscribeFromFirstResolve();
	preloadRemainingRoutes();
});

const SkeletonBlock = ({ className }: { className: string }) => (
	<div className={ `${ className } bg-white shadow-sm rounded-xl p-5 dark:bg-dashboard-dark-surface @max-sm:col-span-12 @max-sm:row-span-1` }>
		<div className="h-6 w-1/2 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
		<div className="h-6 w-4/5 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
		<div className="h-6 w-full px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
		<div className="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
		<div className="h-6 w-4/5 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
		<div className="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
		<div className="h-6 w-full px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
		<div className="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
	</div>
);

const PendingComponent = () => {
	return (
		<>
			{/* Left Block */}
			<SkeletonBlock className="col-span-6 row-span-2" />

			{/* Middle Block */}
			<SkeletonBlock className="col-span-3 row-span-2" />

			{/* Right Block */}
			<SkeletonBlock className="col-span-3 row-span-2" />
		</>
	);
};

const AppShell = () => {
	return (
		<QueryClientProvider client={queryClient}>
			<Suspense fallback={<PendingComponent />}>
				<RouterProvider router={router} />
			</Suspense>
			<div id="modal-root" />
		</QueryClientProvider>
	);
};

// Initialize the React app immediately
const initApp = () => {
	const container = document.getElementById( 'burst-statistics' );
	if ( ! container ) {
		return;
	}

	// Create the app element
	const app = (
		<StrictMode>
			<ThemeProvider>
				<AppShell />
			</ThemeProvider>
		</StrictMode>
	);

	// Use createRoot instead of hydrateRoot
	if ( createRoot ) {
		const root = createRoot( container );
		root.render( app );
	} else {
		render( app, container );
	}

	// Signal that the React app has loaded (used by ad blocker detection)
	window.burstLoaded = true;

	startScrollLockWatchdog();

	// Remove the skeleton styles after React app is mounted
	setTimeout( () => {
		const styleElement = document.getElementById( 'burst-skeleton-styles' );
		if ( styleElement ) {
			styleElement.remove();
		}
	}, 100 ); // Small delay to ensure React has rendered
};

// Initialize app as soon as possible
if ( 'loading' === document.readyState ) {

	// If the document is still loading, wait for it to finish
	document.addEventListener( 'DOMContentLoaded', initApp );
} else {

	// If the document is already loaded, initialize immediately
	initApp();
}
