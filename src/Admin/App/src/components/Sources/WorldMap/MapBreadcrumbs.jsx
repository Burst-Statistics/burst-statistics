import { useCallback } from '@wordpress/element';
import { _x } from '@wordpress/i18n';
import { useGeoStore } from '@/store/useGeoStore';
import Icon from '@/utils/Icon';
import Flag from '@/components/Statistics/Flag';

const MapBreadcrumbs = () => {
  const currentView = useGeoStore( ( state ) => state.currentView );
  const history = useGeoStore( ( state ) => state.history );
  const navigateBack = useGeoStore( ( state ) => state.navigateBack );
  const resetGeoToDefault = useGeoStore( ( state ) => state.resetGeoToDefault );

  const handleBackClick = useCallback( () => {
    navigateBack();
  }, [ navigateBack ]);

  const handleWorldClick = useCallback( () => {
    if ( 'world' !== currentView.level ) {
      resetGeoToDefault();
    }
  }, [ currentView.level, resetGeoToDefault ]);

  // Generate breadcrumb items based on current view and history
  const breadcrumbItems = [
    {
      label: _x( 'World', 'navigation item', 'burst-statistics' ),
      isActive: 'world' === currentView.level,
      onClick: handleWorldClick,
      isClickable: 'world' !== currentView.level
    }
  ];

  // Add current view if not world
  if ( 'world' !== currentView.level ) {
    breadcrumbItems.push({
      label: currentView.title || currentView.id,
      isActive: true,
      isClickable: false,
      id: currentView.id
    });
  }

  const canGoBack = 1 < history.length;

  return (
    <div className="flex items-stretch gap-2">
      {/* Back Button - Always visible */}
      <div className="flex items-center rounded-lg border border-gray-200 bg-white/95 text-sm shadow-sm transition-all hover:shadow-md">
        <button
          onClick={canGoBack ? handleBackClick : undefined}
          disabled={! canGoBack}
          className={`focus:ring-blue-500 flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
            canGoBack ?
              'cursor-pointer text-white hover:bg-gray-100' :
              'cursor-not-allowed text-gray'
          }`}
          title={
            canGoBack ?
              _x( 'Go back', 'button title', 'burst-statistics' ) :
              _x( 'No previous page', 'button title', 'burst-statistics' )
          }
        >
          <Icon
            name="chevron-left"
            size={16}
            color={canGoBack ? 'black' : 'gray'}
          />
        </button>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="flex items-center rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-sm shadow-sm transition-all hover:shadow-md">
        <nav
          className="flex items-center"
          aria-label={_x( 'Map navigation', 'aria label', 'burst-statistics' )}
        >
          <ol className="flex items-center space-x-1">
            {breadcrumbItems.map( ( item, index ) => (
              <li key={index} className="m-0 flex items-center">
                {0 < index && (
                  <Icon
                    name="chevron-right"
                    size={14}
                    color="gray"
                    className="mx-1 flex-shrink-0"
                  />
                )}
                {item.isClickable ? (
                  <button
                    onClick={item.onClick}
                    className="text-blue-600 hover:text-blue-800 focus:ring-blue-500 rounded px-1 py-0.5 text-sm transition-colors hover:underline focus:outline-none focus:ring-2 focus:ring-offset-1"
                  >
                    {item.label}
                  </button>
                ) : (
                  <span
                    className={`rounded px-1 py-0.5 text-sm ${
                      item.isActive ?
                        'font-medium text-black' :
                        'bg-gray-200 text-gray'
                    }`}
                  >
                    <Flag country={item.id} countryNiceName={item.label} />
                  </span>
                )}
              </li>
            ) )}
          </ol>
        </nav>
      </div>
    </div>
  );
};

export default MapBreadcrumbs;
