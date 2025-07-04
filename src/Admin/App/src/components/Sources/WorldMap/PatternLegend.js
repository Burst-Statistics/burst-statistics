import { memo } from 'react'

const PatternLegend = memo(({ 
    data, 
    containerWidth, 
    containerHeight,
    anchor = 'bottom-left',
    translateX = 20,
    translateY = -100,
    itemWidth = 94,
    itemHeight = 18,
    itemsSpacing = 0,
    itemTextColor = '#444444',
    symbolSize = 18,
    patternsEnabled = false
}) => {
    if (!data || data.length === 0) return null;

    // Calculate position based on anchor - simplified and safer
    const getPosition = () => {
        // Calculate legend dimensions
        const legendHeight = data.length * (itemHeight + itemsSpacing);
        const legendWidth = itemWidth;
        
        let x, y;
        
        // Simple positioning based on anchor
        switch (anchor) {
            case 'bottom-left':
                x = 20;
                y = containerHeight - legendHeight - 20;
                break;
            case 'bottom-right':
                x = containerWidth - legendWidth - 20;
                y = containerHeight - legendHeight - 20;
                break;
            case 'top-left':
                x = 20;
                y = 20;
                break;
            case 'top-right':
                x = containerWidth - legendWidth - 20;
                y = 20;
                break;
            default:
                // Default to bottom-left
                x = 20;
                y = containerHeight - legendHeight - 20;
        }
        
        // Ensure legend stays within bounds with padding
        x = Math.max(10, Math.min(x, containerWidth - legendWidth - 10));
        y = Math.max(10, Math.min(y, containerHeight - legendHeight - 10));
        
        return { x, y };
    };

    const { x, y } = getPosition();

    return (
        <g className="pattern-legend" transform={`translate(${x}, ${y})`}>
            {data.map((item, index) => {
                const itemY = index * (itemHeight + itemsSpacing);
                
                return (
                    <g key={item.id} className="legend-item" transform={`translate(0, ${itemY})`}>
                        {/* Color rectangle */}
                        <rect
                            x={0}
                            y={0}
                            width={symbolSize}
                            height={symbolSize}
                            fill={item.color}
                            stroke="rgba(0,0,0,0.1)"
                            strokeWidth={0.5}
                        />
                        
                        {/* Pattern overlay if patterns are enabled */}
                        {patternsEnabled && item.pattern && (
                            <text
                                x={symbolSize / 2}
                                y={symbolSize / 2}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize="10"
                                fill="rgba(0,0,0,0.8)"
                                fontWeight="bold"
                            >
                                {item.pattern}
                            </text>
                        )}
                        
                        {/* Label text */}
                        <text
                            x={symbolSize + 8}
                            y={symbolSize / 2}
                            dominantBaseline="central"
                            fontSize="11"
                            fill={itemTextColor}
                        >
                            {item.label}
                        </text>
                    </g>
                );
            })}
        </g>
    );
});

export default PatternLegend; 