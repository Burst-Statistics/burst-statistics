import { useMemo, useRef, useCallback, useEffect } from 'react'
import isFunction from 'lodash/isFunction.js'
import get from 'lodash/get.js'
import { format } from 'd3-format'
import {
    geoPath,
    geoAzimuthalEqualArea,
    geoAzimuthalEquidistant,
    geoGnomonic,
    geoOrthographic,
    geoStereographic,
    geoEqualEarth,
    geoEquirectangular,
    geoMercator,
    geoTransverseMercator,
    geoNaturalEarth1,
    geoGraticule,
} from 'd3-geo'
import { zoom as d3Zoom, zoomIdentity, zoomTransform } from 'd3-zoom'
import { select as d3Select } from 'd3-selection'
import { useInheritedColor } from '@nivo/colors'
import { createClassifiedColorScale } from './dataClassification'
import { createValueFormatter } from '@/utils/formatting'

export const projectionById = {
    azimuthalEqualArea: geoAzimuthalEqualArea,
    azimuthalEquidistant: geoAzimuthalEquidistant,
    gnomonic: geoGnomonic,
    orthographic: geoOrthographic,
    stereographic: geoStereographic,
    equalEarth: geoEqualEarth,
    equirectangular: geoEquirectangular,
    mercator: geoMercator,
    transverseMercator: geoTransverseMercator,
    naturalEarth1: geoNaturalEarth1,
}

export const useGeoMap = ({
    width,
    height,
    projectionType,
    projectionScale,
    projectionTranslation,
    projectionRotation,
    fillColor,
    borderWidth,
    borderColor,
    theme,
    transform,
    onZoomChange,
    patternsEnabled = false
}) => {
    const [translateX, translateY] = projectionTranslation
    const [rotateLambda, rotatePhi, rotateGamma] = projectionRotation
    
    // Store current zoom transform in a ref to avoid re-renders
    const zoomTransformRef = useRef({ k: 1, x: 0, y: 0 })

    const projection = useMemo(() => {
        return projectionById[projectionType]()
            .scale(projectionScale)
            .translate([width * translateX, height * translateY])
            .rotate([rotateLambda, rotatePhi, rotateGamma])
    }, [
        width,
        height,
        projectionType,
        projectionScale,
        translateX,
        translateY,
        rotateLambda,
        rotatePhi,
        rotateGamma,
    ])
    const path = useMemo(() => geoPath(projection), [projection])
    const graticule = useMemo(() => geoGraticule(), [])

    const getBorderWidth = useMemo(() => {
        const baseBorderWidthFunc = typeof borderWidth === 'function' ? borderWidth : () => borderWidth
        
        return (feature) => {
            const baseBorderWidth = baseBorderWidthFunc(feature)
            return baseBorderWidth / zoomTransformRef.current.k
        }
    }, [borderWidth])
    
    const updateZoomTransform = useCallback((transform, mapLayersSelection) => {
        // Reset x and y to 0 when fully zoomed out (k = 1)
        const adjustedTransform = transform.k === 1 ? 
            { k: 1, x: 0, y: 0 } : 
            { k: transform.k, x: transform.x, y: transform.y }
        
        zoomTransformRef.current = adjustedTransform
        
        // Notify about zoom level change
        if (onZoomChange) {
            onZoomChange(adjustedTransform.k)
        }
        
        // Apply transform to the map layers group
        // Use the adjusted transform for rendering
        const transformString = `translate(${adjustedTransform.x},${adjustedTransform.y}) scale(${adjustedTransform.k})`
        mapLayersSelection.attr("transform", transformString)
        
        // Update stroke-width for all paths based on new zoom level
        mapLayersSelection.selectAll("path").attr("stroke-width", (d) => {
            return getBorderWidth(d)
        })
    }, [getBorderWidth, onZoomChange])
    
    // Get current zoom level for pattern scaling
    const getCurrentZoomLevel = useCallback(() => {
        return zoomTransformRef.current?.k || 1
    }, [])
    
    const setupZoom = useCallback((svgRef, mapLayersRef) => {
        if (!svgRef.current || !mapLayersRef.current) return null
        
        const svg = d3Select(svgRef.current)
        const mapLayers = d3Select(mapLayersRef.current)
        
        const zoom = d3Zoom()
            .scaleExtent([1, 100])
            .on("zoom", (event) => {
                updateZoomTransform(event.transform, mapLayers)
            })

        svg.call(zoom)
        
        // Function to zoom to a specific feature
        const zoomToFeature = (feature) => {
            if (!feature || !feature.geometry) return;
            
            try {
                // Calculate the bounding box of the feature
                const bounds = path.bounds(feature);
                const [[x0, y0], [x1, y1]] = bounds;
                
                // Calculate center and scale
                const centerX = (x0 + x1) / 2;
                const centerY = (y0 + y1) / 2;
                
                // Calculate scale to fit the feature with some padding
                const scale = Math.min(
                    width / (x1 - x0),
                    height / (y1 - y0)
                ) * 0.8; // 0.8 for padding
                
                // Clamp scale to zoom limits
                const clampedScale = Math.max(1, Math.min(100, scale));
                
                // Calculate translation to center the feature
                const translateX = width / 2 - centerX * clampedScale;
                const translateY = height / 2 - centerY * clampedScale;
                
                // Apply the zoom transform with smooth transition
                svg.transition()
                    .duration(750)
                    .call(
                        zoom.transform,
                        zoomIdentity.translate(translateX, translateY).scale(clampedScale)
                    );
            } catch (error) {
                console.warn('Error zooming to feature:', error);
            }
        };
        
        const reset = () => {
            svg.transition().duration(750).call(
                zoom.transform,
                zoomIdentity,
                zoomTransform(svg.node()).invert([width / 2, height / 2])
            )
        }
        
        // Return cleanup function and zoom utilities
        return {
            cleanup: () => {
                svg.on("zoom", null)
            },
            zoomToFeature,
            reset,
            zoom
        };
    }, [width, height, updateZoomTransform, path])
    
    const getBorderColor = useInheritedColor(borderColor, theme)
    const getFillColor = useMemo(
        () => (typeof fillColor === 'function' ? fillColor : () => fillColor),
        [fillColor]
    )

    return {
        projection,
        path,
        graticule,
        getBorderWidth,
        getBorderColor,
        getFillColor,
        setupZoom,
        zoomTransformRef,
        getCurrentZoomLevel
    }
}

