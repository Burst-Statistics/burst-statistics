import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {getFields, setFields} from '@/utils/api';
import {toast} from 'react-toastify';
import useLicenseStore from "@/store/useLicenseStore";

interface SettingField {
    id: string;
    value: any;

    [key: string]: any;
}

interface UseSettingsDataResult {
    settings: SettingField[] | undefined;
    saveSettings: (data: any) => Promise<void>;
    getValue: (id: string) => any;
    addNotice: (settings_id: string, warning_type: string, message: string, title: string) => void;
    setValue: (id: string, value: any) => void;
    isSavingSettings: boolean;
    invalidateSettings: () => Promise<void>;
}

/**
 * Custom hook for managing settings data using Tanstack Query.
 * This hook provides functions to fetch and update settings.
 */
const useSettingsData = (): UseSettingsDataResult => {
    const queryClient = useQueryClient();
    const {isLicenseValid} = useLicenseStore();

    // Query for fetching settings from server
    const query = useQuery<SettingField[]>({
        queryKey: ['settings_fields'],
        queryFn: async () => {
            const fields = await getFields();
            console.log(fields);
            return fields.fields as SettingField[];
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        initialData: (window as any).burst_settings?.fields as SettingField[] | undefined,
        retry: 0,
        select: (data) => [...data], // create a new array so deps are updated
    });

    const addNotice = (settings_id: string, warning_type: string, message: string, title: string) => {
        queryClient.setQueryData<SettingField[]>(['settings_fields'], (oldData) => {
            if (!oldData) return oldData;

            return oldData.map((field) => {
                if (field.id !== settings_id) return field;

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
    };

    const getValue = (id: string) =>
        query.data?.find((field) => field.id === id)?.value;

    const setValue = (id: string, value: any) => {
        if (!query.data) return;
        const field = query.data.find((field) => field.id === id);
        if (field) {
            field.value = value;
        }
    };

    // Update Mutation for settings data
    const {mutateAsync: saveSettings, isPending: isSavingSettings} = useMutation<void, Error, any>({
        mutationFn: async (data: any) => {
            await setFields(data);
            await queryClient.invalidateQueries({queryKey: ['settings_fields']});
        },
        onSuccess: () => {
            toast.success('Settings saved');
        },
    });

    const getSettings = () => {
        const settings = query.data;
        if (typeof settings === 'undefined') {
            return settings;
        }
        //parse the fields list. Any blocked pro features get unblocked here.
        settings.forEach((field) => {
            if (field.pro && isLicenseValid()) {
                Object.assign(field, field.pro);
            }
        });

        return settings;
    }

    return {
        settings: getSettings(),
        saveSettings,
        getValue,
        addNotice,
        setValue,
        isSavingSettings,
        invalidateSettings: () =>
            queryClient.invalidateQueries({queryKey: ['settings_fields']}),
    };
};

export default useSettingsData;
