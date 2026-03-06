import React from 'react';
import {__} from '@wordpress/i18n';
import {burst_get_website_url} from '@/utils/lib';
import useLicenseData from '@/hooks/useLicenseData';
import Icon from '@/utils/Icon';

interface ProBadgeProps {
    id?: string;
    className?: string;
    label?: string;
    url?: string;
    type?: string; //icon or badge
    hasLink?: boolean;
}

/**
 * ProBadge Component
 *
 * A reusable component to display a clickable "Pro" badge.
 *
 * @param props           - Component props
 * @param props.id        - ID for tracking purposes (optional)
 * @param props.className - Additional classes to apply to the badge (optional)
 * @param props.label     - Label instead of Burst Pro (optional)
 * @param props.url       - URL to navigate to when clicked (optional)
 * @param props.type      - URL to navigate to when clicked (optional)
 * @param props.hasLink      - If the result should be a link or not (optional)
 * @return JSX.Element
 */
const ProBadge: React.FC<ProBadgeProps> = ({
                                               id = '',
                                               className = '',
                                               url,
                                               label,
                                               type = 'badge',
                                               hasLink = true
                                           }) => {
    const {isTrial, isLicenseValidFor} = useLicenseData();

    if ( ! isTrial && isLicenseValidFor( id ) ) {
        return null;
    }
    let finalUrl = url;
    if ( ! finalUrl ) {
        finalUrl = burst_get_website_url( 'pricing', {
            utm_source: 'pro-badge',
            utm_content: id || 'empty-content'
        });
    }

    const altText = isTrial ?
        __( 'Enjoy full access for the remainder of your trial.', 'burst-statistics' ) :
        __( 'Unlock this feature with Pro. Upgrade for more insights and control.', 'burst-statistics' );

    if ( 'icon' === type ) {
        const iconContent = <Icon color="green" name="sprout" size={14} strokeWidth={1.5}/>;
        const iconClassName = 'inline-flex items-center px-0.5 py-0.5 inline-flex rounded-full bg-green-light border border-gray-100 transition-colors';

        return hasLink ? (
            <a href={finalUrl} className={iconClassName} title={altText}>
                {iconContent}
            </a>
        ) : (
            <div className={iconClassName} title={altText}>
                {iconContent}
            </div>
        );
    }

    const badgeClassName = `inline-flex items-center rounded bg-primary px-2 py-0.5 text-xs font-medium text-white transition-colors ${className}`;

    // Not translated because it's a brand name
    const badgeContent = label || 'Burst Pro';

    return hasLink ? (
        <a href={finalUrl} className={badgeClassName} title={altText}>
            {badgeContent}
        </a>
    ) : (
        <div className={badgeClassName} title={altText}>
            {badgeContent}
        </div>
    );
};

export default ProBadge;
