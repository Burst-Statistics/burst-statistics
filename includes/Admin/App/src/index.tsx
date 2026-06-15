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
	createHashHistory
} from '@tanstack/react-router';

// StyleSheetManager is used to configure styled-components globally
// We need this to filter out the 'right' prop that react-data-table-component
// passes to styled components, which causes warnings in styled-components v6
import { StyleSheetManager } from 'styled-components';
import isPropValid from '@emotion/is-prop-valid';
import { ThemeProvider } from './hooks/useTheme';

// Import the generated route tree
import { routeTree } from './routeTree.gen';
const shouldForwardProp = ( prop: string ) => {

	// List of react-data-table-component specific props that should not be forwarded to DOM
	const dataTableProps = [
		'right',
		'grow',
		'wrap',
		'allowOverflow',
		'button',
		'center',
		'compact',
		'hide',
		'ignoreRowClick',
		'maxWidth',
		'minWidth',
		'omit',
		'reorder',
		'sortable',
		'width'
	];

	// Filter out data table props first
	if ( dataTableProps.includes( prop ) ) {
		return false;
	}

	// Then use isPropValid for standard HTML validation
	return isPropValid( prop );
};

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
	defaultPreload: 'viewport'

	// Since we're using React Query, we don't want loader calls to ever be stale
	// This will ensure that the loader is always called when the route is preloaded or visited
	// defaultPreloadStaleTime: 0,
});

const PendingComponent = () => {
	return (
		<>
			{/* Left Block */}
			<div className="col-span-6 row-span-2 bg-white shadow-sm rounded-xl p-5 dark:bg-dashboard-dark-surface @max-sm:col-span-12 @max-sm:row-span-1">
				<div className="h-6 w-1/2 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-4/5 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-full px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-4/5 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-full px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
			</div>

			{/* Middle Block */}
			<div className="col-span-3 row-span-2 bg-white shadow-sm rounded-xl p-5 dark:bg-dashboard-dark-surface @max-sm:col-span-12 @max-sm:row-span-1">
				<div className="h-6 w-1/2 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-4/5 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-full px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-4/5 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-full px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
			</div>

			{/* Right Block */}
			<div className="col-span-3 row-span-2 bg-white shadow-sm rounded-xl p-5 dark:bg-dashboard-dark-surface @max-sm:col-span-12 @max-sm:row-span-1">
				<div className="h-6 w-1/2 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-4/5 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-full px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-4/5 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-full px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
				<div className="h-6 w-5/6 px-5 py-2 bg-gray-200 rounded-md mb-5 animate-pulse"></div>
			</div>
		</>
	);
};

const AppShell = () => {
	return (
		<StyleSheetManager shouldForwardProp={shouldForwardProp}>
			<QueryClientProvider client={queryClient}>
				<Suspense fallback={<PendingComponent />}>
					<RouterProvider router={router} />
				</Suspense>
				<div id="modal-root" />
			</QueryClientProvider>
		</StyleSheetManager>
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
				{/*
				StyleSheetManager prevents styled-components from forwarding the 'right' prop to DOM elements.
				This is needed because react-data-table-component uses 'right' prop for column alignment,
				which triggers warnings in styled-components v6 when passed to DOM elements.
				See: getDataTableData.js line 267 where 'right' prop is set based on column alignment.
			*/}
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
