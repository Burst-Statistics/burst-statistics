import { generateCsv, mkConfig, type CsvOutput } from 'export-to-csv';

/**
 * Recursively flattens nested objects into a single-level object.
 *
 * Nested object keys are combined using an underscore (`_`) separator.
 * Arrays are preserved as-is and not flattened. Null values are converted
 * into empty strings.
 *
 * @param {Object} obj - The object to flatten
 * @param {string} [parentKey=""] - Internal prefix used for nested keys
 * @param {Record<string, any>} [result={}] - Internal accumulator for flattened output
 * @returns {Record<string, any>} The flattened object with no nested structures
 */
const flattenObject = ( obj: any, parentKey = '', result: Record<string, any> = {}) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    for ( const key in obj ) {
        const value = obj[key];
        const newKey = parentKey ? `${parentKey}__${key}` : key;

        if ( null === value ) {
            result[newKey] = '';
        } else if ( 'object' === typeof value && ! Array.isArray( value ) ) {
            flattenObject( value, newKey, result );
        } else {
            result[newKey] = value;
        }
    }

    return result;
};

/**
 * Filters null values from data and generates a CSV string
 *
 * @param {Array<Object>}               data      - The data to be filtered and converted to CSV
 * @param {ReturnType<typeof mkConfig>} csvConfig - Configuration options for CSV generation
 * @return {CsvOutput} The generated CSV string
 *
 * Note: Need to create duplicate copy of this function here because web workers as importing it from utils causes runtime issues. Keep this function in sync with DownloadCsvButton.tsx
 */
const filterAndGenerateCsv = ( data: any[], csvConfig: ReturnType<typeof mkConfig> ): CsvOutput => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const flattenedData = data.map( item => flattenObject( item ) );
    return generateCsv( csvConfig )( flattenedData );
};

self.onmessage = ( event ) => {
	const { data, csvConfig } = event.data;

	const csvString = filterAndGenerateCsv( data, csvConfig );

	postMessage( csvString );
};
