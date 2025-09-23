import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getFields, setFields } from '@/utils/api';
import { toast } from 'react-toastify';

/**
 * Custom hook for managing settings data using Tanstack Query.
 * This hook provides functions to fetch and update settings.
 *
 * @returns {Object} - An object containing settings data, update function, and status flags.
 */
const useSettingsData = () => {
  const queryClient = useQueryClient();

  // Query for fetching settings from server
  const query = useQuery({
    queryKey: [ 'settings_fields' ],
    queryFn: async() => {
      const fields = await getFields();
      return fields.fields;
    },

    // modify function
    staleTime: 1000 * 60 * 5, // 5 minutes
    initialData: window.burst_settings && window.burst_settings.fields,
    retry: 0,
    select: ( data ) => [ ...data ] // create a new array so dependencies are updated
  });

  const addNotice = ( settings_id, warning_type, message, title ) => {
    queryClient.setQueryData( [ 'settings_fields' ], ( oldData ) => {
      return oldData.map( ( field ) => {
        if ( field.id !== settings_id ) return field;

        const updatedNotice = {
          title,
          label: warning_type,
          description: message,
        };

        return {
          ...field,
          notice: updatedNotice,
        };
      });
    });

    // Invalidate the query to refresh the data
    // queryClient.invalidateQueries([ 'settings_fields' ]);
  }
  
  const getValue = ( id ) => query.data.find( ( field ) => field.id === id )?.value;
  const setValue = ( id, value ) => {
    const field = query.data.find( ( field ) => field.id === id );
    if ( field ) {
      field.value = value;
    }
  };

  // Update Mutation for settings data with destructured values
  const { mutateAsync: saveSettings, isLoading: isSavingSettings } =
    useMutation({
      mutationFn: async( data ) => {
        // Simulate async operation (e.g., API call to save settings)
        await setFields( data );

        // invalidate the query so the new data is fetched
        await queryClient.invalidateQueries([ 'settings_fields' ]);
      },
      onSuccess: () => {
        toast.success( 'Settings saved' );
      }
    });

  return {
    settings: query.data,
    saveSettings,
    getValue,
    addNotice,
    setValue,
    isSavingSettings,
    invalidateSettings: () =>
      queryClient.invalidateQueries([ 'settings_fields' ])
  };
};

export default useSettingsData;
