import { generateCsv, type CsvOutput, type mkConfig } from 'export-to-csv';

// fallow-ignore-next-line complexity
const flattenObject = ( obj: any, parentKey = '', result: Record<string, any> = {}) => { // eslint-disable-line @typescript-eslint/no-explicit-any
	for ( const key in obj ) {
		const value = obj[key];
		const newKey = parentKey ? `${ parentKey }__${ key }` : key;

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

export const filterAndGenerateCsv = ( data: any[], csvConfig: ReturnType<typeof mkConfig> ): CsvOutput => { // eslint-disable-line @typescript-eslint/no-explicit-any
	const flattenedData = data.map( ( item ) => flattenObject( item ) );
	return generateCsv( csvConfig )( flattenedData );
};
