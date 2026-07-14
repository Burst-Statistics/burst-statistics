import Icon from '@/utils/Icon';
import { mkConfig, download, type CsvOutput } from 'export-to-csv';
import { useMemo, useState, useRef, useEffect } from 'react';
import useLicenseData from '@/hooks/useLicenseData';
import { __ } from '@wordpress/i18n';
import Tooltip from '@/components/Common/Tooltip';
import { filterAndGenerateCsv } from './csvHelpers';

const WEB_WORKER_THRESHOLD = 5000;

// fallow-ignore-next-line complexity
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
					className={`bg-gray-100 border border-gray-400 focus:ring-blue-500 rounded-full p-2.5 transition-all duration-200 hover:bg-gray-400 hover:shadow-md focus:outline-hidden focus:ring-2 focus:ring-offset-2 opacity-30 group-hover/root:opacity-100 ${isButtonDisabled ? 'opacity-30 group-hover/root:opacity-30 cursor-not-allowed hover:bg-gray-100' : ''}`}
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
