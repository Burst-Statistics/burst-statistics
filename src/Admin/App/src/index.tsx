import { lazy, Suspense, StrictMode } from "react";
import { createRoot, render } from "@wordpress/element";

import {
  QueryClient,
  QueryCache,
  QueryClientProvider,
} from "@tanstack/react-query";

import {
  RouterProvider,
  createRouter,
  createHashHistory,
} from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Add type declaration for window.burst_settings
declare global {
  interface Window {
    burst_settings?: {
      isPro?: boolean;
      [key: string]: any;
    };
  }
}

const hashHistory = createHashHistory();
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

const queryCache = new QueryCache({
  onError: (error: Error) => {
    //console.error("Error in query cache", error);
  },
});

let config: QueryConfig = {
  defaultOptions: {
    queries: {
      staleTime: HOUR_IN_SECONDS * 1000, // hour in ms
      refetchOnWindowFocus: false,
      retry: false,
      suspense: false, // Disable Suspense for React Query, as it leads to loading the proper layout earlier. 
    },
  },
};

// merge queryCache with config
config = { ...config, ...{ queryCache } };

const queryClient = new QueryClient(config);
const isPro = window.burst_settings?.isPro;

// Create the router with improved loading state
const router = createRouter({
  routeTree,
  context: {
    queryClient,
    isPro,
  },
  defaultPendingComponent: () => <PendingComponent />,
  defaultErrorComponent: ({ error }) => (
    <div className="p-5 bg-red-50 text-red-700 rounded-md">
      <h3 className="text-lg font-medium mb-2">Error</h3>
      <p>{error?.message || "An unexpected error occurred"}</p>
    </div>
  ),
  history: hashHistory,
  defaultPreload: "viewport",
  // Since we're using React Query, we don't want loader calls to ever be stale
  // This will ensure that the loader is always called when the route is preloaded or visited
  // defaultPreloadStaleTime: 0,
});

// Update the lazy loading to use the default path
const ToastContainer = lazy(() =>
  import("react-toastify").then((module) => ({
    default: module.ToastContainer,
  }))
);

const PendingComponent = () => {
  return (
    <>
      {/* Left Block */}
      <div className="col-span-6 row-span-2 bg-white shadow-sm rounded-xl p-5">
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
      <div className="col-span-3 row-span-2 bg-white shadow-sm rounded-xl p-5">
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
      <div className="col-span-3 row-span-2 bg-white shadow-sm rounded-xl p-5">
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
  )
}

// Optimized loading state component that shows immediately
const LoadingState = () => (
  <>
    {/* Header */}
    <div className="bg-white">
      <div className="mx-auto flex max-w-screen-2xl items-center px-5">
        <div>
          <img width="100" src={`${window.burst_settings?.plugin_url}assets/img/burst-logo.svg`} alt="Logo Burst" className="h-12 w-40 px-5 py-2" />
        </div>
        <div className="flex items-center blur-sm animate-pulse">
          <div className="py-6 px-5 border-b-4 border-transparent">Dashboard</div>
          <div className="py-6 px-5 border-b-4 border-transparent ml-2">Statistics</div>
          <div className="py-6 px-5 border-b-4 border-transparent ml-2">Settings</div>
        </div>
      </div>
    </div>

    {/* Content Grid */}
    <div className="mx-auto flex max-w-screen-2xl">
      <div className="m-5 grid min-h-full w-full grid-cols-12 grid-rows-5 gap-5">
        <PendingComponent />
      </div>
    </div>
  </>
);

// Initialize the React app immediately
const initApp = () => {
  const container = document.getElementById("burst-statistics");
  if (!container) return;

  // Create the app element
  const app = (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<PendingComponent />}>
          <RouterProvider router={router} />
          <Suspense fallback={null}>
            <ToastContainer
              position="bottom-right"
              // autoClose={5000}
              hideProgressBar={true}
              newestOnTop={false}
              closeOnClick
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="light"
            />
          </Suspense>
          <div id="modal-root" />
        </Suspense>
      </QueryClientProvider>
    </StrictMode>
  );

  // Use createRoot instead of hydrateRoot
  if (createRoot) {
    const root = createRoot(container);
    root.render(app);
  } else {

    render(app, container);
  }

  // Remove the skeleton styles after React app is mounted
  setTimeout(() => {
    const styleElement = document.getElementById('burst-skeleton-styles');
    if (styleElement) {
      styleElement.remove();
    }
  }, 100); // Small delay to ensure React has rendered
};

// Initialize app as soon as possible
if (document.readyState === 'loading') {
  // If the document is still loading, wait for it to finish
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // If the document is already loaded, initialize immediately
  initApp();
} 