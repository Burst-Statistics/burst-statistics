import { memo } from '@wordpress/element';

/**
 * Normalize SVG `url(#pattern-id)` fills to quoted form.
 *
 * Quoted URLs are required when generated pattern IDs contain CSS variable
 * syntax (for example `var(--color-green-50)`), because unquoted `url(#...)`
 * parsing breaks on nested parentheses.
 *
 * @param {string} fillValue SVG fill value.
 * @return {string} Safe fill value for the path element.
 */
const normalizePatternFillUrl = ( fillValue ) => {
	if ( 'string' !== typeof fillValue ) {
		return fillValue;
	}

	const match = fillValue.match( /^url\(#(.+)\)$/ );
	if ( ! match ) {
		return fillValue;
	}

	return `url("#${match[1]}")`;
};

/**
 * GeoMapFeature.propTypes = {
 *     feature: PropTypes.shape({
 *         id: PropTypes.string.isRequired,
 *         type: PropTypes.oneOf(['Feature']).isRequired,
 *         properties: PropTypes.object,
 *         geometry: PropTypes.object.isRequired,
 *     }).isRequired,
 *     path: PropTypes.func.isRequired,
 *
 *     fillColor: PropTypes.string.isRequired,
 *     borderWidth: PropTypes.number.isRequired,
 *     borderColor: PropTypes.string.isRequired,
 *
 *     onMouseEnter: PropTypes.func.isRequired,
 *     onMouseMove: PropTypes.func.isRequired,
 *     onMouseLeave: PropTypes.func.isRequired,
 *     onClick: PropTypes.func.isRequired,
 * }
 */
const GeoMapFeature = memo(
	({
		feature,
		path,
		fillColor,
		borderWidth,
		borderColor,
		onClick,
		onMouseEnter,
		onMouseMove,
		onMouseLeave,
		opacity = 1
	}) => {
		const resolvedFill = normalizePatternFillUrl( feature?.fill ?? fillColor );

		return (
			<path

				//this class is used for the tracking test. Do not remove or change it without updating the test as well.
				className={'burst-region-' + feature?.properties?.name}
				key={feature.id}
				fill={resolvedFill}
				strokeWidth={borderWidth}
				stroke={borderColor}
				strokeLinejoin="bevel"
				d={path( feature )}
				opacity={opacity}
				style={{ cursor: onClick ? 'pointer' : 'default' }}
				onMouseEnter={( event ) => onMouseEnter?.( feature, event )}
				onMouseMove={( event ) => onMouseMove?.( feature, event )}
				onMouseLeave={( event ) => onMouseLeave?.( feature, event )}
				onClick={( event ) => onClick?.( feature, event )}
			/>
		);
	}
);

GeoMapFeature.displayName = 'GeoMapFeature';

export default GeoMapFeature;
