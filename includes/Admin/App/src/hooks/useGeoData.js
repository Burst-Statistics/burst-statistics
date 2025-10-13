// hooks/useGeoData.js
import { useMemo } from '@wordpress/element'; // Or from '@wordpress/element'
import { useQuery } from '@tanstack/react-query';
import { feature } from 'topojson-client';
import { useGeoStore } from '@/store/useGeoStore'; // Adjust path
import { getJsonData } from '@/utils/api'; // Your existing API util
import useLicenseStore from '@/store/useLicenseStore';

// Assuming burst_settings is globally available in your WP environment
const MAPS_BASE_PATH = burst_settings.plugin_url + 'includes/Pro/assets/maps';
const SIMPLIFIED_WORLD_GEO_URL =
  burst_settings.plugin_url + 'assets/maps/world/world_loading.json';

const WORLD_GEO_URL_BASE = `${MAPS_BASE_PATH}/world`; // Base for world files
const COUNTRY_GEO_URL_BASE = `${MAPS_BASE_PATH}/countries`;

const QUERY_KEYS = {
  geoData: ( level, id ) => [ 'geo_data', level, id || 'default_level_id' ],

  // If you still want a separate very fast initial simplified world map
  simplifiedInitialWorld: 'simplified_initial_world_topo',

  // Always keep world data available for base layer
  worldData: 'world_data_detailed',

  // Country overlay data
  countryOverlay: ( countryId ) => [ 'country_overlay', countryId ]
};


// Helper: Converts TopoJSON to GeoJSON features
const convertTopoToGeo = ( topoData, objectKey ) => {
  if ( ! topoData || ! topoData.objects || ! topoData.objects[objectKey]) {
    console.warn(
      `TopoData or objectKey '${objectKey}' not found for conversion.`,
      topoData?.objects
    );
    return { type: 'FeatureCollection', features: [] };
  }

  try {
    const geoJson = feature( topoData, topoData.objects[objectKey]);

    // Include the transform object from the topoData if it exists
    if ( topoData.transform ) {
      geoJson.transform = topoData.transform;
    }
    return geoJson;
  } catch ( error ) {
    console.error( 'Error converting TopoJSON to GeoJSON:', error );
    return { type: 'FeatureCollection', features: [] };
  }
};

// Individual fetch functions returning TopoJSON promise
const fetchWorldTopo = async( isSimplified = false ) => {
  try {

    // simplified is for loading state.
    const url = isSimplified ?
      SIMPLIFIED_WORLD_GEO_URL :
      `${WORLD_GEO_URL_BASE}/world.json`;

    const json = await getJsonData( url );
    return json;
  } catch ( error ) {
    console.error( 'Error fetching world topo:', error );
    throw error;
  }
};

const fetchCountryTopo = async( countryId ) => {
  try {
    if ( ! countryId ) {
      throw new Error( 'Country ID is required' );
    }

    // e.g., usa.json, nld.json (ensure IDs match)
    const url = `${COUNTRY_GEO_URL_BASE}/${countryId.toLowerCase()}.json`;
    const json = await getJsonData( url );
    return json;
  } catch ( error ) {
    console.error( 'Error fetching country topo:', error );
    throw error;
  }
};

