/**
 * Ecommerce Notices
 */
import React, { useEffect } from "react";
import { toast, ToastContentProps, Id } from "react-toastify";
import { __, sprintf } from "@wordpress/i18n";
import Icon from "@/utils/Icon";
import { getLocalStorage, setLocalStorage } from "@/utils/api";
import { burst_get_website_url } from "@/utils/lib";

/**
 * Generic Ecommerce Notice Toast Layout
 */
const EcommerceNoticeToast: React.FC<
    ToastContentProps & {
    title: string;
    description: string;
    linkText?: string;
    url?: string;
    icon?: string;
    color?: string;
}
> = ( { title, description, linkText, url, icon = "chart-line", color = "blue" } ) => (
    <div className="flex items-start gap-3">
		<div className="inline-flex rounded-full bg-green-light border border-gray-100 transition-colors p-1">
			<Icon color={color} name={icon} size={16} strokeWidth={2} />
		</div>

		<div className="flex-1">
			<h5 className="font-semibold text-gray-900 mb-1">{ title }</h5>
			<p className="text-sm text-gray-600 mb-2">{ description }</p>

            { url && (
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
					{ linkText || __( "Read more", "burst-statistics" ) }
				</a>
            ) }
		</div>
	</div>
);

/**
 * Ecommerce Notices Controller
 */
export const EcommerceNotices: React.FC = () => {
    useEffect( () => {
        const notices = getEcommerceNotices();

        notices.forEach( ( notice ) => {
            const isDismissed = getLocalStorage( `${notice.key}_dismissed`, false ) as boolean;
            if ( notice.shouldShow && ! isDismissed && ! toast.isActive( notice.key ) ) {
                showEcommerceToast( notice );
            }
        });
    }, [] );

    /**
     * Show toast for a specific notice
     */
    const showEcommerceToast = ( notice: EcommerceNotice ) => {
        toast( ( { toastProps } ) => (
            <EcommerceNoticeToast
                toastProps={ toastProps }
                title={ notice.title }
                description={ notice.description }
                linkText={ notice.linkText }
                url={ notice.url }
                icon={ notice.icon }
                color={ notice.color }
            />
        ), { toastId: notice.key } );

        const unsubscribe = toast.onChange( ( event ) => {
            if ( event.id === notice.key && event.status === "removed" ) {
                setLocalStorage( `${notice.key}_dismissed`, true );
                unsubscribe();
            }
        });
    };

    return null;
};

/**
 * Notice type definition
 */
interface EcommerceNotice {
    key: string;
    title: string;
    description: string;
    linkText?: string;
    url?: string;
    icon?: string;
    color?: string;
    shouldShow: boolean;
}

/**
 * Helper: define all ecommerce notices in one central place
 */
const getEcommerceNotices = (): EcommerceNotice[] => {
    const activationTime = window.burst_settings?.ecommerceActivationTime;
    const notices: EcommerceNotice[] = [];

    if ( activationTime ) {
        let timestamp = Number( activationTime );
        if ( timestamp < 1e12 ) {
            timestamp *= 1000; // Convert seconds → milliseconds
        }

        const formattedDate = new Date( timestamp ).toLocaleDateString( undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
        } );

        const docsUrl = burst_get_website_url( "new-feature-woocommerce-insights", {
            utm_source: "ecommerce-notice",
            utm_medium: "toast",
            utm_content: "sales-tracking",
        });

        notices.push( {
            key: "ecommerce_activation_notice",
            title: sprintf(
                __( "Sales data is available for visits after %s.", "burst-statistics" ),
                formattedDate
            ),
            description: __(
                "Sales tracking is a new feature, so this data is only available for visits recorded after it was enabled.",
                "burst-statistics"
            ),
            linkText: __( "Read more", "burst-statistics" ),
            url: docsUrl,
            icon: "campaign",
            color: "blue",
            shouldShow: true,
        });
    }

    return notices;
};
