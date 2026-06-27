import { __, sprintf } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import {formatUnixToDate} from '@/utils/formatting';
import {burst_get_website_url} from '@/utils/lib';
import {useGeoStore} from '@/store/useGeoStore';
import {useEffect} from '@wordpress/element';
import useSettingsData from '@/hooks/useSettingsData';
import useLicenseData from '@/hooks/useLicenseData';
import {memo} from 'react';
const InCompleteDataNotice = memo( () => {
    const isIncompleteDataNoticeDismissed = useGeoStore( ( state ) => state.isIncompleteDataNoticeDismissed );
    const { getValue } = useSettingsData();
    const checkDismissalExpiry = useGeoStore( ( state ) => state.checkDismissalExpiry );
    const dismissIncompleteDataNotice = useGeoStore( ( state ) => state.dismissIncompleteDataNotice );

    // Free tracks country, Pro tracks city/region — derived from is_pro, not a
    // setting. Show the matching notice and its "available from" timestamp.
    const { isPro } = useLicenseData();
    const isCity = isPro;
    const availableTime = isCity ?
        getValue( 'update_to_city_geo_database_time' ) :
        getValue( 'country_geo_database_available_time' );

    // Check if dismissal has expired on component mount
    useEffect( () => {
        checkDismissalExpiry();
    }, [ checkDismissalExpiry ]);

    // Hidden when dismissed, and on fresh installs: the "available from" timestamp
    // is only set on an upgrade from an existing install.
    if ( isIncompleteDataNoticeDismissed || ! availableTime ) {
        return null;
    }

    const title = isCity ?
        sprintf(
            __( 'Region-level data is available for visits after %s.', 'burst-statistics' ),
            formatUnixToDate( availableTime )
        ) :
        sprintf(
            __( 'Country-level data is available for visits after %s.', 'burst-statistics' ),
            formatUnixToDate( availableTime )
        );

    const description = isCity ?
        __( 'Region tracking is a new feature, so this data is only available for visits recorded after it was enabled.', 'burst-statistics' ) :
        __( 'Country tracking is a new feature, so this data is only available for visits recorded after it was enabled.', 'burst-statistics' );

    const learnMoreSlug = isCity ? 'new-feature-region-tracking/' : 'new-feature-country-tracking/';

    return (
        <div className="absolute left-3 top-16 z-10 max-w-md">
            <div className="rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-sm shadow-sm transition-all hover:shadow-md">
                <div className="flex items-start gap-3">
                    <Icon
                        name="help"
                        size={16}
                        color="blue"
                        className="mt-0.5 shrink-0"
                    />
                    <div className="flex-1">
                        <div className="mb-2 text-text-black">
                            <p className="font-semibold">
                                {title}
                            </p>
                            <p className="mt-1">
                                {description}
                            </p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <a
                                href={burst_get_website_url(
                                    learnMoreSlug,
                                    {
                                        utm_source: 'worldmap',
                                        utm_content:
                                            'incomplete-data-notice'
                                    }
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue underline"
                            >
                                {__(
                                    'Learn more',
                                    'burst-statistics'
                                )}
                            </a>
                            <button
                                onClick={
                                    dismissIncompleteDataNotice
                                }
                                className="rounded bg-gray-200 px-3 py-1 text-text-gray hover:bg-gray-300 hover:text-gray"
                                title={__(
                                    'Dismiss for 30 days',
                                    'burst-statistics'
                                )}
                            >
                                {__( 'Dismiss', 'burst-statistics' )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
InCompleteDataNotice.displayName = 'InCompleteDataNotice';
export default InCompleteDataNotice;
