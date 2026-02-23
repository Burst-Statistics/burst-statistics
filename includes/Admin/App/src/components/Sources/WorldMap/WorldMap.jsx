import ResponsiveChoropleth from './ResponsiveChoropleth';
import MapBreadcrumbs from './MapBreadcrumbs';
import { metricOptions, useGeoStore } from '@/store/useGeoStore';
import { useCallback, useEffect, useMemo } from '@wordpress/element';
import { useGeoData } from '@/hooks/useGeoData';
import { useGeoAnalytics } from '@/hooks/useGeoAnalytics';
import { createValueFormatter } from '@/utils/formatting';
import { __, sprintf } from '@wordpress/i18n';
import useSettingsData from '@/hooks/useSettingsData';
import {useBlockConfig} from '@/hooks/useBlockConfig';
import MapOverlay from '@/components/Sources/WorldMap/MapOverlay';
import InCompleteDataNotice from '@/components/Sources/WorldMap/InCompleteDataNotice';
import MapStatisticsInfo from '@/components/Sources/WorldMap/MapStatisticsInfo';

const WorldMap = ( props ) => {
	const { isStory } = useBlockConfig( props );

	const currentView = useGeoStore( ( state ) => state.currentView );
	const currentViewMissingData = useGeoStore(
		( state ) => state.currentViewMissingData
	);
	const setCurrentViewMissingData = useGeoStore(
		( state ) => state.setCurrentViewMissingData
	);
	const navigateToView = useGeoStore( ( state ) => state.navigateToView );

	// Get projection values from store
	const projection = useGeoStore( ( state ) => state.projection );

	// Get metrics from store
	const selectedMetric = useGeoStore( ( state ) => state.selectedMetric );

	// Get visualization settings from store
	const patternsEnabled = useGeoStore( ( state ) => state.patternsEnabled );
	const classificationMethod = useGeoStore(
		( state ) => state.classificationMethod
	);

	// Settings data for getting the database update time
	const { getValue } = useSettingsData();

	const geoIpDatabaseType = getValue( 'geo_ip_database_type' );

	const colorScheme = useMemo( () => {
		return metricOptions[selectedMetric]?.colorScheme || 'greens';
	}, [ selectedMetric ]);

	// Create valueFormatter function using the reusable utility
	const valueFormatter = useMemo( () => {
		return createValueFormatter( selectedMetric, metricOptions );
	}, [ selectedMetric ]);

	// Get zoom state from store
	const zoomTarget = useGeoStore( ( state ) => state.zoomTarget );
	const setZoomTarget = useGeoStore( ( state ) => state.setZoomTarget );

	// Get Geo data from our custom hook
	const {
		geoFeatures,
		simplifiedWorldGeoJson,
		baseLayerFeatures,
		overlayFeatures,
		hasOverlay,
		isGeoLoading,
		isGeoFetching,
		isGeoSimpleLoading,
		error: geoError
	} = useGeoData( props );

	// Get analytics data using our new custom hook
	const {
		data: analyticsData = [],
		isFetching: isAnalyticsFetching,
		error: analyticsError
	} = useGeoAnalytics( props );

	const handleFeatureClick = useCallback(
		( feature ) => {
			if ( ! feature || ! feature.properties?.iso_a2 ) {
				return;
			}

			// Disable click functionality for country database type
			if ( 'country' === geoIpDatabaseType ) {
				return;
			}

			// Don't navigate if we're already in this country view
			if (
				'country' === currentView.level &&
				currentView.id === feature.properties.iso_a2
			) {
				return;
			}

			let nextViewConfig;
			if ( 'world' === currentView.level ) {
				nextViewConfig = {
					level: 'country', // @todo: change to continent after adding proper continent data
					id: feature.properties?.iso_a2, // Expects continent ID from GeoJSON feature
					parentId: null,
					title: `${feature.properties?.name || feature.id}`
				};
			} else if ( 'continent' === currentView.level ) {
				nextViewConfig = {
					level: 'country',
					id: feature.properties?.iso_a2, // Expects country ID from GeoJSON feature
					parentId: currentView.id,
					title: `${feature.properties?.name || feature.id}`
				};
			}

			// For country database type, only allow navigation from world to country
			// For city database type, allow navigation to region level
			if (
				nextViewConfig &&
				( 'city' === geoIpDatabaseType || 'world' === currentView.level )
			) {
				navigateToView( nextViewConfig );
			}
		},
		[ currentView.level, currentView.id, navigateToView, geoIpDatabaseType ]
	);

	// When view changes to a country and its data is loaded, set the zoom target
	useEffect( () => {
		if (
			'country' === currentView.level &&
			currentView.id &&
			! isGeoFetching &&
			! isGeoLoading &&
			0 < overlayFeatures?.features?.length
		) {
			const target = {
				type: 'FeatureCollection',
				features: overlayFeatures.features
			};
			setZoomTarget( target );
		}
	}, [
		currentView.level,
		currentView.id,
		overlayFeatures,
		isGeoFetching,
		isGeoLoading,
		setZoomTarget
	]);

	const matchProperty = useMemo( () => {

		// Custom matching function to match GeoJSON features with analytics data
		return ( feature, datum ) => {

			// Get the country code from the feature's properties

			// Get the country code from the analytics datum
			if ( 'world' === currentView.level ) {
				const featureCountryCode = feature.properties?.iso_a2;
				const datumCountryCode = datum.country_code;
				return (
					featureCountryCode &&
					datumCountryCode &&
					featureCountryCode === datumCountryCode
				);
			} else if (
				'country' === currentView.level &&
				'city' === geoIpDatabaseType
			) {

				// For city database type, match regions within countries
				const featureCountryCode = feature.properties?.iso_3166_2;
				const datumCountryCode =
					datum.country_code + '-' + datum.state_code;
				return (
					featureCountryCode &&
					datumCountryCode &&
					featureCountryCode === datumCountryCode
				);
			}
			return false;
		};
	}, [ currentView.level, currentView.id, geoIpDatabaseType ]); // eslint-disable-line react-hooks/exhaustive-deps

	// Configure value accessor for the selected metric
	const valueAccessor = useMemo( () => {
		return ( datum ) => {
			if ( ! datum ) {
				return 0;
			}
			const value = parseInt( datum[selectedMetric], 10 );
			return isNaN( value ) ? 0 : value;
		};
	}, [ selectedMetric ]);

	// Configure label accessor to show country name from feature properties
	const labelAccessor = useMemo( () => {
		return ( feature ) => {
			return (
				feature.properties?.name_en ||
				feature.properties?.iso_a2 ||
				__( 'Unknown', 'burst-statistics' )
			);
		};
	}, []);

	// Calculate total for the selected metric
	const totalMetricValue = useMemo( () => {
		if ( ! analyticsData || 0 === analyticsData.length ) {
			return 0;
		}

		// For city database type, if currentView.level === "country" && analyticsData has an entry without state_code save it to the store
		if (
			'city' === geoIpDatabaseType &&
			'country' === currentView.level &&
			analyticsData.some( ( datum ) => ! datum.state_code )
		) {

			// save the entry without state_code to the store
			setCurrentViewMissingData(
				analyticsData.find( ( datum ) => ! datum.state_code )
			);

			// remove the entry without state_code from analyticsData
		} else {
			setCurrentViewMissingData( null );
		}

		return analyticsData.reduce(
			( sum, datum ) => sum + valueAccessor( datum ),
			0
		);
	}, [ analyticsData, valueAccessor ]); // eslint-disable-line react-hooks/exhaustive-deps

	// Calculate statistics for better context
	const dataStatistics = useMemo( () => {
		if ( ! analyticsData || 0 === analyticsData.length ) {
			return null;
		}

		const values = analyticsData
			.map( ( d ) => valueAccessor( d ) )
			.filter( ( v ) => 0 < v );
		if ( 0 === values.length ) {
			return null;
		}

		const sorted = [ ...values ].sort( ( a, b ) => a - b );
		const mean = values.reduce( ( sum, val ) => sum + val, 0 ) / values.length;
		const median = sorted[Math.floor( sorted.length / 2 )];

		return {
			count: values.length,
			min: Math.min( ...values ),
			max: Math.max( ...values ),
			mean: Math.round( mean ),
			median: Math.round( median ),
			total: totalMetricValue
		};
	}, [ analyticsData, valueAccessor, totalMetricValue ]);

	// Calculate domain for color scale based on the selected metric - now handled by classification
	const colorDomain = useMemo( () => {
		if ( ! analyticsData || 0 === analyticsData.length ) {
			return [ 0, 100 ];
		}

		const values = analyticsData
			.map( ( d ) => valueAccessor( d ) )
			.filter( ( v ) => 0 < v );
		if ( 0 === values.length ) {
			return [ 0, 100 ];
		}

		const min = Math.min( ...values );
		const max = Math.max( ...values );
		return [ min, max ];
	}, [ analyticsData, valueAccessor ]);

	const displayError = geoError || analyticsError;

	// Calculate if we're in a loading state
	const isLoading = isGeoLoading || isGeoFetching || isAnalyticsFetching;

	if ( displayError ) {
		return (
			<div className="text-red-500 relative p-4">
				<div className="absolute left-3 top-3 z-10">
					<MapBreadcrumbs />
				</div>
				<div className="mt-12">
					<p>
						{sprintf(

							/* translators: %s: Error message */
							__( 'Error: %s', 'burst-statistics' ),
							String( displayError )
						)}
					</p>
				</div>
			</div>
		);
	}

	if ( isGeoSimpleLoading ) {
		return (
			<div className="p-4 text-gray">
				{__( 'Loading map data…', 'burst-statistics' )}
			</div>
		);
	}

	if ( ! selectedMetric ) {
		return (
			<div className="p-4 text-gray">
				{__( 'No metrics available for display.', 'burst-statistics' )}
			</div>
		);
	}
	const missingDataCount = valueFormatter(
		valueAccessor(
			currentViewMissingData
		)
	);

	return (
		<div
			className={'relative h-full min-h-[450px] w-full rounded-b-lg'}
			style={{
				height: isStory ? '600px' : '100%',
				minHeight: '450px',
				boxShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.06)'
			}}>
			{isLoading && ( <MapOverlay {...props}/> )}

			{/* Breadcrumbs Navigation - Only show for city database type */}
			{'city' === geoIpDatabaseType && <div className="absolute left-3 top-3 z-10"><MapBreadcrumbs /></div>}

			{/* Incomplete Data Notice - Top Left - Only for city database type */}
			{'city' === geoIpDatabaseType && currentViewMissingData && <InCompleteDataNotice />}

			{/* Map Statistics Info */}
			<MapStatisticsInfo dataStatistics={dataStatistics} missingDataCount={missingDataCount}/>

			{0 < geoFeatures?.features?.length && ! isGeoSimpleLoading && (
				<ResponsiveChoropleth
					key={`choropleth-${patternsEnabled ? 'patterns' : 'no-patterns'}-${classificationMethod}`}
					onClick={handleFeatureClick}
					data={analyticsData}
					features={
						'world' === currentView.level ?
							geoFeatures.features :
							baseLayerFeatures.features
					}
					transform={geoFeatures.transform}
					baseMapFeatures={simplifiedWorldGeoJson.features}

					// Multi-layer props for smooth transitions
					overlayFeatures={
						hasOverlay ? overlayFeatures : { features: [] }
					}
					overlayData={hasOverlay ? analyticsData : []}
					overlayMatch={matchProperty}
					overlayValue={valueAccessor}
					showBaseLayer={hasOverlay}
					baseLayerOpacity={0.2}
					overlayOpacity={1}
					match={matchProperty}
					value={valueAccessor}
					margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
					colors={colorScheme}
					domain={colorDomain}
					unknownColor="#dee2e6"
					label={labelAccessor}
					valueFormat={valueFormatter}
					projectionType="naturalEarth1"

					// Use projection values from the store
					projectionScale={projection.scale}
					projectionTranslation={projection.translation}
					projectionRotation={projection.rotation}
					enableGraticule={true}
					graticuleLineColor="#dddddd"
					borderWidth={0.5}
					borderColor="#adb5bd"
					metric={selectedMetric}
					metricOptions={metricOptions}
					patternsEnabled={patternsEnabled}
					classificationMethod={classificationMethod}

					// Zoom animation prop from store
					zoomToFeature={zoomTarget}
					legends={[
						{
							anchor: 'bottom-left',
							direction: 'column',
							justify: true,
							translateX: 20,
							translateY: -100,
							itemsSpacing: 0,
							itemWidth: 94,
							itemHeight: 18,
							itemDirection: 'left-to-right',
							itemTextColor: '#444444',
							itemOpacity: 0.85,
							symbolSize: 18,
							effects: [
								{
									on: 'hover',
									style: {
										itemTextColor: '#000000',
										itemOpacity: 1
									}
								}
							]
						}
					]}
					tooltipTotal={dataStatistics?.total}
					selectedMetric={selectedMetric}
					geoIpDatabaseType={geoIpDatabaseType}
				/>
			)}
		</div>
	);
};

export default WorldMap;
