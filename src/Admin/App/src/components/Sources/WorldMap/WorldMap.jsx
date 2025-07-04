import ResponsiveChoropleth from './ResponsiveChoropleth';
import MapBreadcrumbs from './MapBreadcrumbs';
import { metricOptions, useGeoStore } from '@/store/useGeoStore';
import { useCallback, useEffect, useMemo } from '@wordpress/element';
import { useGeoData } from '@/hooks/useGeoData';
import { useGeoAnalytics } from '@/hooks/useGeoAnalytics';
import { createValueFormatter, formatUnixToDate } from '@/utils/formatting';
import { __, _n, _x, sprintf } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import { burst_get_website_url } from '@/utils/lib';
import useSettingsData from '@/hooks/useSettingsData';

const WorldMap = () => {

  // const filters = useFiltersStore((state) => state.filters);
  const currentView = useGeoStore( ( state ) => state.currentView );
  const currentViewMissingData = useGeoStore(
    ( state ) => state.currentViewMissingData
  );
  const setCurrentViewMissingData = useGeoStore(
    ( state ) => state.setCurrentViewMissingData
  );
  const navigateToView = useGeoStore( ( state ) => state.navigateToView );

  // Get projection values from store
  const projection = useGeoStore( ( state ) => state.projection );

  // Get metrics from store
  const selectedMetric = useGeoStore( ( state ) => state.selectedMetric );

  // Get visualization settings from store
  const patternsEnabled = useGeoStore( ( state ) => state.patternsEnabled );
  const classificationMethod = useGeoStore(
    ( state ) => state.classificationMethod
  );

  // Notice dismissal from store
  const dismissIncompleteDataNotice = useGeoStore(
    ( state ) => state.dismissIncompleteDataNotice
  );
  const isIncompleteDataNoticeDismissed = useGeoStore(
    ( state ) => state.isIncompleteDataNoticeDismissed
  );
  const checkDismissalExpiry = useGeoStore(
    ( state ) => state.checkDismissalExpiry
  );

  // Settings data for getting the database update time
  const { getValue } = useSettingsData();
  const cityGeoUpdateTime = getValue( 'burst_update_to_city_geo_database_time' );
  const geoIpDatabaseType = getValue( 'geo_ip_database_type' );

  const colorScheme = useMemo( () => {
    return metricOptions[selectedMetric]?.colorScheme || 'greens';
  }, [ selectedMetric ]);

  // Create valueFormatter function using the reusable utility
  const valueFormatter = useMemo( () => {
    return createValueFormatter( selectedMetric, metricOptions );
  }, [ selectedMetric ]);

  // Get zoom state from store
  const zoomTarget = useGeoStore( ( state ) => state.zoomTarget );
  const setZoomTarget = useGeoStore( ( state ) => state.setZoomTarget );

  // Get Geo data from our custom hook
  const {
    geoFeatures,
    simplifiedWorldGeoJson,
    baseLayerFeatures,
    overlayFeatures,
    hasOverlay,
    isGeoLoading,
    isGeoFetching,
    isGeoSimpleLoading,
    error: geoError
  } = useGeoData();

  // Get analytics data using our new custom hook
  const {
    data: analyticsData = [],
    isFetching: isAnalyticsFetching,
    error: analyticsError
  } = useGeoAnalytics();

  const handleFeatureClick = useCallback(
    ( feature ) => {
      if ( ! feature || ! feature.properties?.iso_a2 ) {
        return;
      }

      // Disable click functionality for country database type
      if ( 'country' === geoIpDatabaseType ) {
        return;
      }

      // Don't navigate if we're already in this country view
      if (
        'country' === currentView.level &&
        currentView.id === feature.properties.iso_a2
      ) {
        return;
      }

      let nextViewConfig;
      if ( 'world' === currentView.level ) {
        nextViewConfig = {
          level: 'country', // @todo: change to continent after adding proper continent data
          id: feature.properties?.iso_a2, // Expects continent ID from GeoJSON feature
          parentId: null,
          title: `${feature.properties?.name || feature.id}`
        };
      } else if ( 'continent' === currentView.level ) {
        nextViewConfig = {
          level: 'country',
          id: feature.properties?.iso_a2, // Expects country ID from GeoJSON feature
          parentId: currentView.id,
          title: `${feature.properties?.name || feature.id}`
        };
      }

      // For country database type, only allow navigation from world to country
      // For city database type, allow navigation to region level
      if (
        nextViewConfig &&
        ( 'city' === geoIpDatabaseType || 'world' === currentView.level )
      ) {
        navigateToView( nextViewConfig );
      }
    },
    [ currentView.level, currentView.id, navigateToView, geoIpDatabaseType ]
  );

  // Check if dismissal has expired on component mount
  useEffect( () => {
    checkDismissalExpiry();
  }, [ checkDismissalExpiry ]);

  // When view changes to a country and its data is loaded, set the zoom target
  useEffect( () => {
    if (
      'country' === currentView.level &&
      currentView.id &&
      ! isGeoFetching &&
      ! isGeoLoading &&
      0 < overlayFeatures?.features?.length
    ) {
      const target = {
        type: 'FeatureCollection',
        features: overlayFeatures.features
      };
      setZoomTarget( target );
    }
  }, [
    currentView.level,
    currentView.id,
    overlayFeatures,
    isGeoFetching,
    isGeoLoading,
    setZoomTarget
  ]);

  const matchProperty = useMemo( () => {

    // Custom matching function to match GeoJSON features with analytics data
    return ( feature, datum ) => {

      // Get the country code from the feature's properties

      // Get the country code from the analytics datum
      if ( 'world' === currentView.level ) {
        const featureCountryCode = feature.properties?.iso_a2;
        const datumCountryCode = datum.country_code;
        return (
          featureCountryCode &&
          datumCountryCode &&
          featureCountryCode === datumCountryCode
        );
      } else if (
        'country' === currentView.level &&
        'city' === geoIpDatabaseType
      ) {

        // For city database type, match regions within countries
        const featureCountryCode = feature.properties?.iso_3166_2;
        const datumCountryCode = datum.country_code + '-' + datum.state_code;
        return (
          featureCountryCode &&
          datumCountryCode &&
          featureCountryCode === datumCountryCode
        );
      }
      return false;
    };
  }, [ currentView.level, currentView.id, geoIpDatabaseType ]);

  // Configure value accessor for the selected metric
  const valueAccessor = useMemo( () => {
    return ( datum ) => {
      if ( ! datum ) {
        return 0;
      }
      const value = parseInt( datum[selectedMetric], 10 );
      return isNaN( value ) ? 0 : value;
    };
  }, [ selectedMetric ]);

  // Configure label accessor to show country name from feature properties
  const labelAccessor = useMemo( () => {
    return ( feature ) => {
      return (
        feature.properties?.name_en ||
        feature.properties?.iso_a2 ||
        __( 'Unknown', 'burst-statistics' )
      );
    };
  }, []);

  // Calculate total for the selected metric
  const totalMetricValue = useMemo( () => {
    if ( ! analyticsData || 0 === analyticsData.length ) {
      return 0;
    }

    // For city database type, if currentView.level === "country" && analyticsData has an entry without state_code save it to the store
    if (
      'city' === geoIpDatabaseType &&
      'country' === currentView.level &&
      analyticsData.some( ( datum ) => ! datum.state_code )
    ) {

      // save the entry without state_code to the store
      setCurrentViewMissingData(
        analyticsData.find( ( datum ) => ! datum.state_code )
      );

      // remove the entry without state_code from analyticsData
    } else {
      setCurrentViewMissingData( null );
    }

    return analyticsData.reduce( ( sum, datum ) => sum + valueAccessor( datum ), 0 );
  }, [ analyticsData, valueAccessor ]);

  // Calculate statistics for better context
  const dataStatistics = useMemo( () => {
    if ( ! analyticsData || 0 === analyticsData.length ) {
      return null;
    }

    const values = analyticsData
      .map( ( d ) => valueAccessor( d ) )
      .filter( ( v ) => 0 < v );
    if ( 0 === values.length ) {
      return null;
    }

    const sorted = [ ...values ].sort( ( a, b ) => a - b );
    const mean = values.reduce( ( sum, val ) => sum + val, 0 ) / values.length;
    const median = sorted[Math.floor( sorted.length / 2 )];

    return {
      count: values.length,
      min: Math.min( ...values ),
      max: Math.max( ...values ),
      mean: Math.round( mean ),
      median: Math.round( median ),
      total: totalMetricValue
    };
  }, [ analyticsData, valueAccessor, totalMetricValue ]);

  // Calculate domain for color scale based on the selected metric - now handled by classification
  const colorDomain = useMemo( () => {
    if ( ! analyticsData || 0 === analyticsData.length ) {
      return [ 0, 100 ];
    }

    const values = analyticsData
      .map( ( d ) => valueAccessor( d ) )
      .filter( ( v ) => 0 < v );
    if ( 0 === values.length ) {
      return [ 0, 100 ];
    }

    const min = Math.min( ...values );
    const max = Math.max( ...values );
    return [ min, max ];
  }, [ analyticsData, valueAccessor ]);

  const displayError = geoError || analyticsError;

  // Calculate if we're in a loading state
  const isLoading = isGeoLoading || isGeoFetching || isAnalyticsFetching;

  if ( displayError ) {
    return (
      <div className="text-red-500 relative p-4">
        <div className="absolute left-3 top-3 z-10">
          <MapBreadcrumbs />
        </div>
        <div className="mt-12">
          <p>
            {sprintf(

              /* translators: %s: Error message */
              __( 'Error: %s', 'burst-statistics' ),
              String( displayError )
            )}
          </p>
        </div>
      </div>
    );
  }

  if ( isGeoSimpleLoading ) {
    return (
      <div className="p-4 text-gray">
        {__( 'Loading map data...', 'burst-statistics' )}
      </div>
    );
  }

  if ( ! selectedMetric ) {
    return (
      <div className="p-4 text-gray">
        {__( 'No metrics available for display.', 'burst-statistics' )}
      </div>
    );
  }

  return (
    <div
      className="relative h-full min-h-[450px] w-full rounded-b-lg"
      style={{ boxShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.06)' }}
    >
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/30 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-white p-6 shadow-lg">
            <div className="border-blue-600 h-8 w-8 animate-spin rounded-full border-b-2"></div>
            <div className="text-sm font-medium text-gray">
              {isGeoLoading || isGeoFetching ?
                __( 'Loading map data...', 'burst-statistics' ) :
                __( 'Loading analytics...', 'burst-statistics' )}
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumbs Navigation - Only show for city database type */}
      {'city' === geoIpDatabaseType && (
        <div className="absolute left-3 top-3 z-10">
          <MapBreadcrumbs />
        </div>
      )}

      {/* Incomplete Data Notice - Top Left - Only for city database type */}
      {'city' === geoIpDatabaseType &&
        currentViewMissingData &&
        ! isIncompleteDataNoticeDismissed && (
          <div className="absolute left-3 top-16 z-10 max-w-md">
            <div className="rounded-lg border border-gray-200 bg-white/95 px-4 py-3 text-sm shadow-sm transition-all hover:shadow-md">
              <div className="flex items-start gap-3">
                <Icon
                  name="help"
                  size={16}
                  color="blue"
                  className="mt-0.5 flex-shrink-0"
                />
                <div className="flex-1">
                  <div className="mb-2 text-black">
                    <p className="font-semibold">
                      {sprintf(
                        __(
                          'Region-level data is available for visits after %s.',
                          'burst-statistics'
                        ),
                        cityGeoUpdateTime ?
                          formatUnixToDate( cityGeoUpdateTime ) :
                          ''
                      )}
                    </p>
                    <p className="mt-1">
                      {__(
                        'Region tracking is a new feature, so this data is only available for visits recorded after it was enabled.',
                        'burst-statistics'
                      )}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <a
                      href={burst_get_website_url(
                        'new-feature-region-tracking/',
                        {
                          utm_source: 'worldmap',
                          utm_content: 'incomplete-data-notice'
                        }
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue underline"
                    >
                      {__( 'Learn more', 'burst-statistics' )}
                    </a>
                    <button
                      onClick={dismissIncompleteDataNotice}
                      className="rounded bg-gray-200 px-3 py-1 text-gray hover:bg-gray-300 hover:text-gray"
                      title={__( 'Dismiss for 30 days', 'burst-statistics' )}
                    >
                      {__( 'Dismiss', 'burst-statistics' )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Map Statistics Info */}
      <div
        className={`absolute z-10 ${
          'country' === geoIpDatabaseType ? 'left-3 top-3' : 'right-3 top-3'
        }`}
      >
        <div className="duration-400 group rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-sm shadow-sm transition-all hover:shadow-md">
          <div className="font-semibold text-black">
            {sprintf(

              /* translators: 1: Metric name (e.g., "Pageviews", "Visitors"), 2: Location type (e.g., "Country" or "Region") */
              _x( '%1$s per %2$s', 'metric by location', 'burst-statistics' ),
              metricOptions[selectedMetric]?.label || selectedMetric,
              'world' === currentView.level || 'country' === geoIpDatabaseType ?
                _x( 'country', 'location type', 'burst-statistics' ) :
                _x( 'region', 'location type', 'burst-statistics' )
            )}
          </div>
          {dataStatistics && (
            <>
              <div className="mt-1 text-xs text-gray">
                {sprintf(

                  /* translators: %d: Number of locations that have data */
                  'country' === geoIpDatabaseType ?
                    _n(
                        '%d country with data',
                        '%d countries with data',
                        dataStatistics.count,
                        'burst-statistics'
                      ) :
                    _n(
                        '%d region with data',
                        '%d regions with data',
                        dataStatistics.count,
                        'burst-statistics'
                      ),
                  dataStatistics.count
                )}
              </div>
              {patternsEnabled && (
                <div className="mt-1 text-xs text-gray">
                  • {__( 'Patterns enabled', 'burst-statistics' )}
                </div>
              )}
              {currentViewMissingData && (
                <div className="mt-1 flex items-center gap-1 text-xs text-gray">
                  <Icon name="help" size={12} strokeWidth={2} color="blue" />
                  {sprintf(

                    /* translators: %d: Number of visitors with unknown region, %s: metric label */
                    __( '%d %s with unknown region', 'burst-statistics' ),
                    valueFormatter( valueAccessor( currentViewMissingData ) ),
                    metricOptions[selectedMetric]?.label?.toLowerCase() ||
                      selectedMetric.toLowerCase()
                  )}
                </div>
              )}
            </>
          )}
          {/* Show detailed statistics on hover with smooth animation */}
          {dataStatistics && (
            <div className="max-h-0 overflow-hidden opacity-0 transition-all duration-300 ease-in-out group-hover:max-h-32 group-hover:opacity-100">
              <div className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-xs text-gray">
                <div className="flex justify-between">
                  <span>
                    {_x( 'Range', 'statistic label', 'burst-statistics' )}:
                  </span>
                  <span>
                    {valueFormatter( dataStatistics.min )} -{' '}
                    {valueFormatter( dataStatistics.max )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>
                    {_x( 'Average', 'statistic label', 'burst-statistics' )}:
                  </span>
                  <span>{valueFormatter( dataStatistics.mean )}</span>
                </div>
                <div className="flex justify-between">
                  <span>
                    {_x( 'Median', 'statistic label', 'burst-statistics' )}:
                  </span>
                  <span>{valueFormatter( dataStatistics.median )}</span>
                </div>
                <div className="flex justify-between">
                  <span>
                    {_x( 'Total', 'statistic label', 'burst-statistics' )}:
                  </span>
                  <span className="font-medium">
                    {valueFormatter( dataStatistics.total )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>
                    {_x( 'Method', 'statistic label', 'burst-statistics' )}:
                  </span>
                  <span className="font-medium capitalize">
                    {_x(
                      classificationMethod.replace( '-', ' ' ),
                      'classification method',
                      'burst-statistics'
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {0 < geoFeatures?.features?.length && ! isGeoSimpleLoading && (
        <ResponsiveChoropleth
          key={`choropleth-${patternsEnabled ? 'patterns' : 'no-patterns'}-${classificationMethod}`}
          onClick={handleFeatureClick}
          data={analyticsData}
          features={
            'world' === currentView.level ?
              geoFeatures.features :
              baseLayerFeatures.features
          }
          transform={geoFeatures.transform}
          baseMapFeatures={simplifiedWorldGeoJson.features}

          // Multi-layer props for smooth transitions
          overlayFeatures={hasOverlay ? overlayFeatures : { features: [] }}
          overlayData={hasOverlay ? analyticsData : []}
          overlayMatch={matchProperty}
          overlayValue={valueAccessor}
          showBaseLayer={hasOverlay}
          baseLayerOpacity={0.2}
          overlayOpacity={1}
          match={matchProperty}
          value={valueAccessor}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          colors={colorScheme}
          domain={colorDomain}
          unknownColor="#dee2e6"
          label={labelAccessor}
          valueFormat={valueFormatter}
          projectionType="naturalEarth1"

          // Use projection values from the store
          projectionScale={projection.scale}
          projectionTranslation={projection.translation}
          projectionRotation={projection.rotation}
          enableGraticule={true}
          graticuleLineColor="#dddddd"
          borderWidth={0.5}
          borderColor="#adb5bd"
          metric={selectedMetric}
          metricOptions={metricOptions}
          patternsEnabled={patternsEnabled}
          classificationMethod={classificationMethod}

          // Zoom animation prop from store
          zoomToFeature={zoomTarget}
          legends={[
            {
              anchor: 'bottom-left',
              direction: 'column',
              justify: true,
              translateX: 20,
              translateY: -100,
              itemsSpacing: 0,
              itemWidth: 94,
              itemHeight: 18,
              itemDirection: 'left-to-right',
              itemTextColor: '#444444',
              itemOpacity: 0.85,
              symbolSize: 18,
              effects: [
                {
                  on: 'hover',
                  style: {
                    itemTextColor: '#000000',
                    itemOpacity: 1
                  }
                }
              ]
            }
          ]}
          tooltipTotal={dataStatistics?.total}
          selectedMetric={selectedMetric}
          geoIpDatabaseType={geoIpDatabaseType}
        />
      )}
    </div>
  );
};

export default WorldMap;
