import useLicenseData from "@/hooks/useLicenseData";
import {__, sprintf} from '@wordpress/i18n';
import Icon from "@/utils/Icon";
import {createInterpolateElement} from '@wordpress/element';
import {motion} from 'framer-motion';

const SubscriptionHeader = (props: any) => {

    const {
        isPro,
        hasSubscriptionInfo,
        subscriptionStatus,
        isLicenseValid,
        trialRemainingDays,
        trialExpired,
        subscriptionExpiresTwoWeeks,
        licenseExpirationRemainingDays,
        licenseExpiresTwoWeeks,
        licenseInactive,
        isTrial,
    } = useLicenseData();

    if (!isPro) {
        return null;
    }
    if (!hasSubscriptionInfo) {
        return null;
    }

    if (subscriptionStatus === 'active' && !subscriptionExpiresTwoWeeks) {
        return null;
    }

    let showSubscriptionHeader = false;

    //defaults for trial.
    let iconColor = 'red';
    let bgColor = 'bg-red-light';
    let icon = 'warning-triangle';
    let text = createInterpolateElement(
        sprintf(
            __('You\'re enjoying a full-featured trial with <highlight>%d days left.</highlight> It includes premium features from our higher tiers.', 'burst-statistics'),
            trialRemainingDays
        ),
        {
            highlight: <strong className="font-semibold text-emerald-700"/>
        }
    );

    if (isTrial) {
        iconColor = 'green';
        bgColor = 'bg-green-light';
        icon = 'sprout';
        showSubscriptionHeader = true;
    } else
    //no subscription, and expiring within 2 weeks.
    if (subscriptionStatus === 'cancelled' && trialExpired) {
        text = __('Your trial has ended. Upgrade now to reactivate premium features.', 'burst-statistics')
        showSubscriptionHeader = true;
    } else
    //no subscription, and expiring within 2 weeks.
    if (subscriptionStatus === 'cancelled' && licenseExpiresTwoWeeks) {
        text = createInterpolateElement(
            sprintf(
                __('Your license is <highlight>expiring in %d days.</highlight> Upgrade now to reactivate premium features.', 'burst-statistics'),
                licenseExpirationRemainingDays
            ),
            {
                highlight: <strong className={"font-semibold"}/>
            }
        );
        showSubscriptionHeader = true;
    } else
    //no subscription, and expired license.
    if (subscriptionStatus !== 'active' && !isLicenseValid) {
        text = __('Your license has expired. Upgrade now to reactivate premium features.', 'burst-statistics')
        showSubscriptionHeader = true;
    }

    //no subscription, and expired license.
    if (licenseInactive) {
        text = __('Activate your license to access premium features.', 'burst-statistics')
        showSubscriptionHeader = true;
    }

    if (showSubscriptionHeader) {
        return (
            <motion.div 
                className={"flex border-b border-gray-200 " + bgColor}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                    duration: 0.5,
                    ease: "easeOut"
                }}
            >
                <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-5 px-5 py-2.5">
                    <div className="flex items-center gap-2.5 text-sm text-gray-700">
                        <motion.div
                            className="flex items-center justify-center w-5 h-5 rounded-full bg-white border border-gray-100"
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ 
                                duration: 0.6,
                                delay: 0.2,
                                ease: "easeOut"
                            }}
                        >
                            <Icon color={iconColor} name={icon} size={14} strokeWidth={2}/>
                        </motion.div>
                        <span>
                            {text}
                        </span>
                    </div>
                    <a href="https://burst-statistics.com/account"
                       className="text-sm font-medium text-blue-600 hover:text-blue-700 underline hover:underline whitespace-nowrap">
                        {__('Manage subscription', 'burst-statistics')}
                    </a>
                </div>
            </motion.div>
        )
    }

    return null;
}
export default SubscriptionHeader;