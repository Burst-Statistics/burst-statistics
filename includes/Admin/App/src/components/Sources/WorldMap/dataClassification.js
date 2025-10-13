import { scaleQuantize, scaleThreshold } from 'd3-scale'

export const quantizeColorScales = {
  // Sequential scheme: good for low-to-high data
  blues: [
    "#f7fbff",
    "#deebf7",
    "#9ecae1",
    "#6baed6",
    "#3182bd",
    "#08519c",
    "#08306b",
  ],

  // Sequential scheme: good for low-to-high data
  greens: [
    "#d5edce",
    "#c1e2ba",
    "#a1d99b",
    "#41ab5d",
    "#238b45",
    "#006d2c",
    "#00441b",
  ],

  // A sequential red scheme with a cooler, less orange tone
  reds: [
    "#ffebee",
    "#ffcdd2",
    "#ef9a9a",
    "#e53935",
    "#cb181d",
    "#a50f15",
    "#67000d",
  ],

  // Diverging scheme with a yellow center to avoid white
  blueRedDiverging: [
    "#313695",
    "#74add1",
    "#e0f3f8",
    "#ffffbf",
    "#fee090",
    "#f46d43",
    "#a50026",
  ],

  // Diverging scheme from green to red with a yellow center
  greenRedDiverging: [
    "#006837",
    "#66bd63",
    "#d9ef8b",
    "#ffffbf",
    "#fee08b",
    "#f46d43",
    "#a50026",
  ],
};

/**
 * Apply classification method to data with optimal number of classes
 * @param {number[]} values - Array of numeric values
 * @param {string} method - Classification method ('quantile', 'equal-interval', 'standard-deviation', 'natural-breaks')
 * @returns {number[]} Array of break points, or empty array if classification fails
 * @throws {Error} When invalid parameters are provided
 */
export const classifyData = (values, method = 'quantile') => {
  if (!values || !Array.isArray(values)) {
    console.error('values parameter must be an array');
    return [];
  }

  if (values.length === 0) {
    console.error('values array cannot be empty');
    return [];
  }

  // Filter out invalid values
  const validValues = values.filter(v => v != null && !isNaN(v) && isFinite(v));

  if (validValues.length === 0) {
    console.error('validValues array cannot be empty');
    return [];
  }

  if (validValues.length < 2) {
    console.error('validValues array must have at least 2 values');
    return [];
  }

  const validMethods = ['quantile', 'equal-interval', 'standard-deviation', 'natural-breaks'];
  if (!validMethods.includes(method)) {
    console.error(`Invalid classification method '${method}'. Valid methods: ${validMethods.join(', ')}`);
    return [];
  }

  let result;
  try {
    switch (method) {
      case 'natural-breaks':
        result = jenksNaturalBreaks(validValues);
        break;
      case 'equal-interval':
        result = equalInterval(validValues);
        break;
      case 'standard-deviation':
        result = standardDeviation(validValues);
        break;
      case 'quantile':
        result = quantileClassification(validValues);
        break;
    }
  } catch (error) {
    console.error('classification method failed', error);
    return [];
  }

  if (!result || result.length < 2) {
    console.error('classification result is invalid');
    return [];
  }

  return result;
};

/**
 * Simple version of guessQuantizeColorScale
 * Creates a quantize scale from colors array or predefined scheme
 * @param {string|Array|Function} colors - Color scheme key, array of colors, or existing scale function
 * @returns {Function} D3 quantize scale function
 * @throws {Error} When invalid parameters are provided
 */
