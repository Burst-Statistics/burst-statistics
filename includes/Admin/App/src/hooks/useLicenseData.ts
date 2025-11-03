import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { doAction } from '@/utils/api';
import useSettingsData from '@/hooks/useSettingsData';

/**
 * Interface for license notice object
 */
interface LicenseNotice {
    icon: 'warning' | 'open' | 'success' | 'loading';
    label: string;
    msg: string;
    url?: string;
}

/**
 * Interface for license data response
 */
interface LicenseData {
    licenseStatus: string;
    notices: LicenseNotice[];
    hasSubscriptionInfo: boolean;
    subscriptionExpiration: number;
    subscriptionStatus: string;
    licenseExpiration:number;
    tier:string;
    trialEndTime:number;
    isTrial:boolean;
}

/**
 * Interface for the hook's return value
 */
interface UseLicenseDataReturn {
    licenseNotices: LicenseNotice[];
    licenseStatus: string;
    hasSubscriptionInfo: boolean;
    subscriptionStatus: string;
    isFetching: boolean;
    isLicenseMutationPending: boolean;
    isLicenseValid: boolean;
    isPro: boolean;
    activateLicense: (fieldName: string, fieldValue: string) => void;
    deactivateLicense: () => void;
    isLicenseValidFor: ( id:string ) => boolean;
    isTrial: boolean;
    trialRemainingDays: number;
    trialExpired: boolean;
    subscriptionExpiresTwoWeeks: boolean;
    licenseExpirationRemainingDays: number;
    licenseExpiresTwoWeeks: boolean;
    licenseInactive: boolean;
    licenseActivated: boolean;
}

/**
 * Custom hook for managing license data
 *
 * This hook handles:
 * - Fetching license notices and status
 * - Activating licenses
 * - Deactivating licenses
 * - Providing license validation status
 *
 * Uses React Query as the single source of truth for license data.
 *
 * @returns {UseLicenseDataReturn} License data and mutation functions
 */
const useLicenseData = (): UseLicenseDataReturn => {
    const queryClient = useQueryClient();
    // Get initial values from window object
    const isPro = window.burst_settings?.is_pro === '1';

    // Fetch license notices and status
    const { data, isFetching } = useQuery<LicenseData>({
        queryKey: ['licenseNotices'],
        queryFn: () => doAction('license_notices', {}),
        enabled: isPro,
        // Use initial data from window object to avoid flash of loading state
        placeholderData: (): LicenseData => ({
            licenseStatus: window.burst_settings?.licenseStatus || '',
            notices: [],
            hasSubscriptionInfo: false,
            subscriptionExpiration: 0,
            subscriptionStatus: '',
            licenseExpiration:0,
            tier:window.burst_settings?.tier || '',
            trialEndTime:0,
            isTrial:false,
        }),
    });

    // Mutation for activating/deactivating license
    const { mutate: mutateLicense, isPending: isLicenseMutationPending } = useMutation({
        mutationFn: async ({
                               action,
                               fieldName,
                               fieldValue
                           }: {
            action: 'activate' | 'deactivate';
            fieldName?: string;
            fieldValue?: string;
        }) => {
            if (action === 'activate' && fieldName && fieldValue) {
                return doAction('activate_license', {license:fieldValue});
            } else {
                return doAction('deactivate_license', {});
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['licenseNotices'] });
        },
    });

    // Determine license notices to display
    let licenseNotices: LicenseNotice[];

    if ( isFetching || isLicenseMutationPending) {
        licenseNotices = [
            {
                icon: 'loading',
                label: 'loading',
                msg: 'Loading...',
            },
        ];
    } else {
        licenseNotices = data?.notices || [];
    }

    // Get current license status from React Query cache
    const licenseStatus = data?.licenseStatus || '';
    const hasSubscriptionInfo = data?.hasSubscriptionInfo || false;
    const subscriptionStatus = data?.subscriptionStatus || '';
    const subscriptionExpiration = data?.subscriptionExpiration || 0;
    const licenseExpiration = data?.licenseExpiration || 0;
    const tier = data?.tier || '';
    const trialEndTime = data?.trialEndTime || 0;

    // Compute license validation status
    const isLicenseValid = licenseStatus === 'valid' && isPro;

    // Compute time-based derived values
    const now = Math.floor(Date.now() / 1000);
    
    const trialRemainingDays = trialEndTime > 0
        ? Math.ceil((trialEndTime - now) / (60 * 60 * 24))
        : 0;

    const trialExpired = trialEndTime > 0
        && now > trialEndTime
        && now <= trialEndTime + (4 * 7 * 24 * 60 * 60) // Max 4 weeks after trial expiration
        && !isLicenseValid;

    const subscriptionRemainingDays = subscriptionExpiration > 0
        ? Math.max(0, Math.ceil((subscriptionExpiration - now) / (60 * 60 * 24)))
        : 0;

    const subscriptionExpiresTwoWeeks = subscriptionExpiration > 0
        && subscriptionRemainingDays <= 14
        && subscriptionRemainingDays > 0;

    const licenseExpirationRemainingDays = licenseExpiration > 0
        ? Math.max(0, Math.ceil((licenseExpiration - now) / (60 * 60 * 24)))
        : 0;

    const licenseExpiresTwoWeeks = licenseExpiration > 0
        && licenseExpirationRemainingDays <= 14
        && licenseExpirationRemainingDays > 0;

    const licenseInactive =
        isPro && (
        licenseStatus === 'deactivated' ||
        licenseStatus === 'site_inactive' ||
        licenseStatus === 'inactive');
    const licenseActivated = !licenseInactive;
    // Compute if currently in trial (based on remaining days)
    const isTrial = trialRemainingDays > 0;

    // Helper functions for activating/deactivating
    const activateLicense = (fieldName: string, fieldValue: string) => {
        mutateLicense({ action: 'activate', fieldName, fieldValue });
    };

    const isLicenseValidFor = ( id:string ): boolean => {
        if ( ! licenseActivated ) {
            return false;
        }

        if ( isTrial ) {
            return true;
        }

        if ( ! isLicenseValid ) {
            return false;
        }

        if ( id === 'sources') {
            return isLicenseValid;
        }

        if ( id === 'sales' ) {
            return tier === 'agency' || tier === 'business';
        }

        //all other options when license is valid.
        return true;
    }

    const deactivateLicense = () => {
        mutateLicense({ action: 'deactivate' });
    };

    return {
        licenseNotices,
        licenseStatus,
        isFetching,
        isLicenseMutationPending,
        isLicenseValid,
        isPro,
        activateLicense,
        deactivateLicense,
        hasSubscriptionInfo,
        subscriptionStatus,
        isTrial,
        trialRemainingDays,
        trialExpired,
        subscriptionExpiresTwoWeeks,
        licenseExpirationRemainingDays,
        licenseExpiresTwoWeeks,
        licenseInactive,
        licenseActivated,
        isLicenseValidFor,
    };
};

export default useLicenseData;
export type { LicenseNotice, LicenseData, UseLicenseDataReturn };