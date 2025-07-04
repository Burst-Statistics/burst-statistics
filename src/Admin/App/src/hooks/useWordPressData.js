import { useCallback } from 'react';
import { useSelect, useDispatch } from '@wordpress/data';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import '@wordpress/core-data';

/**
 * Custom hook for accessing WordPress site settings data
 * using the WordPress data store with Tanstack Query caching.
 * 
 * @param {Object} options - Hook configuration options
 * @param {Array|String} options.fields - Optional specific field(s) to extract from site settings
 * @returns {Object} - Site settings data and utility functions
 */
const useWordPressData = ({ fields } = {}) => {
  const queryClient = useQueryClient();
  
  // Get the current site data directly via useSelect hook
  const wpSiteInfo = useSelect((select) => {
    return select('core').getEntityRecord('root', 'site');
  }, []);
  
  // Get the loading state
  const wpIsLoading = useSelect((select) => {
    return select('core/data').isResolving('core', 'getEntityRecord', ['root', 'site']);
  }, []);
  
  // Get dispatch functions for refreshing
  const { invalidateResolution } = useDispatch('core/data');

  // Callback to fetch site data (for Tanstack Query)
  const fetchSiteData = useCallback(async () => {
    // If data is already available, return it
    if (wpSiteInfo) {
      return wpSiteInfo;
    }
    
    // Otherwise, return a promise that resolves when data becomes available
    return new Promise((resolve) => {
      const unsubscribe = wp.data.subscribe(() => {
        const siteData = wp.data.select('core').getEntityRecord('root', 'site');
        if (siteData) {
          unsubscribe();
          resolve(siteData);
        }
      });
    });
  }, [wpSiteInfo]);

  // Use Tanstack Query to handle caching the WordPress data
  const { 
    data: siteInfo, 
    isLoading: queryIsLoading,
    refetch 
  } = useQuery({
    queryKey: ['wordpressData', 'siteInfo'],
    queryFn: fetchSiteData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    // Use the data from WordPress store as initial data
    initialData: wpSiteInfo,
  });

  // Refresh site data function
  const refreshSiteInfo = useCallback(async () => {
    // Invalidate the WordPress data store resolution
    invalidateResolution('core', 'getEntityRecord', ['root', 'site']);
    
    // Refetch data with Tanstack Query
    await refetch();
    
    // Also invalidate the query cache
    queryClient.invalidateQueries(['wordpressData', 'siteInfo']);
  }, [invalidateResolution, refetch, queryClient]);

  // Use either the Tanstack Query data or the direct WordPress data
  const finalSiteInfo = siteInfo || wpSiteInfo;
  const isLoading = queryIsLoading || wpIsLoading;

  // If specific fields are requested and site data is available, extract only those fields
  if (fields && finalSiteInfo) {
    // Handle both single field as string and array of fields
    const fieldsArray = Array.isArray(fields) ? fields : [fields];
    
    // Build an object with just the requested fields
    const extractedFields = fieldsArray.reduce((result, field) => {
      if (field in finalSiteInfo) {
        result[field] = finalSiteInfo[field];
      }
      return result;
    }, {});

    return {
      siteInfo: finalSiteInfo, // Keep the full object for compatibility
      isLoading,
      refreshSiteInfo,
      ...extractedFields // Add individual fields directly to the result
    };
  }

  // Return the full site info object
  return {
    siteInfo: finalSiteInfo,
    isLoading,
    refreshSiteInfo
  };
};

export default useWordPressData; 