export const createQuantizeColorScale = (colors) => {
  // Validate input parameter
  if (!colors) {
    throw new Error('colors parameter is required');
  }

  // If colors is already a function (existing scale), return it
  if (typeof colors === 'function') {
    if (typeof colors.domain !== 'function') {
      throw new Error('Provided colors should be a valid quantize scale with a domain() function');
    }
    return colors;
  }

  // If colors is a predefined scheme key
  if (typeof colors === 'string') {
    if (!quantizeColorScales[colors]) {
      throw new Error(`Unknown color scheme '${colors}'. Available schemes: ${Object.keys(quantizeColorScales).join(', ')}`);
    }
    return scaleQuantize().range(quantizeColorScales[colors]);
  }

  // If colors is an array of colors
  if (Array.isArray(colors)) {
    if (colors.length === 0) {
      throw new Error('Color array cannot be empty');
    }
    return scaleQuantize().range(colors);
  }

  // No fallback - throw error for invalid input
  throw new Error('colors must be a string key, array of colors, or existing scale function');
}

/**
 * Create a classified color scale with specific method and optimal number of classes
 * @param {string|Array} colorScheme - Color scheme key or array of colors
 * @param {Array} domain - [min, max] domain values or array of break points
 * @param {string} method - Classification method
 * @param {number[]|null} values - Raw data values for classification, or null for empty state
 * @returns {Function|null} Configured color scale, or null if values is null/undefined
 * @throws {Error} When invalid parameters are provided
 */
export const createClassifiedColorScale = (colorScheme, domain = [0, 100], method = 'quantile', values = [0, 0]) => {

  // Validate colorScheme parameter
  if (!colorScheme) {
    throw new Error('colorScheme parameter is required');
  }

  let colors;

  // If it's a string key, get the color array
  if (typeof colorScheme === 'string') {
    if (!quantizeColorScales[colorScheme]) {
      throw new Error(`Unknown color scheme '${colorScheme}'. Available schemes: ${Object.keys(quantizeColorScales).join(', ')}`);
    }
    colors = quantizeColorScales[colorScheme];
  } else if (Array.isArray(colorScheme)) {
    if (colorScheme.length === 0) {
      throw new Error('Color scheme array cannot be empty');
    }
    colors = colorScheme;
  } else {
    throw new Error('colorScheme must be either a string key or an array of colors');
  }

  // Validate method parameter
  const validMethods = ['quantile', 'equal-interval', 'standard-deviation', 'natural-breaks'];
  if (!validMethods.includes(method)) {
    throw new Error(`Invalid classification method '${method}'. Valid methods: ${validMethods.join(', ')}`);
  }

  // If values are not set (null/undefined), return empty state
  if (values === null || values === undefined) {
    return null;
  }

  // If values are provided, validate them
  if (!Array.isArray(values)) {
    throw new Error('values parameter must be an array when provided');
  }

  if (values.length === 0) {
    return null; // Return null for empty array instead of throwing error
  }

  // Check if we have any valid numeric values
  const validValues = values.filter(v => v != null && !isNaN(v) && isFinite(v));
  if (validValues.length === 0) {
    return null; // Return null if no valid values instead of throwing error
  }

  if (validValues.length < 2) {
    return null; // Return null if insufficient valid values instead of throwing error
  }

  // Validate domain parameter
  if (!Array.isArray(domain)) {
    throw new Error('domain parameter must be an array');
  }

  let breaks;
  try {
    breaks = classifyData(values, method);
  } catch (error) {
    // If classification fails, return null instead of throwing error
		console.error('[WorldMap] Classification failed:', error);
    return null;
  }

  if (!breaks || breaks.length < 2) {
		console.warn('[WorldMap] Invalid breaks, returning null.');
    return null; // Return null instead of throwing error
  }

  const numClasses = breaks.length - 1; // Number of classes = number of breaks - 1

  if (numClasses < 1) {
    throw new Error('Classification resulted in no valid classes');
  }

  // // Select appropriate number of colors based on determined classes
  let selectedColors; 
  // if (numClasses >= colors.length) {
    selectedColors = colors;
  // } else {
  //   // For sequential schemes, take evenly spaced colors
  //   const step = Math.floor(colors.length / numClasses);
  //   selectedColors = [];
  //   for (let i = 0; i < numClasses; i++) {
  //     const index = Math.min(i * step, colors.length - 1);
  //     selectedColors.push(colors[index]);
  //   }
  // }

  // For other methods (quantile, natural-breaks, standard-deviation), use threshold scale
  if (breaks.length > 2) {
		// For threshold scale, domain should consist of the upper bound of each class, excluding the overall max.
		// If we have N colors (classes), we need N-1 thresholds.
		// `breaks` includes min and max, so we get the inner values.
		const scaleDomain = breaks.slice(1, -1);

    const scale = scaleThreshold()
      .domain(scaleDomain)
      .range(selectedColors);

		// Return a wrapper function to handle the 0 case specifically,
		// while also exposing domain() and range() for the legend.
		const wrapper = (value) => {
			if (value === 0) {
				return selectedColors[0];
			}
			return scale(value);
		};
		wrapper.domain = () => breaks;
		wrapper.range = () => selectedColors;

		return wrapper;
  } else {
    // If only 2 breaks (min, max), create a simple quantize scale
		const scaleDomain = [breaks[0], breaks[breaks.length - 1]];

    const scale = scaleQuantize()
      .domain(scaleDomain)
      .range(selectedColors);

		// Return a wrapper function to handle the 0 case specifically,
		// while also exposing domain() and range() for the legend.
		const wrapper = (value) => {
			if (value === 0 && scaleDomain[0] === 0) {
				return selectedColors[0];
			}
			return scale(value);
		};
		wrapper.domain = () => {
			const domain = scale.domain();
			if (typeof scale.quantiles !== 'function') {
				return domain;
			}
			const quantiles = scale.quantiles();
			return [domain[0], ...quantiles, domain[1]];
		};
		wrapper.range = () => scale.range();

		return wrapper;
  }

}



