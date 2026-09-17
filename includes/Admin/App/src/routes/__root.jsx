import { createRootRoute, Outlet } from '@tanstack/react-router';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import Header from '@/components/Common/Header.jsx';
import React, { Suspense } from 'react';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { validateFilterSearch } from '@/config/filterConfig';
import NotFoundModal from '@/components/Common/NotFoundModal';
import { BurstToastContainer } from '@/components/Common/Toast/ToastContainer';
import useShareableLinkStore from '@/store/useShareableLinkStore';
import { useTourStore } from '@/store/useTourStore';

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
	notFoundComponent: NotFoundModal,
	component: RootComponent,
	errorComponent: ({ error }) => {
		console.log( 'Root Route Error:', error );
	}
});
