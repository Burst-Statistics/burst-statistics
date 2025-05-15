import { createRootRoute, Outlet } from '@tanstack/react-router';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import Header from '@/components/Common/Header';
import { Suspense } from 'react';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';

export const Route = createRootRoute({
  component: () => {
    return (
      <ErrorBoundary>
        <Header />
        <Suspense fallback={<div className="p-4">Loading...</div>}>
          <div className="mx-auto flex max-w-screen-2xl">
            <div
                className="grid-rows-auto m-3 grid min-h-full w-full grid-cols-12 gap-3 lg:m-5 lg:gap-5">
              <Outlet/>
            </div>
          </div>
        </Suspense>
        {'development' === process.env.NODE_ENV && (
            <Suspense>
              <TanStackRouterDevtools/>
            </Suspense>
        )}
      </ErrorBoundary>
    );
  }
});