/**
 * Normalize data to rates or densities
 * @param {Object[]} data - Array of data objects
 * @param {string} valueField - Field containing the raw values
 * @param {string} populationField - Field containing population data for normalization
 * @param {number} multiplier - Multiplier for rate calculation (e.g., 1000 for per 1000)
 * @returns {Object[]} Normalized data
 */
export const normalizeToRate = (data, valueField, populationField, multiplier = 1000) => {
  return data.map(item => {
    const value = item[valueField] || 0;
    const population = item[populationField] || 1; // Avoid division by zero

    return {
      ...item,
      [`${valueField}_rate`]: population > 0 ? (value / population) * multiplier : 0,
      [`${valueField}_normalized`]: population > 0 ? (value / population) * multiplier : 0
    };
  });
};

/**
 * Quantile classification
 * Divides data into classes where each class contains approximately the same number of observations.
 * @param {number[]} values - Array of numeric values (must be sorted)
 * @returns {number[]} Array of break points including min and max
 */
const quantileClassification = (values) => {
  if (!values || values.length === 0) return [];

  // Convert all values to numbers and filter out invalid values
  const numericValues = values.map(v => Number(v)).filter(v => !isNaN(v) && isFinite(v));

  if (numericValues.length === 0) return [];

  // Separate zeros from non-zero values for better classification
  const nonZeroValues = numericValues.filter(v => v > 0);
  const hasZeros = numericValues.some(v => v === 0);

  // If we only have zeros, return a simple range
  if (nonZeroValues.length === 0) {
    return hasZeros ? [0, 0] : [];
  }

  // Check if we have enough non-zero values for meaningful classification
  if (nonZeroValues.length < 2) {
    if (hasZeros) {
      return [0, nonZeroValues[0]];
    } else {
      return [nonZeroValues[0], nonZeroValues[0]];
    }
  }

  // Use non-zero values for quantile calculation
  const sortedValues = [...nonZeroValues].sort((a, b) => a - b);

  // Determine optimal number of classes using Sturges' rule, constrained to 3-7
  const numClasses = Math.max(3, Math.min(7, Math.ceil(1 + Math.log2(sortedValues.length))));

  const breaks = [];

  // Add zero as first break only if we have zero values
  if (hasZeros) {
    breaks.push(0);
  }

  // Calculate quantile break points for non-zero values
  for (let i = 1; i < numClasses; i++) {
    const position = (i / numClasses) * (sortedValues.length - 1);
    const lower = Math.floor(position);
    const upper = Math.ceil(position);

    if (lower === upper) {
      const breakValue = sortedValues[lower];
      breaks.push(breakValue);
    } else {
      // Linear interpolation between the two nearest values
      const weight = position - lower;
      const interpolatedValue = sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
      breaks.push(interpolatedValue);
    }
  }

  // Add maximum value (ensure it's the actual maximum)
  const maxValue = sortedValues[sortedValues.length - 1];
  if (breaks[breaks.length - 1] !== maxValue) {
    breaks.push(maxValue);
  }

  // Remove duplicate breaks with proper floating-point handling
  // Sort first to ensure proper order
  const sortedBreaks = breaks.sort((a, b) => a - b);

  // Remove duplicates with floating-point tolerance
  const uniqueBreaks = [];
  const tolerance = 1e-10;

  for (let i = 0; i < sortedBreaks.length; i++) {
    if (i === 0 || Math.abs(sortedBreaks[i] - sortedBreaks[i - 1]) > tolerance) {
      uniqueBreaks.push(sortedBreaks[i]);
    }
  }

  return uniqueBreaks;
};

