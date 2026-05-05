import {__} from '@wordpress/i18n';
import {useGeoData} from '@/hooks/useGeoData';
import {memo} from 'react';

const MapOverlay = memo( ( props ) => {
    const {
        isGeoLoading,
        isGeoFetching
    } = useGeoData( props );
    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-lg bg-white p-6 shadow-lg">
                <div className="border-blue-600 h-8 w-8 animate-spin rounded-full border-b-2"></div>
                <div className="text-sm font-medium text-text-gray">
                    {isGeoLoading || isGeoFetching ?
                        __( 'Loading map data…', 'burst-statistics' ) :
                        __( 'Loading analytics…', 'burst-statistics' )}
                </div>
            </div>
        </div>
    );
});
MapOverlay.displayName = 'MapOverlay';
export default MapOverlay;
