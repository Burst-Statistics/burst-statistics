import { __, _x, _n, sprintf } from '@wordpress/i18n';
import { metricOptions, useGeoStore } from '@/store/useGeoStore';
import useSettingsData from '@/hooks/useSettingsData';
import Icon from '@/utils/Icon';
import {useMemo} from '@wordpress/element';
import {createValueFormatter} from '@/utils/formatting';
import {memo} from 'react';

const MapStatisticsInfo = memo( ({dataStatistics, missingDataCount}) => {
    const currentView = useGeoStore( ( state ) => state.currentView );
    const { getValue } = useSettingsData();

    const geoIpDatabaseType = getValue( 'geo_ip_database_type' );
    const selectedMetric = useGeoStore( ( state ) => state.selectedMetric );
    const patternsEnabled = useGeoStore( ( state ) => state.patternsEnabled );
    const currentViewMissingData = useGeoStore(
        ( state ) => state.currentViewMissingData
    );
    const valueFormatter = useMemo( () => {
        return createValueFormatter( selectedMetric, metricOptions );
    }, [ selectedMetric ]);
    const classificationMethod = useGeoStore(
        ( state ) => state.classificationMethod
    );
    return (
        <div
            className={`absolute ${
                'country' === geoIpDatabaseType ?
                    'left-3 top-3' :
                    'right-3 top-3'
            }`}
        >
            <div className="duration-400 group rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-sm shadow-sm transition-all hover:shadow-md z-[1] relative">
                <div className="font-semibold text-black">
                    {sprintf(
                        'world' === currentView.level ||
                        'country' === geoIpDatabaseType								? /* translators: %s: Metric name (e.g., "Pageviews", "Visitors") */
                            _x(
                                '%s per country',
                                'metric by location',
                                'burst-statistics'
                            )								: /* translators: %s: Metric name (e.g., "Pageviews", "Visitors") */
                            _x(
                                '%s per region',
                                'metric by location',
                                'burst-statistics'
                            ),
                        metricOptions[selectedMetric]?.label ||
                        selectedMetric
                    )}
                </div>
                {dataStatistics && (
                    <>
                        <div className="mt-1 text-xs text-gray">
                            {sprintf(

                                /* translators: %d: Number of locations that have data */
                                'country' === geoIpDatabaseType ?
                                    _n(
                                        '%d country with data',
                                        '%d countries with data',
                                        dataStatistics.count,
                                        'burst-statistics'
                                    ) :
                                    _n(
                                        '%d region with data',
                                        '%d regions with data',
                                        dataStatistics.count,
                                        'burst-statistics'
                                    ),
                                dataStatistics.count
                            )}
                        </div>
                        {patternsEnabled && (
                            <div className="mt-1 text-xs text-gray">
                                •{' '}
                                {__( 'Patterns enabled', 'burst-statistics' )}
                            </div>
                        )}
                        {currentViewMissingData && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-gray">
                                <Icon
                                    name="help"
                                    size={12}
                                    strokeWidth={2}
                                    color="blue"
                                />
                                {sprintf(

                                    /* translators: %d: Number of visitors with unknown region, %s: metric label */
                                    __(
                                        '%d %s with unknown region',
                                        'burst-statistics'
                                    ),
                                    missingDataCount,
                                    metricOptions[
                                        selectedMetric
                                        ]?.label?.toLowerCase() ||
                                    selectedMetric.toLowerCase()
                                )}
                            </div>
                        )}
                    </>
                )}
                {/* Show detailed statistics on hover with smooth animation */}
                {dataStatistics && (
                    <div className="max-h-0 overflow-hidden opacity-0 transition-all duration-300 ease-in-out group-hover:max-h-32 group-hover:opacity-100">
                        <div className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-xs text-gray">
                            <div className="flex justify-between">
									<span>
										{_x(
                                            'Range',
                                            'statistic label',
                                            'burst-statistics'
                                        )}
                                        :
									</span>
                                <span>
										{valueFormatter( dataStatistics.min )} -{' '}
                                    {valueFormatter( dataStatistics.max )}
									</span>
                            </div>
                            <div className="flex justify-between">
									<span>
										{_x(
                                            'Average',
                                            'statistic label',
                                            'burst-statistics'
                                        )}
                                        :
									</span>
                                <span>
										{valueFormatter( dataStatistics.mean )}
									</span>
                            </div>
                            <div className="flex justify-between">
									<span>
										{_x(
                                            'Median',
                                            'statistic label',
                                            'burst-statistics'
                                        )}
                                        :
									</span>
                                <span>
										{valueFormatter( dataStatistics.median )}
									</span>
                            </div>
                            <div className="flex justify-between">
									<span>
										{_x(
                                            'Total',
                                            'statistic label',
                                            'burst-statistics'
                                        )}
                                        :
									</span>
                                <span className="font-medium">
										{valueFormatter( dataStatistics.total )}
									</span>
                            </div>
                            <div className="flex justify-between">
									<span>
										{_x(
                                            'Method',
                                            'statistic label',
                                            'burst-statistics'
                                        )}
                                        :
									</span>
                                <span className="font-medium capitalize">
										{_x(
                                            classificationMethod.replace(
                                                '-',
                                                ' '
                                            ),
                                            'classification method',
                                            'burst-statistics'
                                        )}
									</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});
MapStatisticsInfo.displayName = 'MapStatisticsInfo';
export default MapStatisticsInfo;
