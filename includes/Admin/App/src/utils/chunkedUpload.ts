import { __, sprintf } from '@wordpress/i18n';
import { siteUrl } from '@/utils/siteUrl';

declare const burst_settings: {
	nonce: string;
};

export interface ChunkedUploadProgress {
	chunkIndex: number;
	totalChunks: number;
	percentage: number;
	bytesUploaded: number;
	totalBytes: number;
}

export interface ChunkedUploadResult {
	uploadId: string;
	filePath: string;
	fileSize: number;
}

interface UploadInitResponse {
	upload_id: string;
}

interface UploadFinalizeResponse {
	upload_id?: string;
	file_path: string;
	filesize: number;
}

interface ApiErrorResponse {
	message?: string;
	error?: string;
}

/**
 * Post to an upload route and return its JSON response.
 *
 * The route is appended to the site's REST url, which holds the subfolder and,
 * on plain permalinks, the rest_route query argument.
 *
 * @param route Route below burst/v1/import/upload/.
 * @param body Request body.
 * @param fallbackError Message when the response names no error of its own.
 * @param headers Extra request headers.
 * @return Promise resolving to the parsed response.
 * @throws Error when the request fails or the response is not JSON, such as an HTML page from a wrong url.
 */
// fallow-ignore-next-line complexity
const postToUploadRoute = async <T>(
	route: string,
	body: BodyInit,
	fallbackError: string,
	headers: Record<string, string> = {}
): Promise<T> => {

	// A browser request to the site's own REST url, and route is a literal from this file, so this is not SSRF.
	// nosemgrep
	const response = await fetch( `${ siteUrl() }burst/v1/import/upload/${ route }`, {
		method: 'POST',
		headers: {
			'X-WP-Nonce': burst_settings?.nonce || '',
			...headers
		},
		body
	});
	const data: ( T & ApiErrorResponse ) | null = await response.json().catch( () => null );

	if ( ! response.ok || null === data ) {
		throw new Error( data?.message || data?.error || fallbackError );
	}

	return data;
};

/**
 * Uploads large analytics export files in 2MB slices to bypass server upload limits.
 *
 * @param file File object selected from file input or dropzone.
 * @param onProgress Callback invoked as each chunk completes.
 * @return Promise resolving to finalized file path on server.
 */
export const uploadFileInChunks = async(
	file: File,
	onProgress?: ( progress: ChunkedUploadProgress ) => void
): Promise<ChunkedUploadResult> => {
	const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB per slice
	const totalChunks = Math.max( 1, Math.ceil( file.size / CHUNK_SIZE ) );
	const cleanFilename = file.name.replace( /[^a-zA-Z0-9._-]/g, '_' );
	const jsonHeaders = { 'Content-Type': 'application/json' };

	// 1. Initialize upload session
	const initData = await postToUploadRoute<UploadInitResponse>(
		'init',
		JSON.stringify({
			filename: cleanFilename,
			filesize: file.size,
			total_chunks: totalChunks
		}),
		__( 'Failed to initialize upload session.', 'burst-statistics' ),
		jsonHeaders
	);
	const uploadId = initData.upload_id;

	// 2. Stream chunks sequentially
	for ( let i = 0; i < totalChunks; i++ ) {
		const start = i * CHUNK_SIZE;
		const end = Math.min( start + CHUNK_SIZE, file.size );
		const chunkBlob = file.slice( start, end );

		const formData = new FormData();
		formData.append( 'upload_id', uploadId );
		formData.append( 'chunk_index', i.toString() );
		formData.append( 'file', chunkBlob, `chunk_${ i }.part` );

		await postToUploadRoute(
			'chunk',
			formData,
			sprintf(

				/* translators: %d: number of the file slice that failed to upload. */
				__( 'Failed to upload chunk #%d.', 'burst-statistics' ),
				i + 1
			)
		);

		if ( onProgress ) {
			const uploaded = Math.min( end, file.size );
			onProgress({
				chunkIndex: i,
				totalChunks,
				percentage: Math.round( ( ( i + 1 ) / totalChunks ) * 100 ),
				bytesUploaded: uploaded,
				totalBytes: file.size
			});
		}
	}

	// 3. Finalize upload session
	const finalizeData = await postToUploadRoute<UploadFinalizeResponse>(
		'finalize',
		JSON.stringify({
			upload_id: uploadId
		}),
		__( 'Failed to finalize uploaded file.', 'burst-statistics' ),
		jsonHeaders
	);

	const resolvedId = finalizeData.upload_id || finalizeData.file_path;

	return {
		uploadId: resolvedId,
		filePath: resolvedId,
		fileSize: finalizeData.filesize
	};
};