export const useGeoData = () => {
  const currentView = useGeoStore( ( state ) => state.currentView );
  const isPro = useLicenseStore( ( state ) => state.isPro );

  // Always keep simplified world data for fast initial render
  const { data: simplifiedWorldTopo, isLoading: isGeoSimpleLoading } = useQuery(
    {
      queryKey: [ QUERY_KEYS.simplifiedInitialWorld ],
      queryFn: () => fetchWorldTopo( true ), // Fetches world_simplified.json
      staleTime: Infinity, // Never refetch as this data never changes
      cacheTime: Infinity, // Keep in cache indefinitely
      retry: 3,
      enabled: true // Always fetch this as a global fallback
    }
  );

  if ( isPro ) {

    // Always keep detailed world data for base layer
    const { data: worldTopo, isLoading: isWorldLoading } = useQuery({
      queryKey: [ QUERY_KEYS.worldData ],
      queryFn: () => fetchWorldTopo( false ), // Fetches detailed world.json
      staleTime: Infinity,
      cacheTime: Infinity,
      retry: 3,
      enabled: true // Always fetch for base layer
    });
  }

  // Country overlay data - only fetch when in country view
  const { data: countryOverlayTopo, isLoading: isCountryOverlayLoading } =
    useQuery({
      queryKey: QUERY_KEYS.countryOverlay( currentView.id ),
      queryFn: () => fetchCountryTopo( currentView.id ),
      enabled: 'country' === currentView.level && !! currentView.id,
      staleTime: Infinity,
      cacheTime: Infinity,
      retry: 3
    });

  // Convert all TopoJSON to GeoJSON
  const simplifiedWorldGeoJson = useMemo( () => {
    if ( ! simplifiedWorldTopo ) {
      return { type: 'FeatureCollection', features: [] };
    }

    const objectKey =
      Object.keys( simplifiedWorldTopo.objects || {})[0] || 'features';
    return convertTopoToGeo( simplifiedWorldTopo, objectKey );
  }, [ simplifiedWorldTopo ]);

  const worldGeoJson = useMemo( () => {
    if ( ! worldTopo ) {
      return { type: 'FeatureCollection', features: [] };
    }

    const objectKey = Object.keys( worldTopo.objects || {})[0] || 'features';
    return convertTopoToGeo( worldTopo, objectKey );
  }, [ worldTopo ]);

  const countryOverlayGeoJson = useMemo( () => {
    if ( ! countryOverlayTopo ) {
      return { type: 'FeatureCollection', features: [] };
    }

    const objectKey =
      Object.keys( countryOverlayTopo.objects || {})[0] || 'features';
    return convertTopoToGeo( countryOverlayTopo, objectKey );
  }, [ countryOverlayTopo ]);

  // Determine primary features based on view level
  const primaryFeatures = useMemo( () => {
    switch ( currentView.level ) {
      case 'world':

        // Use detailed world data if available, fallback to simplified
        return 0 < worldGeoJson?.features?.length ?
          worldGeoJson :
          simplifiedWorldGeoJson;
      case 'country':

        // Use country overlay if available, fallback to world data
        return 0 < countryOverlayGeoJson?.features?.length ?
          countryOverlayGeoJson :
          worldGeoJson;
      default:
        return simplifiedWorldGeoJson;
    }
  }, [
    currentView.level,
    worldGeoJson,
    countryOverlayGeoJson,
    simplifiedWorldGeoJson
  ]);

  // Base layer features (always world map for context)
  const baseLayerFeatures = useMemo( () => {
    return simplifiedWorldGeoJson;
  }, [ simplifiedWorldGeoJson ]);

  // Overlay features (country details when in country view)
  const overlayFeatures = useMemo( () => {
    if (
      'country' === currentView.level &&
      0 < countryOverlayGeoJson?.features?.length
    ) {
      return countryOverlayGeoJson;
    }
    return { type: 'FeatureCollection', features: [] };
  }, [ currentView.level, countryOverlayGeoJson ]);

  const isLoading = useMemo( () => {
    if ( 'world' === currentView.level ) {
      return (
        isWorldLoading &&
        ! worldGeoJson?.features?.length &&
        ! ( 0 < simplifiedWorldGeoJson?.features?.length )
      );
    } else if ( 'country' === currentView.level ) {
      return (
        isCountryOverlayLoading && ! countryOverlayGeoJson?.features?.length
      );
    }
    return isGeoSimpleLoading;
  }, [
    currentView.level,
    isWorldLoading,
    isCountryOverlayLoading,
    isGeoSimpleLoading,
    worldGeoJson,
    countryOverlayGeoJson,
    simplifiedWorldGeoJson
  ]);

  return {

    // Legacy compatibility
    geoFeatures: primaryFeatures,
    simplifiedWorldGeoJson,

    // New multi-layer approach
    baseLayerFeatures,
    overlayFeatures,
    worldGeoJson,
    countryOverlayGeoJson,

    // Loading states
    isGeoLoading: isLoading,
    isGeoFetching: isCountryOverlayLoading,
    isGeoSimpleLoading,
    isWorldLoading,
    isCountryOverlayLoading,

    // View state
    currentView,
    hasOverlay:
      'country' === currentView.level &&
      0 < countryOverlayGeoJson?.features?.length,

    geoError: null // TODO: Add proper error handling
  };
};
