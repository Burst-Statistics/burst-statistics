import React, { useEffect } from 'react';
import { toast, ToastContentProps, Id } from 'react-toastify';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import { getLocalStorage, setLocalStorage } from '@/utils/api';
import { burst_get_website_url } from '@/utils/lib';
import useLicenseData from "@/hooks/useLicenseData";

interface TrialPopupProps {
    type?: string;
}

const TrialToastContent: React.FC<
    ToastContentProps & {
    title: string;
    description: string;
    url: string;
}
> = ( { title, description, url } ) => (
    <div className="flex items-start gap-3">
        <div className="inline-flex rounded-full bg-green-light border border-gray-100 transition-colors p-1">
            <Icon color="green" name="sprout" size={14} strokeWidth={2} />
        </div>

        <div className="flex-1">
            <h5 className="font-semibold text-gray-900 mb-1">{title}</h5>
            <p className="text-sm text-gray-600 mb-2">
                {
                    sprintf(
                        // translators: %s is description of the trial feature.
                        __( '%s Enjoy full access for the remainder of your trial.', 'burst-statistics' ),
                        description,
                    )
                }
            </p>

            <a
                href={ url }
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
                {
                    __( 'Compare all plans', 'burst-statistics' )
                }
            </a>
        </div>
    </div>
);

const TrialPopup: React.FC<TrialPopupProps> = ( { type = 'sources' } ) => {
    const { isTrial } = useLicenseData();

    if ( ! isTrial ) {
        return null;
    }

    useEffect(() => {
        const isDismissed = getLocalStorage( `trial_popup_${type}_dismissed`, false ) as boolean;
        if ( isDismissed ) {
            return;
        }

        showTrialToast();
    }, [] );

    const showTrialToast = () => {
        let title: string;
        let description: string;

        switch ( type ) {
            case 'sources':
                title = __( "You're exploring the Sources dashboard", 'burst-statistics' );
                description = __( 'A key feature of our all premium plans.', 'burst-statistics' );
                break;
            case 'reporting':
                title = __( "You're exploring the Reporting dashboard", 'burst-statistics' );
                description = __( 'A key feature of our Agency plan.', 'burst-statistics' );
                break;
            default:
                title = __( "You're exploring the Sales dashboard", 'burst-statistics' );
                description = __( 'A key feature of our Business and Agency plans.', 'burst-statistics' );
                break;
        }

        const url = burst_get_website_url( 'pricing/#pricing', {
            utm_source: 'trial-popup',
            utm_content: type,
        } );

        const toastId: Id = toast(
            ( { toastProps } ) => (
                <TrialToastContent
                    toastProps={ toastProps }
                    title={ title }
                    description={ description }
                    url={ url }
                />
            ),
        );

        // Listen for toast dismissal (either manually or via toast.dismiss)
        const unsubscribe = toast.onChange( ( event ) => {
            if ( event.id === toastId && event.status === 'removed' ) {
                setLocalStorage( `trial_popup_${type}_dismissed`, true );
                unsubscribe();
            }
        });
    };

    return null;
};

export default TrialPopup;
