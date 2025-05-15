import { __ } from '@wordpress/i18n';

/**
 * EmptyDataTable is a functional component that handles different states of data loading.
 * It displays different messages based on whether the data is loading, there's an error, no data is available, or an unexpected error occurred.
 *
 * @param {Object} props - The properties passed to the component.
 * @param {boolean} props.isLoading - Indicates whether the data is currently loading.
 * @param {Object} props.error - An error object that may occur during data loading.
 * @param {boolean} props.noData - Indicates whether there is no data available.
 *
 * @returns {JSX.Element} A div element containing a message based on the current state.
 */

const EmptyDataTable = ({
  isLoading,
  error,
  noData
}) => {

  // Loading state
  if ( isLoading ) {
    return (
        <div className="burst-datatable-message burst-loading">
          <p>{__( 'Loading data...', 'burst-statistics' )}</p>
        </div>
    );
  }

  // Error state
  if ( error ) {
    return (
        <div className="burst-datatable-message burst-error">
          <p>{__( 'Error:', 'burst-statistics' )} {error.message}</p>
        </div>
    );
  }

  // No data state
  if ( noData ) {
    return (
        <div className="burst-datatable-message burst-no-data">
          <p>{__( 'No data available in table', 'burst-statistics' )}</p>
        </div>
    );
  }

  // Fallback or unexpected error state
  return (
      <div className="burst-datatable-message burst-unexpected-error">
        <p>{__( 'Unexpected error', 'burst-statistics' )}</p>
      </div>
  );
};

export default EmptyDataTable;