export const useChoropleth = ({
    features,
    data,
    match,
    label,
    value,
    valueFormat,
    unknownColor,
    domain,
    metric,
    colors,
    patternsEnabled = false,
    zoomLevel = 1,
    classificationMethod = 'quantile',
    metricOptions = {},
}) => {

    // Check if we have actual data to process
    const hasActualData = useMemo(() => {
        return data && data.length > 0 && data.some(item => {
            const val = item[metric];
            return val != null && !isNaN(val) && isFinite(val);
        });
    }, [data, metric]);

    // Extract values for classification - only when we have actual data
    const dataValues = useMemo(() => {
        if (!hasActualData || !features) return null;
        
        // count features
        const nrOfFeatures = features.length;

        let values = data.map(item => item[metric]).filter(v => v != null && !isNaN(v) && isFinite(v));

        // make if nrOfFeatures is greater than nr of values, then add 0 to the values for every missing value with a max of 195
        if (nrOfFeatures > values.length) {
            values = [...values, ...Array(Math.min(nrOfFeatures - values.length, 195)).fill(0)];
        }

        // make if nrOfFeatures is less than nr of values, then remove the last value

        return values;
    }, [data, metric, features, hasActualData]);



    // Calculate data range for pattern matching
    const dataRange = useMemo(() => {
        if (!hasActualData || !data) return null;
        
        const values = data.map(item => item[metric]).filter(v => v != null && !isNaN(v) && v > 0);
        if (values.length === 0) return null;
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        return { min, max, range: max - min };
    }, [data, metric, hasActualData]);
    // Pattern definitions with zoom-responsive sizing
    const patternDefs = useMemo(() => {
        if (!patternsEnabled) return [];
        
        // Define 4 zoom levels with different pattern scales
        const getPatternScale = (baseSize, baseSpacing) => {
            if (zoomLevel <= 2) {
                // Zoom level 1: Normal size (1x - 2x zoom)
                return { size: baseSize, spacing: baseSpacing };
            } else if (zoomLevel <= 10) {
                // Zoom level 2: Smaller patterns (2x - 5x zoom)
                return { size: baseSize * 0.5, spacing: baseSpacing * 0.5 };
            } else if (zoomLevel <= 20) {
                // Zoom level 3: Much smaller patterns (5x - 10x zoom)
                return { size: baseSize * 0.25, spacing: baseSpacing * 0.25 };
            } else {
                // Zoom level 4: Very tiny patterns (10x+ zoom)
                return { size: baseSize * 0.15, spacing: baseSpacing * 0.15 };
            }
        };
        
        return [
            // 1. Very small dots for very low values
            {
                id: 'dots-very-low',
                type: 'patternDots',
                background: 'inherit',
                color: 'rgba(0, 0, 0, 0.6)',
                ...getPatternScale(1, 3),
                stagger: false
            },
            // 2. Horizontal lines for low values
            {
                id: 'lines-low',
                type: 'patternLines',
                background: 'inherit',
                color: 'rgba(0, 0, 0, 0.5)',
                spacing: getPatternScale(3, 0).size,
                rotation: 0,
                lineWidth: Math.max(1, getPatternScale(1, 0).size)
            },
            // 3. Small squares for low-medium values
            {
                id: 'squares-low-medium',
                type: 'patternSquares',
                background: 'inherit',
                color: 'rgba(0, 0, 0, 0.4)',
                ...getPatternScale(2, 3),
                stagger: false
            },
            // 4. Diagonal lines for medium values
            {
                id: 'lines-medium',
                type: 'patternLines',
                background: 'inherit',
                color: 'rgba(0, 0, 0, 0.5)',
                spacing: getPatternScale(4, 0).size,
                rotation: 45,
                lineWidth: Math.max(1, getPatternScale(2, 0).size)
            },
            // 5. Vertical lines for medium-high values
            {
                id: 'lines-medium-high',
                type: 'patternLines',
                background: 'inherit',
                color: 'rgba(0, 0, 0, 0.6)',
                spacing: getPatternScale(3, 0).size,
                rotation: 90,
                lineWidth: Math.max(1, getPatternScale(1, 0).size)
            },
            // 6. Large squares for high values
            {
                id: 'squares-high',
                type: 'patternSquares',
                background: 'inherit',
                color: 'rgba(0, 0, 0, 0.5)',
                ...getPatternScale(4, 1),
                stagger: true
            },
            // 7. Large dots for very high values
            {
                id: 'dots-very-high',
                type: 'patternDots',
                background: 'inherit',
                color: 'rgba(0, 0, 0, 0.7)',
                ...getPatternScale(4, 1),
                stagger: true
            }
        ];
    }, [patternsEnabled, zoomLevel]);

    // Pattern matching function
    const createPatternMatcher = useCallback((minPercent, maxPercent, patternId) => ({
        match: (feature) => {
            // Always return false if patterns are disabled or no data
            if (!patternsEnabled || !dataRange) return false;
            
            // Check if feature has a valid value
            if (!feature || !feature.value || feature.value === 0) return false;
            
            // Calculate normalized value
            if (dataRange.range <= 0) return false;
            const normalizedValue = (feature.value - dataRange.min) / dataRange.range;
            
            // Check if value falls within this pattern's range
            return normalizedValue >= minPercent && normalizedValue < maxPercent;
        },
        id: patternId
    }), [dataRange?.min, dataRange?.max, dataRange?.range, patternsEnabled]);

    // Pattern fill rules
    const patternFills = useMemo(() => {
        if (!patternsEnabled) return [];
        
        return [
            createPatternMatcher(0, 1/7, 'dots-very-low'),
            createPatternMatcher(1/7, 2/7, 'lines-low'),
            createPatternMatcher(2/7, 3/7, 'squares-low-medium'),
            createPatternMatcher(3/7, 4/7, 'lines-medium'),
            createPatternMatcher(4/7, 5/7, 'lines-medium-high'),
            createPatternMatcher(5/7, 6/7, 'squares-high'),
            createPatternMatcher(6/7, 1, 'dots-very-high')
        ];
    }, [createPatternMatcher, patternsEnabled]);

    // Create color scale with classification method
    const colorScale = useMemo(() => {
        if (!hasActualData || !dataValues) {
            return null;
        }
        
        return createClassifiedColorScale(
            colors,  
            domain, 
            classificationMethod, 
            dataValues,
        );
    }, [colors, domain, classificationMethod, dataValues, hasActualData])



    const findMatchingDatum = useMemo(() => {
        if (isFunction(match)) return match
        return (feature, datum) => {
            const featureKey = get(feature, match)
            const datumKey = get(datum, match)
            return featureKey && featureKey === datumKey
        }
    }, [match])
    
    const getLabel = useMemo(
        () => (isFunction(label) ? label : datum => get(datum, label)),
        [label] 
    )
    
    const getValue = useMemo(
        () => (isFunction(value) ? value : datum => get(datum, value)),
        [value]
    )
    
    const valueFormatter = useMemo(() => {
        if (!metric || !metricOptions[metric]) {
            if (valueFormat === undefined) return d => d;
            if (isFunction(valueFormat)) return valueFormat;
            return format(valueFormat);
        }

        return createValueFormatter(metric, metricOptions);
    }, [metric, metricOptions, valueFormat]);

    const getFillColor = useMemo(() => {
        return feature => {
            if (!colorScale || feature.value === undefined) return unknownColor
            return colorScale(feature.value)
        }
    }, [colorScale, unknownColor])

    const boundFeatures = useMemo(
        () => {
            if (!features || !data) return [];
            
            return features.map(feature => {
                const datum = data.find(datum => findMatchingDatum(feature, datum))
                const datumValue = getValue(datum)

                if (datum) {
                    const featureWithData = {
                        ...feature,
                        data: datum,
                        value: datumValue,
                        formattedValue: valueFormatter(datumValue),
                    }
                    featureWithData.color = getFillColor(featureWithData)
                    featureWithData.label = getLabel(featureWithData)

                    return featureWithData
                }

                return feature
            })
        },
        [features, data, findMatchingDatum, getValue, valueFormatter, getFillColor, getLabel]
    )

    const legendData = useQuantizeColorScaleLegendData({
        colors: colors,
        scale: colorScale,
        valueFormat: valueFormatter,
        unknownColor: unknownColor,
        patternsEnabled: patternsEnabled,
        patternFills: patternFills,
    })

    return {
        colorScale,
        getFillColor,
        boundFeatures,
        valueFormatter,
        legendData,
        patternDefs,
        patternFills,
    }
}

