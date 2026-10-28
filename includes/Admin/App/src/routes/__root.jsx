import { createRootRoute, Outlet, redirect } from '@tanstack/react-router';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import Header from '@/components/Common/Header.jsx';
import React, { Suspense } from 'react';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { validateFilterSearch } from '@/config/filterConfig';
import { isDateRangeEnabledRoute, isFilterEnabledRoute } from '@/utils/routeUtils';
import NotFoundModal from '@/components/Common/NotFoundModal';
import { RootPendingSkeleton } from '@/components/Common/RootPendingSkeleton';
import { BurstToastContainer } from '@/components/Common/Toast/ToastContainer';
import useShareableLinkStore from '@/store/useShareableLinkStore';
import { useTourStore } from '@/store/useTourStore';

// Path of the last navigation, to tell opening the filter pages apart from
// moving between them.
let previousPathname = null;

/**
 * Remembers the path of each navigation and tells whether it opens the filter
 * pages: the first load, coming from a page without filters, or a link from
 * outside the app.
 *
 * @param {string} pathname The pathname being navigated to.
 * @param {Object} state    History state of the navigation.
 * @return {boolean|null} Whether this opens the filter pages, or null when it is not a filter page.
 */
const getFilterPagesOpening = ( pathname, state ) => {

	// A WordPress admin menu link only changes the hash, so the page stays
	// loaded. The router did not make that history entry, so it has no key.
	const isOpening = null === previousPathname || ! isFilterEnabledRoute( previousPathname ) || ! state.key;
	previousPathname = pathname;
	return isFilterEnabledRoute( pathname ) ? isOpening : null;
};

// Lazy-loaded so the tour component tree stays out of the main chunk; it only
// loads when a tour is active or the resume modal is shown.
const TourGuide = React.lazy( () => import( '@/components/Tour/TourGuide' ) );

/**
 * Root layout. Story route handles its own width constraint + padding so the
 * brand stripe and hero block can extend to the edges of the centered content area.
 */
const RootComponent = () => {
	const isStory = useShareableLinkStore( ( state ) => state.isStoryView );
	const tourActive = useTourStore( ( state ) => state.tourActive );
	const isResumeModalOpen = useTourStore( ( state ) => state.isResumeModalOpen );

	return (
		<ErrorBoundary>
			<Header />

			<Suspense fallback={<div className="p-4">Loading...</div>}>
				{ isStory ? (
					<Outlet />
				) : (
					<div className="mx-auto flex max-w-(--breakpoint-2xl)">
						<div className="grid-rows-auto p-3  grid min-h-full w-full grid-cols-12 gap-3 @lg:py-5 @lg:px-10 @lg:gap-5 relative">
							<Outlet />
						</div>
					</div>
				) }
			</Suspense>

			{( tourActive || isResumeModalOpen ) && (
				<Suspense fallback={null}>
					<TourGuide />
				</Suspense>
			)}

			{'development' === process.env.NODE_ENV && (
				<Suspense>
					<TanStackRouterDevtools />
				</Suspense>
			)}
			<BurstToastContainer />
		</ErrorBoundary>
	);
};

export const Route = createRootRoute({

	// Validate filter search params at the root level so they're shared across all routes.
	validateSearch: validateFilterSearch,

	// Fill in the remembered filters and date range before a page that keeps
	// them in the URL renders, so they arrive in one step instead of from each
	// component.
	beforeLoad: async({ location, matches, preload }) => {

		// A preload only fetches the page ahead of a hover, nothing is shown yet.
		if ( preload ) {
			return;
		}

		const isOpening = getFilterPagesOpening( location.pathname, location.state );
		if ( ! isDateRangeEnabledRoute( location.pathname ) ) {
			return;
		}

		// Loaded on demand: it reads the date store, which is too heavy for the
		// core bundle and is loaded by every date range page anyway.
		const { getFilterRouteSearch } = await import( '@/utils/filterRouteEntry' );
		const search = getFilterRouteSearch( location.search, isOpening, location.state );
		if ( ! search ) {
			return;
		}

		const page = matches[ matches.length - 1 ];
		throw redirect({
			to: page.routeId,
			params: page.params,
			search,
			replace: true
		});
	},
	notFoundComponent: NotFoundModal,

	// The root layout is not rendered while beforeLoad runs, so the default
	// pending skeleton would lose its grid and stretch across the page. The
	// router only gives the root route its own Suspense boundary, and with it
	// this pending component, when wrapInSuspense is set.
	wrapInSuspense: true,
	pendingComponent: RootPendingSkeleton,
	component: RootComponent,
	errorComponent: ({ error }) => {
		console.log( 'Root Route Error:', error );
	}
});