/**
 * Equal interval classification
 * Divides the range of values into equal-sized intervals.
 * @param {number[]} values - Array of numeric values
 * @returns {number[]} Array of break points including min and max
 */
const equalInterval = (values) => {
  if (!values || values.length === 0) return [];

  // Convert all values to numbers and filter out invalid values.
  const numericValues = values.map(v => Number(v)).filter(v => !isNaN(v) && isFinite(v));

  if (numericValues.length === 0) return [];

  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);

  // Determine optimal number of classes using Sturges' rule, constrained to 3-7.
  let numClasses = Math.max(3, Math.min(7, Math.ceil(1 + Math.log2(numericValues.length))));

  // If the values range from 0 to 100, use 5 classes for nice, round breaks.
  if (min === 0 && max === 100) {
    numClasses = 5;
  }

  const range = max - min;
  const interval = range / numClasses;

  const breaks = [];
  for (let i = 0; i <= numClasses; i++) {
    breaks.push(min + (interval * i));
  }

  return breaks;
};

/**
 * Standard deviation classification
 * Creates classes based on standard deviations from the mean.
 * @param {number[]} values - Array of numeric values
 * @returns {number[]} Array of break points including min and max
 */
const standardDeviation = (values) => {
  if (!values || values.length === 0) return [];

  // Convert all values to numbers and filter out invalid values
  const numericValues = values.map(v => Number(v)).filter(v => !isNaN(v) && isFinite(v));

  if (numericValues.length === 0) return [];



  // Calculate mean and standard deviation
  const mean = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
  const variance = numericValues.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / numericValues.length;
  const stdDev = Math.sqrt(variance);

  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);



  // Determine how many standard deviations fit in the data range
  const dataRange = max - min;
  const deviationsInRange = dataRange / (2 * stdDev); // Approximate deviations needed to cover the range



  // Determine optimal number of classes based on data spread, constrained to 3-7
  // More spread = more classes, less spread = fewer classes
  let optimalClasses;
  if (deviationsInRange >= 3) {
    optimalClasses = 7;
  } else if (deviationsInRange >= 2) {
    optimalClasses = 5;
  } else if (deviationsInRange >= 1) {
    optimalClasses = 4;
  } else {
    optimalClasses = 3;
  }

  const numClasses = optimalClasses;
  const halfClasses = Math.floor(numClasses / 2);


  const breaks = [];

  // Create breaks symmetrically around the mean
  for (let i = -halfClasses; i <= halfClasses; i++) {
    const breakPoint = mean + (i * stdDev);
    breaks.push(breakPoint);
  }

  // If we have an even number of classes, add one more break
  if (numClasses % 2 === 0) {
    breaks.push(mean + ((halfClasses + 1) * stdDev));
  }



  // Sort breaks first
  breaks.sort((a, b) => a - b);

  // Constrain all breaks to the actual data range (no negative values if min >= 0)
  const constrainedBreaks = breaks.map(breakPoint => Math.max(Math.min(breakPoint, max), min));



  // Remove duplicates that might result from constraining - use Array.from instead of spread
  const breakSet = new Set(constrainedBreaks);
  const uniqueBreaks = Array.from(breakSet).sort((a, b) => a - b);



  // If we lost too many breaks due to constraining, throw error
  if (uniqueBreaks.length < 3) {
    throw new Error('Standard deviation classification failed: data distribution does not allow for meaningful standard deviation classes');
  }

  // Adjust to ensure we have exactly numClasses + 1 breaks
  let finalBreaks = [...uniqueBreaks];

  // If we have too many breaks, remove some from the middle
  while (finalBreaks.length > numClasses + 1) {
    const middleIndex = Math.floor(finalBreaks.length / 2);
    finalBreaks.splice(middleIndex, 1);
  }

  // If we have too few breaks, add some using equal intervals
  while (finalBreaks.length < numClasses + 1) {
    const intervals = finalBreaks.length - 1;
    const newBreaks = [];

    for (let i = 0; i < intervals; i++) {
      newBreaks.push(finalBreaks[i]);
      if (finalBreaks.length < numClasses + 1) {
        const midPoint = (finalBreaks[i] + finalBreaks[i + 1]) / 2;
        newBreaks.push(midPoint);
      }
    }
    newBreaks.push(finalBreaks[finalBreaks.length - 1]);

    finalBreaks = Array.from(new Set(newBreaks)).sort((a, b) => a - b);

    // Prevent infinite loop
    if (newBreaks.length === finalBreaks.length) break;
  }

  // Ensure first and last breaks match actual data range
  finalBreaks[0] = min;
  finalBreaks[finalBreaks.length - 1] = max;



  return finalBreaks;
};
/**
 * Implements the Jenks Natural Breaks algorithm to find optimal data clusters.
 * This is a data clustering method designed to determine the best arrangement
 * of values into a specified number of classes. It works by seeking to
 * minimize the variance within each class and maximize the variance between
 * classes.
 *
 * The algorithm uses a dynamic programming approach to find the set of breaks
 * that results in the lowest Sum of Squared Deviations from the Class Mean (SDAM).
 *
 * @param {number[]} values - A sorted or unsorted array of numeric values.
 * @param {number} numClasses - The desired number of classes (or bins).
 * @returns {number[]} An array of break points. The array will have a
 *   length of `numClasses + 1`, including the minimum and maximum values
 *   as the first and last elements. Returns an empty array if inputs are invalid.
 */
