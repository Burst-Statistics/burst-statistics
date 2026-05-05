/**
 * Performance optimization utilities for choropleth maps
 * Implements techniques for handling complex geometries and large datasets
 */

/**
 * Simplify GeoJSON features based on zoom level and viewport
 * @param {Object[]} features  - GeoJSON features
 * @param {number}   zoomLevel - Current zoom level (1-100)
 * @param {Object}   viewport  - Viewport bounds
 * @param {number}   tolerance - Simplification tolerance
 * @return {Object[]} Simplified features
 */
export const simplifyFeatures = (
	features,
	zoomLevel = 1,
	viewport = null, // eslint-disable-line @typescript-eslint/no-unused-vars
	tolerance = 0.01
) => {
	if ( ! features || 0 === features.length ) {
		return features;
	}

	// Adjust tolerance based on zoom level - higher zoom = less simplification
	const adjustedTolerance = tolerance / Math.max( zoomLevel, 1 );

	return features.map( ( feature ) => {

		// For very low zoom levels, use more aggressive simplification
		if ( 5 > zoomLevel ) {
			return simplifyGeometry( feature, adjustedTolerance * 2 );
		}

		// For medium zoom levels, moderate simplification
		if ( 20 > zoomLevel ) {
			return simplifyGeometry( feature, adjustedTolerance );
		}

		// For high zoom levels, minimal or no simplification
		return feature;
	});
};

/**
 * Simplify individual geometry using Douglas-Peucker algorithm
 * @param {Object} feature   - GeoJSON feature
 * @param {number} tolerance - Simplification tolerance
 * @return {Object} Simplified feature
 */
const simplifyGeometry = ( feature, tolerance ) => {
	if ( ! feature.geometry || ! feature.geometry.coordinates ) {
		return feature;
	}

	const simplifiedCoordinates = simplifyCoordinates(
		feature.geometry.coordinates,
		tolerance
	);

	return {
		...feature,
		geometry: {
			...feature.geometry,
			coordinates: simplifiedCoordinates
		}
	};
};

/**
 * Simplify coordinate arrays using Douglas-Peucker algorithm
 * @param {Array}  coordinates - Coordinate array
 * @param {number} tolerance   - Simplification tolerance
 * @return {Array} Simplified coordinates
 */
const simplifyCoordinates = ( coordinates, tolerance ) => {
	if ( ! Array.isArray( coordinates ) ) {
		return coordinates;
	}

	// Handle different geometry types
	if ( 'number' === typeof coordinates[0]) {

		// Single coordinate pair
		return coordinates;
	}

	if (
		Array.isArray( coordinates[0]) &&
		'number' === typeof coordinates[0][0]
	) {

		// Array of coordinate pairs (LineString or LinearRing)
		return douglasPeucker( coordinates, tolerance );
	}

	// Nested arrays (Polygon or MultiPolygon)
	return coordinates.map( ( coord ) => simplifyCoordinates( coord, tolerance ) );
};

/**
 * Douglas-Peucker line simplification algorithm
 * @param {Array}  points    - Array of [x, y] coordinate pairs
 * @param {number} tolerance - Simplification tolerance
 * @return {Array} Simplified points
 */
const douglasPeucker = ( points, tolerance ) => {
	if ( 2 >= points.length ) {
		return points;
	}

	const sqTolerance = tolerance * tolerance;

	// Find the point with maximum distance from the line between first and last points
	let maxDistance = 0;
	let maxIndex = 0;

	for ( let i = 1; i < points.length - 1; i++ ) {
		const distance = perpendicularDistanceSquared(
			points[i],
			points[0],
			points[points.length - 1]
		);
		if ( distance > maxDistance ) {
			maxDistance = distance;
			maxIndex = i;
		}
	}

	// If max distance is greater than tolerance, recursively simplify
	if ( maxDistance > sqTolerance ) {
		const left = douglasPeucker( points.slice( 0, maxIndex + 1 ), tolerance );
		const right = douglasPeucker( points.slice( maxIndex ), tolerance );

		// Combine results, removing duplicate point at junction
		return left.slice( 0, -1 ).concat( right );
	}

	// If max distance is within tolerance, return just the endpoints
	return [ points[0], points[points.length - 1] ];
};

/**
 * Calculate squared perpendicular distance from point to line
 * @param {Array} point     - [x, y] coordinate
 * @param {Array} lineStart - [x, y] line start coordinate
 * @param {Array} lineEnd   - [x, y] line end coordinate
 * @return {number} Squared distance
 */
