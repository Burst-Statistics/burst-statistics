import { __, sprintf } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import {formatUnixToDate} from '@/utils/formatting';
import {burst_get_website_url} from '@/utils/lib';
import {useGeoStore} from '@/store/useGeoStore';
import {useEffect} from '@wordpress/element';
import useSettingsData from '@/hooks/useSettingsData';
import {memo} from 'react';
const InCompleteDataNotice = memo( () => {
    const isIncompleteDataNoticeDismissed = useGeoStore( ( state ) => state.isIncompleteDataNoticeDismissed );
    const { getValue } = useSettingsData();
    const cityGeoUpdateTime = getValue( 'burst_update_to_city_geo_database_time' );
    const checkDismissalExpiry = useGeoStore( ( state ) => state.checkDismissalExpiry );
    const dismissIncompleteDataNotice = useGeoStore( ( state ) => state.dismissIncompleteDataNotice );

    // Check if dismissal has expired on component mount
    useEffect( () => {
        checkDismissalExpiry();
    }, [ checkDismissalExpiry ]);

    if ( isIncompleteDataNoticeDismissed ) {
        return null;
    }
    return (
        <div className="absolute left-3 top-16 z-10 max-w-md">
            <div className="rounded-lg border border-gray-200 bg-white/95 px-4 py-3 text-sm shadow-sm transition-all hover:shadow-md">
                <div className="flex items-start gap-3">
                    <Icon
                        name="help"
                        size={16}
                        color="blue"
                        className="mt-0.5 flex-shrink-0"
                    />
                    <div className="flex-1">
                        <div className="mb-2 text-black">
                            <p className="font-semibold">
                                {sprintf(
                                    __(
                                        'Region-level data is available for visits after %s.',
                                        'burst-statistics'
                                    ),
                                    cityGeoUpdateTime ?
                                        formatUnixToDate(
                                            cityGeoUpdateTime
                                        ) :
                                        ''
                                )}
                            </p>
                            <p className="mt-1">
                                {__(
                                    'Region tracking is a new feature, so this data is only available for visits recorded after it was enabled.',
                                    'burst-statistics'
                                )}
                            </p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <a
                                href={burst_get_website_url(
                                    'new-feature-region-tracking/',
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
                                className="rounded bg-gray-200 px-3 py-1 text-gray hover:bg-gray-300 hover:text-gray"
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


