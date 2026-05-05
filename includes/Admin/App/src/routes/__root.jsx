import { createRootRoute, Outlet } from '@tanstack/react-router';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import Header from '@/components/Common/Header.jsx';
import { Suspense } from 'react';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { validateFilterSearch } from '@/config/filterConfig';
import NotFoundModal from '@/components/Common/NotFoundModal';
import { BurstToastContainer } from '@/components/Common/Toast/ToastContainer';

export const Route = createRootRoute({

	// Validate filter search params at the root level so they're shared across all routes.
	validateSearch: validateFilterSearch,
	notFoundComponent: NotFoundModal,
	component: () => {
		return (
			<ErrorBoundary>
				<Header />

				<Suspense fallback={<div className="p-4">Loading...</div>}>
					<div className="mx-auto flex max-w-(--breakpoint-2xl)">
						<div className="grid-rows-auto p-3  grid min-h-full w-full grid-cols-12 gap-3 lg:py-5 lg:px-10 lg:gap-5 relative">
							<Outlet />
						</div>
					</div>
				</Suspense>

				{'development' === process.env.NODE_ENV && (
					<Suspense>
						<TanStackRouterDevtools />
					</Suspense>
				)}
				<BurstToastContainer />
			</ErrorBoundary>
		);
	},
	errorComponent: ({ error }) => {
		console.log( 'Root Route Error:', error );
	}
});