const perpendicularDistanceSquared = ( point, lineStart, lineEnd ) => {
	const [ px, py ] = point;
	const [ x1, y1 ] = lineStart;
	const [ x2, y2 ] = lineEnd;

	const dx = x2 - x1;
	const dy = y2 - y1;

	if ( 0 === dx && 0 === dy ) {

		// Line is actually a point
		const dpx = px - x1;
		const dpy = py - y1;
		return dpx * dpx + dpy * dpy;
	}

	const t = ( ( px - x1 ) * dx + ( py - y1 ) * dy ) / ( dx * dx + dy * dy );

	let closestX, closestY;
	if ( 0 > t ) {
		closestX = x1;
		closestY = y1;
	} else if ( 1 < t ) {
		closestX = x2;
		closestY = y2;
	} else {
		closestX = x1 + t * dx;
		closestY = y1 + t * dy;
	}

	const dpx = px - closestX;
	const dpy = py - closestY;
	return dpx * dpx + dpy * dpy;
};

/**
 * Filter features based on viewport bounds for performance
 * @param {Object[]} features - GeoJSON features
 * @param {Object}   bounds   - Viewport bounds {north, south, east, west}
 * @return {Object[]} Filtered features
 */
export const filterFeaturesByBounds = ( features, bounds ) => {
	if ( ! features || ! bounds ) {
		return features;
	}

	return features.filter( ( feature ) => {
		if ( ! feature.geometry || ! feature.geometry.coordinates ) {
			return true;
		}

		const bbox = calculateBoundingBox( feature.geometry.coordinates );
		if ( ! bbox ) {
			return true;
		}

		// Check if feature bounding box intersects with viewport bounds
		return ! (
			bbox.east < bounds.west ||
			bbox.west > bounds.east ||
			bbox.north < bounds.south ||
			bbox.south > bounds.north
		);
	});
};

/**
 * Calculate bounding box for geometry coordinates
 * @param {Array} coordinates - Geometry coordinates
 * @return {Object|null} Bounding box {north, south, east, west}
 */
const calculateBoundingBox = ( coordinates ) => {
	if ( ! Array.isArray( coordinates ) ) {
		return null;
	}

	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity;

	const processCoordinate = ( coord ) => {
		if ( 'number' === typeof coord[0] && 'number' === typeof coord[1]) {
			minX = Math.min( minX, coord[0]);
			maxX = Math.max( maxX, coord[0]);
			minY = Math.min( minY, coord[1]);
			maxY = Math.max( maxY, coord[1]);
		} else if ( Array.isArray( coord ) ) {
			coord.forEach( processCoordinate );
		}
	};

	processCoordinate( coordinates );

	if ( minX === Infinity ) {
		return null;
	}

	return {
		west: minX,
		east: maxX,
		south: minY,
		north: maxY
	};
};

/**
 * Optimize data for rendering based on classification
 * @param {Object[]} data           - Raw data array
 * @param {Object}   classification - Classification result
 * @return {Object[]} Optimized data
 */
export const optimizeDataForRendering = ( data, classification ) => {
	if ( ! data || ! classification ) {
		return data;
	}

	// Pre-calculate color assignments to avoid repeated calculations
	return data.map( ( item ) => ({
		...item,
		_renderOptimized: true,
		_classIndex: getClassIndex( item.value, classification.breaks )
	}) );
};

/**
 * Get class index for a value based on classification breaks
 * @param {number}   value  - Data value
 * @param {number[]} breaks - Classification breaks
 * @return {number} Class index
 */
const getClassIndex = ( value, breaks ) => {
	if ( ! breaks || 2 > breaks.length ) {
		return 0;
	}

	for ( let i = 0; i < breaks.length - 1; i++ ) {
		if ( value <= breaks[i + 1]) {
			return i;
		}
	}

	return breaks.length - 2; // Last class
};

/**
 * Debounce function for performance-sensitive operations
 * @param {Function} func - Function to debounce
 * @param {number}   wait - Wait time in milliseconds
 * @return {Function} Debounced function
 */
export const debounce = ( func, wait ) => {
	let timeout;
	return function executedFunction( ...args ) {
		const later = () => {
			clearTimeout( timeout );
			func( ...args );
		};
		clearTimeout( timeout );
		timeout = setTimeout( later, wait );
	};
};

/**
 * Throttle function for performance-sensitive operations
 * @param {Function} func  - Function to throttle
 * @param {number}   limit - Time limit in milliseconds
 * @return {Function} Throttled function
 */
export const throttle = ( func, limit ) => {
	let inThrottle;
	return function executedFunction( ...args ) {
		if ( ! inThrottle ) {
			func.apply( this, args );
			inThrottle = true;
			setTimeout( () => ( inThrottle = false ), limit );
		}
	};
};

/**
 * Memoization utility for expensive calculations
 * @param {Function} fn           - Function to memoize
 * @param {Function} keyGenerator - Function to generate cache key
 * @return {Function} Memoized function
 */
export const memoize = (
	fn,
	keyGenerator = ( ...args ) => JSON.stringify( args )
) => {
	const cache = new Map();

	return ( ...args ) => {
		const key = keyGenerator( ...args );

		if ( cache.has( key ) ) {
			return cache.get( key );
		}

		const result = fn( ...args );
		cache.set( key, result );

		// Limit cache size to prevent memory leaks
		if ( 100 < cache.size ) {
			const firstKey = cache.keys().next().value;
			cache.delete( firstKey );
		}

		return result;
	};
};
