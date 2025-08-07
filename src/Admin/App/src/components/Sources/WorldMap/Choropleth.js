import { memo, Fragment, useCallback, useRef, useEffect, useState, forwardRef } from 'react'
import { SvgWrapper, withContainer, useDimensions, bindDefs } from '@nivo/core'
import { BoxLegendSvg } from '@nivo/legends'
import { useTooltip } from '@nivo/tooltip'
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom'
import { select as d3Select } from 'd3-selection'
import { geoBounds } from 'd3-geo'
import GeoGraticule from './GeoGraticule'
import GeoMapFeature from './GeoMapFeature'
import { useGeoMap, useChoropleth } from './hooks'
import ChoroplethTooltip from './ChoroplethTooltip'
import PatternLegend from './PatternLegend'

const Choropleth = memo(forwardRef((props, ref) => {
    const {
        width,
        height,
        margin: partialMargin,
        features,
        data,
        match = 'id',
        label = 'id',
        value = 'value',
        valueFormat,
        projectionType = 'mercator',
        projectionScale = 100,
        projectionTranslation = [0.5, 0.5],
        projectionRotation = [0, 0, 0],
        colors = 'greens',
        domain,
        unknownColor = '#dee2e6',
        borderWidth = 0,
        borderColor = '#000000',
        enableGraticule = false,
        graticuleLineWidth = 0.5,
        graticuleLineColor = '#999999',
        baseMapFeatures = [],
        baseMapFeatureColor = false,
        overlayFeatures = [],
        overlayData = [],
        overlayMatch,
        overlayValue,
        overlayColors,
        showBaseLayer = true,
        overlayOpacity = 1,
        baseLayerOpacity = 0.3,
        layers = ['graticule', 'baseMapFeatures', 'features', 'overlayFeatures', 'legends'],
        legends = [],
        isInteractive = true,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onClick = () => { },
        tooltip: Tooltip = ChoroplethTooltip,
        role = 'img',
        defs = [],
        fill = [],
        transform = {
            scale: 1,
            x: 0,
            y: 0,
        },
        // Theme configuration props
        classificationMethod = 'quantile',
        normalizeData,
        populationField,
        metric,
        metricOptions,
        patternsEnabled = false,
        tooltipTotal,
        selectedMetric,
        zoomToFeature: zoomToFeatureProp,
        geoIpDatabaseType,
    } = props

    const svgRef = useRef(null)
    const mapLayersRef = useRef(null)
    const zoomRef = useRef(null)
    const overlayFeaturesRef = useRef(null)
    const { margin, outerWidth, outerHeight } = useDimensions(width, height, partialMargin)

    // Track zoom level for pattern scaling
    const [currentZoomLevel, setCurrentZoomLevel] = useState(1)

    // Function to determine discrete zoom level (1, 2, 3, or 4)
    const getDiscreteZoomLevel = useCallback((zoomValue) => {
        if (zoomValue <= 2) return 1;
        if (zoomValue <= 5) return 2;
        if (zoomValue <= 10) return 3;
        return 4;
    }, []);

    // Callback for zoom level changes - only update when discrete level changes and patterns are enabled
    const handleZoomChange = useCallback((zoomLevel) => {
        // Only track zoom level changes when patterns are enabled
        if (!patternsEnabled) return;

        const newDiscreteLevel = getDiscreteZoomLevel(zoomLevel);
        setCurrentZoomLevel(prevLevel => {
            // Only update if the discrete zoom level actually changed
            if (getDiscreteZoomLevel(prevLevel) !== newDiscreteLevel) {
                return zoomLevel; // Store the actual zoom value for display
            }
            return prevLevel; // Keep the previous value if discrete level hasn't changed
        });
    }, [getDiscreteZoomLevel, patternsEnabled])

    // Main features choropleth (primary layer)
    const { getFillColor, boundFeatures, legendData, patternDefs, patternFills, valueFormatter } = useChoropleth({
        features,
        data,
        match,
        label,
        value,
        valueFormat,
        unknownColor,
        domain,
        metric,
        metricOptions,
        colors,
        patternsEnabled,
        zoomLevel: patternsEnabled ? getDiscreteZoomLevel(currentZoomLevel) : undefined,
        classificationMethod,
    })

    // Overlay features choropleth (when drilling down to country)
    const hasOverlay = overlayFeatures?.features?.length > 0;

    // Always create overlay choropleth, but with empty data when no overlay
    const overlayResult = useChoropleth({
        features: hasOverlay ? (overlayFeatures?.features || []) : [],
        data: hasOverlay ? (overlayData || data) : [],
        match: overlayMatch || match,
        label,
        value: overlayValue || value,
        valueFormat,
        unknownColor,
        domain,
        metric,
        metricOptions,
        colors: overlayColors || colors,
        patternsEnabled,
        zoomLevel: patternsEnabled ? getDiscreteZoomLevel(currentZoomLevel) : undefined,
        classificationMethod,
    });

    const {
        getFillColor: getOverlayFillColor,
        boundFeatures: boundOverlayFeatures,
        legendData: overlayLegendData,
        patternDefs: overlayPatternDefs,
        patternFills: overlayPatternFills,
        valueFormatter: overlayValueFormatter
    } = overlayResult;



    const { graticule, path, getBorderWidth, getBorderColor } = useGeoMap({
        width,
        height,
        projectionType,
        projectionScale,
        projectionTranslation,
        projectionRotation,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        fillColor: () => { },
        borderWidth,
        borderColor,
        transform,
        onZoomChange: handleZoomChange,
        patternsEnabled
    })


    // Combine pattern definitions from both layers
    const allPatternDefs = [...defs, ...patternDefs, ...(hasOverlay ? overlayPatternDefs : [])];
    const allPatternFills = [...fill, ...patternFills, ...(hasOverlay ? overlayPatternFills : [])];

    const boundDefs = bindDefs(allPatternDefs, [...boundFeatures, ...(hasOverlay ? boundOverlayFeatures : [])], allPatternFills, {
        dataKey: 'data',
        targetKey: 'fill',
    })

    const { showTooltipFromEvent, hideTooltip } = useTooltip()
    const handleClick = useCallback(
        (feature, event) => isInteractive && onClick && onClick(feature, event),
        [isInteractive, onClick]
    )
    const handleMouseEnter = useCallback(
        (feature, event) => {
            if (!isInteractive || !Tooltip) return;
            const currentValueFormatter = hasOverlay ? overlayValueFormatter : valueFormatter;
            showTooltipFromEvent(<Tooltip feature={feature} total={tooltipTotal} selectedMetric={selectedMetric} valueFormatter={currentValueFormatter} geoIpDatabaseType={geoIpDatabaseType} />, event);
        },
        [isInteractive, showTooltipFromEvent, Tooltip, tooltipTotal, selectedMetric, hasOverlay, overlayValueFormatter, valueFormatter, geoIpDatabaseType]
    )
    const handleMouseMove = useCallback(
        (feature, event) => {
            if (!isInteractive || !Tooltip) return;
            const currentValueFormatter = hasOverlay ? overlayValueFormatter : valueFormatter;
            showTooltipFromEvent(<Tooltip feature={feature} total={tooltipTotal} selectedMetric={selectedMetric} valueFormatter={currentValueFormatter} geoIpDatabaseType={geoIpDatabaseType} />, event);
        },
        [isInteractive, showTooltipFromEvent, Tooltip, tooltipTotal, selectedMetric, hasOverlay, overlayValueFormatter, valueFormatter, geoIpDatabaseType]
    )
    const handleMouseLeave = useCallback(
        () => isInteractive && hideTooltip(),
        [isInteractive, hideTooltip]
    )

    // Setup zoom functionality directly in the component
    useEffect(() => {
        if (!svgRef.current || !mapLayersRef.current) return;

        const svg = d3Select(svgRef.current);
        const mapLayers = d3Select(mapLayersRef.current);

        const zoom = d3Zoom()
            .scaleExtent([1, 1000])
            .on("zoom", (event) => {
                const transform = event.transform;
                mapLayers.attr("transform", `translate(${transform.x},${transform.y}) scale(${transform.k})`);

                // Update stroke-width for all paths based on new zoom level
                mapLayers.selectAll("path").attr("stroke-width", () => {
                    return borderWidth / transform.k;
                });

                // Update zoom level for patterns
                if (handleZoomChange) {
                    handleZoomChange(transform.k);
                }
            });

        svg.call(zoom);
        zoomRef.current = { svg, zoom, path };

        return () => {
            svg.on("zoom", null);
            zoomRef.current = null;
        };
    }, [path, handleZoomChange, borderWidth])

    // Handle zoom to feature prop changes
    useEffect(() => {
        if (!zoomToFeatureProp || !zoomRef.current) {
            return;
        }

        const { svg, zoom, path } = zoomRef.current;

        if (zoomToFeatureProp === 'reset') {
            svg.transition()
                .duration(750)
                .call(zoom.transform, zoomIdentity);
            return;
        }

        try {
            let bounds;

            // Prioritize using the rendered SVG group for FeatureCollection bounds
            if (zoomToFeatureProp.type === 'FeatureCollection' && overlayFeaturesRef.current) {
                const bbox = overlayFeaturesRef.current.getBBox();
                if (bbox.width > 0 && bbox.height > 0) {
                    bounds = [[bbox.x, bbox.y], [bbox.x + bbox.width, bbox.y + bbox.height]];
                }
            }

            // Fallback to manual calculation if bounds not found via SVG group
            if (!bounds && (zoomToFeatureProp.geometry || zoomToFeatureProp.type === 'FeatureCollection')) {
                if (zoomToFeatureProp.type === 'FeatureCollection') {
                     // Fallback: use D3's geoBounds on the geographic coordinates
                     const geographicBounds = geoBounds(zoomToFeatureProp);
                     // Project the geographic bounds to screen coordinates
                     const [[west, south], [east, north]] = geographicBounds;
                     const projectedSW = path.projection()([west, south]);
                     const projectedNE = path.projection()([east, north]);

                     if (projectedSW && projectedNE) {
                         bounds = [projectedSW, projectedNE];
                     } else {
                         console.error('Failed to project geographic bounds, aborting zoom');
                         return;
                     }
                } else {
                    // Calculate the bounding box of a single feature
                    bounds = path.bounds(zoomToFeatureProp);
                }
            }
            
            if (!bounds) return;

            const [[x0, y0], [x1, y1]] = bounds;
            
            // Calculate scale to fit the feature with some padding
            const scale = Math.min(100, 0.8 / Math.max((x1 - x0) / width, (y1 - y0) / height));
            const clampedScale = Math.max(1, scale);

            // Calculate translation to center the feature
            const centerX = (x0 + x1) / 2;
            const centerY = (y0 + y1) / 2;
            const translateX = width / 2 - centerX * clampedScale;
            const translateY = height / 2 - centerY * clampedScale;

            const finalTransform = zoomIdentity.translate(translateX, translateY).scale(clampedScale);
            
            // Apply the zoom transform with smooth transition
            svg.transition()
                .duration(750)
                .call(zoom.transform, finalTransform);

        } catch (error) {
            console.error('Error zooming to feature:', error);
        }
    }, [zoomToFeatureProp, width, height]);

    // Update border widths when features change and we're already zoomed in
    useEffect(() => {
        if (!svgRef.current || !mapLayersRef.current) return;

        const svg = d3Select(svgRef.current);
        const mapLayers = d3Select(mapLayersRef.current);

        // Get current zoom transform
        const currentTransform = svg.node().__zoom || { k: 1 };

        // Apply border width adjustment based on current zoom level
        if (currentTransform.k > 1) {
            mapLayers.selectAll("path").attr("stroke-width", () => {
                return borderWidth / currentTransform.k;
            });
        }
    }, [boundFeatures, boundOverlayFeatures, borderWidth]);



    // Render only map-related layers inside the zoomable group
    const renderMapLayers = () => {
        return layers.map((layer, i) => {
            if (layer === 'graticule') {
                if (enableGraticule !== true) return null

                return (
                    <GeoGraticule
                        key="graticule"
                        path={path}
                        graticule={graticule}
                        lineWidth={graticuleLineWidth}
                        lineColor={graticuleLineColor}
                    />
                )
            }

            if (layer === 'baseMapFeatures') {

                if (!baseMapFeatures || baseMapFeatures.length === 0) {
                    return null;
                }

                return (
                    <Fragment key="baseMapFeatures">
                        <g className="base-map-features-group">
                            {baseMapFeatures.map((feature, index) => (
                                <GeoMapFeature
                                    key={`base-${feature.id || index}`}
                                    feature={feature}
                                    path={path}
                                    fillColor={baseMapFeatureColor ? baseMapFeatureColor : "#e9ecef"}
                                    borderWidth={getBorderWidth(feature)}
                                    borderColor="rgb(249 249 249)"
                                />
                            ))}
                        </g>
                    </Fragment>
                )
            }

            if (layer === 'features') {
                // When we have overlay, show base features with reduced opacity
                const featureOpacity = hasOverlay && showBaseLayer ? baseLayerOpacity : 1;
                const shouldShowFeatures = !hasOverlay || showBaseLayer;

                if (!shouldShowFeatures) return null;

                return (
                    <Fragment key="features">
                        <g className="features-group">
                            {boundFeatures.map((feature, index) => (
                                <GeoMapFeature
                                    key={feature.id || `feature-${index}`}
                                    feature={feature}
                                    path={path}
                                    fillColor={getFillColor(feature)}
                                    borderWidth={getBorderWidth(feature)}
                                    borderColor={getBorderColor(feature)}
                                    onMouseEnter={hasOverlay ? undefined : handleMouseEnter}
                                    onMouseMove={hasOverlay ? undefined : handleMouseMove}
                                    onMouseLeave={hasOverlay ? undefined : handleMouseLeave}
                                    onClick={hasOverlay ? undefined : handleClick}
                                    opacity={featureOpacity}
                                />
                            ))}
                        </g>
                    </Fragment>
                )
            }

            if (layer === 'overlayFeatures') {
                if (!hasOverlay) return null;

                return (
                    <Fragment key="overlayFeatures">
                        <g className="overlay-features-group" ref={overlayFeaturesRef}>
                            {boundOverlayFeatures.map((feature, index) => (
                                <GeoMapFeature
                                    key={`overlay-${feature.id || index}`}
                                    feature={feature}
                                    path={path}
                                    fillColor={getOverlayFillColor(feature)}
                                    borderWidth={getBorderWidth(feature)}
                                    borderColor={getBorderColor(feature)}
                                    onMouseEnter={handleMouseEnter}
                                    onMouseMove={handleMouseMove}
                                    onMouseLeave={handleMouseLeave}
                                    onClick={handleClick}
                                    opacity={overlayOpacity}
                                />
                            ))}
                        </g>
                    </Fragment>
                )
            }

            if (layer !== 'legends') {
                return <Fragment key={i}>{layer({})}</Fragment>
            }
            return null;
        }).filter(Boolean);
    };

    // Render legends separately outside the zoomable group
    const renderLegends = () => {
        if (!layers.includes('legends')) return null;

        // Use overlay legend data if we have an overlay, otherwise use main legend data
        const currentLegendData = hasOverlay ? overlayLegendData : legendData;

        return (
            <g className="legends-layer">
                {legends.map((legend, i) => (
                    <PatternLegend
                        key={i}
                        containerWidth={width}
                        containerHeight={height}
                        data={currentLegendData}
                        patternsEnabled={patternsEnabled}
                        {...legend}
                    />
                ))}
            </g>
        );
    };

    return (
        <SvgWrapper
            width={outerWidth}
            height={outerHeight}
            margin={margin}
            defs={boundDefs}
            role={role}
            ref={svgRef}
        >
            <g ref={mapLayersRef} className="map-layers">
                {renderMapLayers()}
            </g>
            {renderLegends()}
        </SvgWrapper>
    )
}))

export default withContainer(Choropleth);