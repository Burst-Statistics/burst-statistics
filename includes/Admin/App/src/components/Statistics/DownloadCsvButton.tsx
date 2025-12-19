import Icon from '@/utils/Icon';
import { mkConfig, download, type CsvOutput, generateCsv } from 'export-to-csv';
import { useMemo, useState, useRef, useEffect } from 'react';
import useLicenseData from '@/hooks/useLicenseData';
import { __ } from '@wordpress/i18n';
import Tooltip from '@/components/Common/Tooltip';

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
 * @returns {CsvOutput} The generated CSV string
 *
 * Note: Need to create duplicate copy of this function here because web workers as importing it from utils causes runtime issues. Keep this function in sync with worker/csvWorker.tsx
 */
const filterAndGenerateCsv = ( data: any[], csvConfig: ReturnType<typeof mkConfig> ): CsvOutput => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const flattenedData = data.map( item => flattenObject( item ) );
    return generateCsv( csvConfig )( flattenedData );
};

const WEB_WORKER_THRESHOLD = 5000;

const DownloadCsvButton = ({
	data,
	filename,
	className = ''
}: {
	data: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
	filename: string;
	className?: string;
}) => {
	const { isLicenseValidFor } = useLicenseData();
	const isFeatureAvailable = isLicenseValidFor( 'sources' );
	const [ isWorking, setIsWorking ] = useState( false );
	const isButtonDisabled =
		! data || 0 === data.length || isWorking || ! isFeatureAvailable;
	const workerRef = useRef<Worker | null>( null );

	const csvConfig = useMemo(
		() =>
			mkConfig({
				useKeysAsHeaders: true,
				filename
			}),
		[ filename ]
	);

	const csvData = useMemo( () => {
		if ( isButtonDisabled ) {
			return '';
		}

		if ( data.length >= WEB_WORKER_THRESHOLD ) {
			return '';
		}

		return filterAndGenerateCsv( data, csvConfig );
	}, [ data, csvConfig ]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect( () => {
		return () => {
			if ( workerRef.current ) {
				workerRef.current.terminate();
				workerRef.current = null;
			}
		};
	}, []);

	const handleDownload = () => {
		if ( isButtonDisabled ) {
			return;
		}

		if ( data.length < WEB_WORKER_THRESHOLD ) {
			if ( csvData ) {
				download( csvConfig )( csvData as CsvOutput );
			}
			return;
		}

		setIsWorking( true );

		if ( ! workerRef.current ) {
			workerRef.current = new Worker(
				new URL( './worker/csvWorker.ts', import.meta.url ),
				{ type: 'module' }
			);
		}

		const worker = workerRef.current;

		worker.onmessage = null;
		worker.onerror = null;

		worker.onmessage = ( event ) => {
			const csvString = event.data;
			download( csvConfig )( csvString );
			setIsWorking( false );
		};

		worker.onerror = () => {
			console.error( 'CSV Worker error' );
			setIsWorking( false );
		};

		worker.postMessage({
			data,
			filename,
			csvConfig
		});
	};

	return (
		<Tooltip
			content={
				! isFeatureAvailable ?
					__( 'Available in Burst Pro', 'burst-statistics' ) :
					undefined
			}
		>
			<div className={`relative ${className}`}>
				<button
					className={`bg-gray-100 border border-gray-400 focus:ring-blue-500 rounded-full p-2.5 transition-all duration-200 hover:bg-gray-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 opacity-30 group-hover/root:opacity-100 ${isButtonDisabled ? 'opacity-30 group-hover/root:opacity-30 cursor-not-allowed hover:bg-gray-100' : ''}`}
					onClick={handleDownload}
					onKeyDown={( e ) => {
						if ( 'Enter' === e.key ) {
							e.preventDefault();
							handleDownload();
						}
					}}
					aria-label={filename}
					disabled={isButtonDisabled}
				>
					{isWorking ? (
						<Icon name="loading" />
					) : (
						<Icon name="download" />
					)}
				</button>
			</div>
		</Tooltip>
	);
};

export default DownloadCsvButton;