function jenksNaturalBreaks(values, numClasses) {
  // Basic validation
  if (!values || values.length === 0) {
    return [];
  }

  // If numClasses is not provided, determine optimal number using Sturges' rule
  if (!numClasses || numClasses <= 0) {
    numClasses = Math.max(3, Math.min(7, Math.ceil(1 + Math.log2(values.length))));
  }

  if (numClasses <= 0) {
    return [];
  }

  // Convert values to numbers and filter out invalid values
  const numericValues = values.map(v => Number(v)).filter(v => !isNaN(v) && isFinite(v));

  if (numericValues.length === 0) {
    return [];
  }

  // Use numeric values for the rest of the algorithm
  const workingValues = numericValues;

  // Ensure the number of classes is not greater than the number of unique values
  const valueSet = new Set(workingValues);
  // Use Array.from instead of spread operator
  const uniqueValues = Array.from(valueSet);

  if (uniqueValues.length < numClasses) {
    // If not enough unique values, return the sorted unique values.
    // This is a sensible fallback.
    return uniqueValues.sort((a, b) => a - b);
  }

  // The algorithm requires sorted data. Create a copy to avoid mutating the original.
  const sorted = [...workingValues].sort((a, b) => a - b);
  const n = sorted.length;

  // Validate matrix dimensions before creation
  if (numClasses + 1 <= 0 || n + 1 <= 0) {
    console.error(`[ERROR] jenksNaturalBreaks: Invalid matrix dimensions: ${numClasses + 1} x ${n + 1}`);
    return [];
  }

  if (numClasses + 1 > 10000 || n + 1 > 10000) {
    console.error(`[ERROR] jenksNaturalBreaks: Matrix dimensions too large: ${numClasses + 1} x ${n + 1}`);
    return [];
  }

  // Create two matrices:
  // 1. `matrix`: Stores the minimum Sum of Squared Deviations (SDAM) for
  //    classifying the first `i` data points into `k` classes.
  // 2. `breaksMatrix`: Stores the index of the last break used to achieve
  //    the optimal SDAM in the `matrix`. This is used for backtracking.
  let matrix, breaksMatrix;
  try {
    matrix = Array(numClasses + 1)
      .fill(0)
      .map(() => Array(n + 1).fill(0));
    breaksMatrix = Array(numClasses + 1)
      .fill(0)
      .map(() => Array(n + 1).fill(0));
  } catch (error) {
    console.error(`[ERROR] jenksNaturalBreaks: Failed to create matrices:`, error);
    return [];
  }

  // --- Helper to calculate SDAM for a slice of the data ---
  // This is the core "cost" function.
  const calculateSDAM = (startIndex, endIndex) => {
    let sum = 0;
    let sumSq = 0;
    for (let i = startIndex; i < endIndex; i++) {
      sum += sorted[i];
      sumSq += sorted[i] * sorted[i];
    }
    const count = endIndex - startIndex;
    const mean = sum / count;
    return sumSq - sum * mean;
  };

  // --- Step 1: Fill the first row of the matrix (for k=1 class) ---
  // The cost of putting the first `i` items into a single class is just their SDAM.
  for (let i = 1; i <= n; i++) {
    matrix[1][i] = calculateSDAM(0, i);
  }

  // --- Step 2: Fill the rest of the matrices using dynamic programming ---
  // Iterate through each number of classes (k)
  for (let k = 2; k <= numClasses; k++) {
    // Iterate through each data point (i)
    for (let i = k; i <= n; i++) {
      let minSDAM = Infinity;
      let bestBreakIndex = -1;

      // Find the best place to put the last break (j)
      for (let j = k - 1; j < i; j++) {
        // Cost = (cost of previous classes) + (cost of the new class)
        const currentSDAM = matrix[k - 1][j] + calculateSDAM(j, i);

        if (currentSDAM < minSDAM) {
          minSDAM = currentSDAM;
          bestBreakIndex = j;
        }
      }
      matrix[k][i] = minSDAM;
      breaksMatrix[k][i] = bestBreakIndex;
    }
  }

  // --- Step 3: Backtrack to find the actual break points ---
  const breaks = [];
  let currentBreak = n;

  for (let k = numClasses; k > 0; k--) {
    // The last value is always a break point
    if (k === numClasses) {
      breaks.push(sorted[currentBreak - 1]);
    }

    currentBreak = breaksMatrix[k][currentBreak];
    // The break point is the value at the start of the last class.
    // We use the value at `currentBreak - 1` because array indices are 0-based.
    if (currentBreak !== 0) {
      breaks.push(sorted[currentBreak - 1]);
    }
  }

  // The first value is always the minimum.
  breaks.push(sorted[0]);

  // The breaks were found from end to start, so reverse them.
  const sortedBreaks = breaks.reverse();

	// Remove duplicates with floating-point tolerance to avoid 0-0 classes.
	const uniqueBreaks = [];
	const tolerance = 1e-10;

	for (let i = 0; i < sortedBreaks.length; i++) {
		if (i === 0 || Math.abs(sortedBreaks[i] - sortedBreaks[i - 1]) > tolerance) {
			uniqueBreaks.push(sortedBreaks[i]);
		}
	}

	return uniqueBreaks;
}