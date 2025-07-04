import { useState, useCallback, useMemo, useRef } from '@wordpress/element';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { feature } from 'topojson-client';
import { getJsonData } from '../utils/api';

// Constants
const MAPS_BASE_PATH = burst_settings.plugin_url + 'src/Pro/assets/maps';
const WORLD_GEO_URL = `${MAPS_BASE_PATH}/world`;
const COUNTRY_GEO_URL = `${MAPS_BASE_PATH}/countries`;



// Query keys for better cache management
const QUERY_KEYS = {
  worldMapSimplified: 'world_map_simplified',
  worldMap: 'world_map',
  countryMap: (countryCode) => ['country_map', countryCode],
};

/**
/**
 * Hook for fetching and converting map data to GeoJSON
 */
const useGeoJsonMaps = () => {
  const viewLevel = useMapStore((state) => state.viewLevel);
  const setViewLevel = useMapStore((state) => state.setViewLevel);
  const queryClient = useQueryClient();
  const isFirstRender = useRef(true);

  // Fetch world map data (simplified version for initial loading)
  const worldMapSimplifiedQuery = useQuery({
    queryKey: [QUERY_KEYS.worldMapSimplified],
    queryFn: fetchWorldMapSimplified,
    staleTime: Infinity,
    cacheTime: 1000 * 60 * 60,
  });

  // Fetch detailed world map data
  const worldMapQuery = useQuery({
    queryKey: [QUERY_KEYS.worldMap],
    queryFn: fetchWorldMap,
    staleTime: Infinity,
    cacheTime: 1000 * 60 * 60,
  });

  // Fetch country map data conditionally
  const countryMapQuery = useQuery({
    queryKey: QUERY_KEYS.countryMap(selectedCountry),
    queryFn: () => fetchCountryMap(selectedCountry),
    enabled: !!selectedCountry,
    staleTime: Infinity,
    cacheTime: 1000 * 60 * 60,
  });

  // Convert TopoJSON to GeoJSON for all map types
  const worldGeoJsonSimplified = useMemo(
    () => convertTopoToGeo(worldMapSimplifiedQuery.data),
    [worldMapSimplifiedQuery.data]
  );

  const worldGeoJson = useMemo(
    () => convertTopoToGeo(worldMapQuery.data),
    [worldMapQuery.data]
  );

  const countryGeoJson = useMemo(
    () => countryMapQuery.data ? convertTopoToGeo(countryMapQuery.data) : { type: 'FeatureCollection', features: [] },
    [countryMapQuery.data, selectedCountry]
  );

  // Function to select a country and fetch its map
  const selectCountry = useCallback((countryCode) => {
    // Skip if it's the same country to avoid unnecessary re-renders
    if (selectedCountry === countryCode) return;

    setSelectedCountry(countryCode);
    
    // Only prefetch if the code exists and we don't already have the data
    if (countryCode && !queryClient.getQueryData(QUERY_KEYS.countryMap(countryCode))) {
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.countryMap(countryCode),
        queryFn: () => fetchCountryMap(countryCode),
      });
    }
  }, [selectedCountry, queryClient]);

  // Reset to world map view
  const resetToWorldMap = useCallback(() => {
    setSelectedCountry(null);
  }, []);

  // Protect against first render side-effects
  if (isFirstRender.current) {
    isFirstRender.current = false;
  }

  // Detailed loading states for each map type
  const isWorldMapSimplifiedLoading = worldMapSimplifiedQuery.isLoading;
  const isWorldMapSimplifiedLoaded = !isWorldMapSimplifiedLoading && !!worldMapSimplifiedQuery.data;
  const isWorldMapLoading = worldMapQuery.isLoading;
  const isCountryMapLoading = selectedCountry && countryMapQuery.isLoading;

  // Overall loading state
  const isLoading = isWorldMapSimplifiedLoading || isWorldMapLoading || isCountryMapLoading;
  
  // Error states
  const isWorldMapSimplifiedError = worldMapSimplifiedQuery.isError;
  const isWorldMapError = worldMapQuery.isError;
  const isCountryMapError = selectedCountry && countryMapQuery.isError;
  const isError = isWorldMapSimplifiedError || isWorldMapError || isCountryMapError;

  const error = 
    worldMapSimplifiedQuery.error || 
    worldMapQuery.error || 
    (selectedCountry && countryMapQuery.error);

  return {
    // Map data
    worldMapData: worldMapQuery.data,
    worldMapSimplifiedData: worldMapSimplifiedQuery.data,
    countryMapData: countryMapQuery.data,
    
    // GeoJSON objects
    worldGeoJson,
    worldGeoJsonSimplified,
    countryGeoJson,
    
    // Current selection
    selectedCountryCode: selectedCountry,
    
    // Actions
    selectCountry,
    resetToWorldMap,
    
    // Detailed loading states
    isWorldMapSimplifiedLoading,
    isWorldMapSimplifiedLoaded,
    isWorldMapLoading,
    isCountryMapLoading,
    
    // Status
    isCountryView: !!selectedCountry,
    isLoading,
    isError,
    
    // Detailed error states
    isWorldMapSimplifiedError,
    isWorldMapError,
    isCountryMapError,
    error,
  };
};

export default useGeoJsonMaps;


  /**
  * Converts TopoJSON to GeoJSON features
  */
const convertTopoToGeo = (topoData, objectName = 'features') => {
 if (!topoData || !topoData.objects || !topoData.objects[objectName]) {
   return { type: 'FeatureCollection', features: [] };
 }
 
 const geoJson = feature(topoData, topoData.objects[objectName]);
 
 // Include the transform object from the topoData if it exists
 if (topoData.transform) {
   geoJson.transform = topoData.transform;
 }
 
 return geoJson;
};

/**
* Fetches world map topology data in simplified format
*/
const fetchWorldMapSimplified = async () => {
 const url = `${WORLD_GEO_URL}/world_loading.json`;
 return getJsonData(url);
};

/**
* Fetches world map topology data
*/
const fetchWorldMap = async () => {
 const url = `${WORLD_GEO_URL}/world.json`;
 return getJsonData(url);
};

/**
* Fetches country map topology data
*/
const fetchCountryMap = async (countryCode) => {
 if (!countryCode) {
   throw new Error('Country code is required');
 }
 const url = `${COUNTRY_GEO_URL}/${countryCode}.json`;
 return getJsonData(url);
};
