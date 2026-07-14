import { filterAndGenerateCsv } from '../csvHelpers';

self.onmessage = ( event ) => {
	const { data, csvConfig } = event.data;

	const csvString = filterAndGenerateCsv( data, csvConfig );

	postMessage( csvString );
};
