import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { doAction } from '@/utils/api';

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
 * Interface for upgrade option.
 */
interface LicenseUpgrade {
    sites: number | 'unlimited';
    tier: string;
    url: string;
}

/**
 * Interface for license data response.
 */
interface LicenseData {
    licenseStatus: string;
    notices: LicenseNotice[];
    hasSubscriptionInfo: boolean;
    subscriptionExpiration: number;
    subscriptionStatus: string;
    licenseExpiration: number;
    tier: string;
    trialEndTime: number;
    isTrial: boolean;
    upgrades: LicenseUpgrade[];
    activationLimit?: number;
    activationsLeft?: number;
    licenseExpiresDate?: string;
    licenseIsLifetime?: boolean;
    encryptedLicenseKey?: string;
}

/**
 * Interface for the hook's return value.
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
    activateLicense: ( fieldName: string, fieldValue: string ) => void;
    deactivateLicense: () => void;
    isLicenseValidFor: ( id: string ) => boolean;
    isTrial: boolean;
    trialRemainingDays: number;
    trialExpired: boolean;
    subscriptionExpiresTwoWeeks: boolean;
    licenseExpirationRemainingDays: number;
    licenseExpiresTwoWeeks: boolean;
    licenseInactive: boolean;
    licenseActivated: boolean;
    upgrades: LicenseUpgrade[];
    tier: string;
    activationLimit: number;
    activationsLeft: number;
    licenseExpiresDate: string;
    licenseIsLifetime: boolean;
    encryptedLicenseKey: string;
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
 * @return {UseLicenseDataReturn} License data and mutation functions
 */
const useLicenseData = (): UseLicenseDataReturn => {
	const queryClient = useQueryClient();

	// Get initial values from window object
	const isPro = '1' === window.burst_settings?.is_pro;

    // Fetch license notices and status
    const { data, isFetching } = useQuery<LicenseData>({
        queryKey: [ 'licenseNotices' ],
        queryFn: () => doAction( 'license_notices', {}),
        enabled: isPro,

        // Use initial data from window object to avoid flash of loading state
        placeholderData: (): LicenseData => ({
            licenseStatus: window.burst_settings?.licenseStatus ?? '',
            notices: [],
            hasSubscriptionInfo: false,
            subscriptionExpiration: 0,
            subscriptionStatus: '',
            licenseExpiration: 0,
            tier: window.burst_settings?.tier ?? '',
            trialEndTime: 0,
            isTrial: false,
            upgrades: [],
            activationLimit: window.burst_settings?.activationLimit ?? 1,
            activationsLeft: window.burst_settings?.activationsLeft ?? 0,
            licenseExpiresDate: window.burst_settings?.licenseExpiresDate ?? '',
            licenseIsLifetime: window.burst_settings?.licenseIsLifetime ?? false,
            encryptedLicenseKey: ''
        })
    });

    // Mutation for activating/deactivating license
    const { mutate: mutateLicense, isPending: isLicenseMutationPending } = useMutation({
        mutationFn: async({
                               action,
                               fieldName,
                               fieldValue
                           }: {
            action: 'activate' | 'deactivate';
            fieldName?: string;
            fieldValue?: string;
        }) => {
            if ( 'activate' === action && fieldName && fieldValue ) {
                return doAction( 'activate_license', {license: fieldValue});
            } else {
                return doAction( 'deactivate_license', {});
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [ 'licenseNotices' ] });
        }
    });

	// Determine license notices to display
	let licenseNotices: LicenseNotice[];

	if ( isFetching || isLicenseMutationPending ) {
		licenseNotices = [
			{
				icon: 'loading',
				label: 'loading',
				msg: 'Loading...'
			}
		];
	} else {
		licenseNotices = data?.notices || [];
	}

    // Get current license status from React Query cache
    const licenseStatus = data?.licenseStatus ?? '';
    const hasSubscriptionInfo = data?.hasSubscriptionInfo ?? false;
    const subscriptionStatus = data?.subscriptionStatus ?? '';
    const subscriptionExpiration = data?.subscriptionExpiration ?? 0;
    const licenseExpiration = data?.licenseExpiration ?? 0;
    const tier = data?.tier ?? '';
    const trialEndTime = data?.trialEndTime ?? 0;
    const upgrades = data?.upgrades ?? [];

	// Compute license validation status
	const isLicenseValid = 'valid' === licenseStatus && isPro;

	// Compute time-based derived values
	const now = Math.floor( Date.now() / 1000 );

	const trialRemainingDays =
		0 < trialEndTime ? Math.ceil( ( trialEndTime - now ) / ( 60 * 60 * 24 ) ) : 0;

	const trialExpired =
		0 < trialEndTime &&
		now > trialEndTime &&
		now <= trialEndTime + 4 * 7 * 24 * 60 * 60 && // Max 4 weeks after trial expiration
		! isLicenseValid;

	const subscriptionRemainingDays =
		0 < subscriptionExpiration ?
			Math.max(
					0,
					Math.ceil( ( subscriptionExpiration - now ) / ( 60 * 60 * 24 ) )
				) :
			0;

	const subscriptionExpiresTwoWeeks =
		0 < subscriptionExpiration &&
		14 >= subscriptionRemainingDays &&
		0 < subscriptionRemainingDays;

	const licenseExpirationRemainingDays =
		0 < licenseExpiration ?
			Math.max( 0, Math.ceil( ( licenseExpiration - now ) / ( 60 * 60 * 24 ) ) ) :
			0;

	const licenseExpiresTwoWeeks =
		0 < licenseExpiration &&
		14 >= licenseExpirationRemainingDays &&
		0 < licenseExpirationRemainingDays;

	const licenseInactive =
		isPro &&
		( 'deactivated' === licenseStatus ||
			'site_inactive' === licenseStatus ||
			'inactive' === licenseStatus );
	const licenseActivated = ! licenseInactive;

	// Compute if currently in trial (based on remaining days)
	const isTrial = 0 < trialRemainingDays;

	// Helper functions for activating/deactivating
	const activateLicense = ( fieldName: string, fieldValue: string ) => {
		mutateLicense({ action: 'activate', fieldName, fieldValue });
	};

	const isLicenseValidFor = ( id: string ): boolean => {
        if ( ! isPro ) {
            return false;
        }

		if ( ! licenseActivated ) {
			return false;
		}

		if ( isTrial ) {
			return true;
		}

		if ( ! isLicenseValid ) {
			return false;
		}

		if ( 'sources' === id ) {
			return isLicenseValid;
		}

		if ( 'sales' === id ) {
			return 'agency' === tier || 'business' === tier;
		}

        if ( 'share-link' === id ) {
            return 'agency' === tier;
        }

		//all other options when license is valid.
		return true;
	};

	const deactivateLicense = () => {
		mutateLicense({ action: 'deactivate' });
	};

    const activationLimit = data?.activationLimit ?? 1;
    const activationsLeft = data?.activationsLeft ?? 0;
    const licenseExpiresDate = data?.licenseExpiresDate ?? '';
    const licenseIsLifetime = data?.licenseIsLifetime ?? false;
    const encryptedLicenseKey = data?.encryptedLicenseKey ?? '';

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
        upgrades,
        tier,
        activationLimit,
        activationsLeft,
        licenseExpiresDate,
        licenseIsLifetime,
        encryptedLicenseKey
    };
};

export default useLicenseData;
export type { LicenseNotice, LicenseData, UseLicenseDataReturn, LicenseUpgrade };
