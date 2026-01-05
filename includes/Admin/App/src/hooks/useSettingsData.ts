import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getFields, setFields } from '@/utils/api';
import { toast } from 'react-toastify';
import useLicenseData from '@/hooks/useLicenseData';
import { __ } from '@wordpress/i18n';

interface SettingField {
	id: string;
	value: any; // eslint-disable-line @typescript-eslint/no-explicit-any
	[key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface UseSettingsDataResult {
	settings: SettingField[] | undefined;
	saveSettings: ( data: any ) => Promise<void>; // eslint-disable-line @typescript-eslint/no-explicit-any
	getValue: ( id: string ) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
	addNotice: (
		settings_id: string,
		warning_type: string,
		message: string,
		title: string
	) => void;
	setValue: ( id: string, value: any ) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
	isSavingSettings: boolean;
}

/**
 * Custom hook for managing settings data using Tanstack Query.
 * This hook provides functions to fetch and update settings.
 */
const useSettingsData = (): UseSettingsDataResult => {
	const queryClient = useQueryClient();
	const { isLicenseValid } = useLicenseData();

	// Query for fetching settings from server
	const query = useQuery<SettingField[]>({
		queryKey: [ 'settings_fields' ],
		queryFn: async() => {
			const fields = await getFields();
			return fields.fields as SettingField[];
		},
		staleTime: 1000 * 60 * 5,
		initialData: ( window as any ).burst_settings?.fields as // eslint-disable-line @typescript-eslint/no-explicit-any
			| SettingField[]
			| undefined,
		retry: 0
	});

	const addNotice = (
		settings_id: string,
		warning_type: string,
		message: string,
		title: string
	) => {
		queryClient.setQueryData<SettingField[]>(
			[ 'settings_fields' ],
			( oldData ) => {
				if ( ! oldData ) {
					return oldData;
				}

				return oldData.map( ( field ) => {
					if ( field.id !== settings_id ) {
						return field;
					}

					const updatedNotice = {
						title,
						label: warning_type,
						description: message
					};

					return {
						...field,
						notice: updatedNotice
					};
				});
			}
		);
	};

	const getValue = ( id: string ) =>
		query.data?.find( ( field ) => field.id === id )?.value;

	const setValue = ( id: string, value: any ) => { // eslint-disable-line @typescript-eslint/no-explicit-any
		queryClient.setQueryData<SettingField[]>(
			[ 'settings_fields' ],
			( oldData ) => {
				if ( ! oldData ) {
					return oldData;
				}

				return oldData.map( ( field ) => {
					if ( field.id !== id ) {
						return field;
					}
					return {
						...field,
						value
					};
				});
			}
		);
	};

	// Update Mutation for settings data
	const { mutateAsync: saveSettings, isPending: isSavingSettings } =
		useMutation<void, Error, any>({ // eslint-disable-line @typescript-eslint/no-explicit-any
			mutationFn: async( data: any ) => { // eslint-disable-line @typescript-eslint/no-explicit-any
				await setFields( data );
			},
			onSuccess: async() => {
				toast.success( __( 'Settings saved', 'burst-statistics' ) );

				await queryClient.invalidateQueries({
					queryKey: [ 'settings_fields' ],
					refetchType: 'active'
				});
			}
		});

	// Memoize settings to only create new objects when data actually changes.
	const settings = useMemo( () => {
		const settingsData = query.data;
		if ( 'undefined' === typeof settingsData ) {
			return settingsData;
		}

		// Parse the fields list. Any blocked pro features get unblocked here.
		return settingsData.map( ( field ) => {
			if ( field.pro && isLicenseValid ) {
				return { ...field, ...field.pro };
			}
			return field;
		});
	}, [ query.data, isLicenseValid ]);

	return {
		settings,
		saveSettings,
		getValue,
		addNotice,
		setValue,
		isSavingSettings
	};
};

export default useSettingsData;