export const useQuantizeColorScaleLegendData = ({
    scale,
    domain: overriddenDomain,
    reverse = false,
    valueFormat = v => v,
    separator = ' - ',
    unknownColor = '#dee2e6',
    patternsEnabled = false,
    patternFills = [],
}) => {
    return useMemo(() => {
        // If no scale is provided, return empty legend data
        if (!scale) {
            return [{
                id: unknownColor,
                index: 0,
                extent: [unknownColor, unknownColor],
                label: 'No data',
                value: unknownColor,
                color: unknownColor,
                pattern: '',
            }];
        }
        
        // Get the colors from range (for display) and breaks from domain (for data ranges)
        const colors = overriddenDomain ?? scale.range();
        const dataBreaks = scale.domain();

        // Create pattern ID mapping for legend
        const patternMapping = patternsEnabled ? {
            'dots-very-low': '⚬',      // Small circle
            'lines-low': '━',          // Horizontal line
            'squares-low-medium': '▢', // Empty square
            'lines-medium': '⟋',       // Diagonal line
            'lines-medium-high': '┃',  // Vertical line
            'squares-high': '■',       // Filled square
            'dots-very-high': '●'      // Filled circle
        } : {};
        
        const items = colors.map((color, index) => {
            // Ensure we don't create legend items beyond the available data breaks.
            if (index >= dataBreaks.length - 1) {
                return null;
            }

            // For threshold scales, each color represents a range between consecutive breaks
            const start = dataBreaks[index];
            const end = dataBreaks[index + 1];
            
            // Find matching pattern for this value range
            let patternSymbol = '';
            if (patternsEnabled && patternFills.length > 0) {
                // Calculate which pattern this range should use
                const patternIndex = Math.min(index, patternFills.length - 1);
                const patternId = patternFills[patternIndex]?.id;
                patternSymbol = patternMapping[patternId] || '';
            }
            
            return {
                id: color,
                index,
                extent: [start, end],
                label: `${valueFormat(start)}${separator}${valueFormat(end)}`,
                value: scale(start),
                color: color,
                pattern: patternSymbol,
            }
        }).filter(item => item !== null);

        // we need to add unknownColor to the domain we need to add it to the end of the domain
        items.unshift({
            id: unknownColor,
            index: items.length,
            extent: [unknownColor, unknownColor],
            label: 'No data',
            value: scale(unknownColor),
            color: unknownColor,
            pattern: '',
        })

        if (reverse) items.reverse()

        return items
    }, [overriddenDomain, scale, reverse, separator, valueFormat, unknownColor, patternsEnabled, patternFills])
}