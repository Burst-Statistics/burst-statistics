import {
  render, createRoot
} from '@wordpress/element';
import Page from './components/Page';

import {
  QueryClient,
  QueryCache,
  QueryClientProvider
} from '@tanstack/react-query';

import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
const HOUR_IN_SECONDS = 3600;
const queryCache = new QueryCache({
  onError: ( error ) => {

    // any error handling code...
  }
});
let config = {
  defaultOptions: {
    queries: {
      staleTime: HOUR_IN_SECONDS * 1000, // hour in ms
      refetchOnWindowFocus: false,
      retry: false
    }
  }
};

// merge queryCache with config
config = {...config, ...{queryCache}};

const queryClient = new QueryClient( config );

document.addEventListener( 'DOMContentLoaded', () => {
  const container = document.getElementById( 'burst-statistics' );
  if ( container ) {
    if ( createRoot ) {
      createRoot( container ).render(
          <React.StrictMode>
            <QueryClientProvider client={queryClient}>
              <div className="burst-wrapper">
                <Page/>
              </div>
              <ReactQueryDevtools />
            </QueryClientProvider>
          </React.StrictMode>
           );
    } else {
      render(
          <React.StrictMode>
            <QueryClientProvider client={queryClient}>
              <div className="burst-wrapper">
                <Page/>
              </div>
              <ReactQueryDevtools />
            </QueryClientProvider>
          </React.StrictMode>,
          container
      );
    }
  }
});
