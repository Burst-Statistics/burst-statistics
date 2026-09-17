declare const burst_settings: {
	root: string;
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
 * Uploads large analytics export files in 2MB slices to bypass server upload limits.
 *
 * @param file File object selected from file input or dropzone.
 * @param onProgress Callback invoked as each chunk completes.
 * @return Promise resolving to finalized file path on server.
 */
// fallow-ignore-next-line complexity
export const uploadFileInChunks = async(
	file: File,
	onProgress?: ( progress: ChunkedUploadProgress ) => void
): Promise<ChunkedUploadResult> => {
	const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB per slice
	const totalChunks = Math.max( 1, Math.ceil( file.size / CHUNK_SIZE ) );
	const rootUrl = burst_settings?.root || '/wp-json/';
	const nonce = burst_settings?.nonce || '';
	const cleanFilename = file.name.replace( /[^a-zA-Z0-9._-]/g, '_' );

	// 1. Initialize upload session
	const initResponse = await fetch( `${ rootUrl }burst/v1/import/upload/init`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-WP-Nonce': nonce
		},
		body: JSON.stringify({
			filename: cleanFilename,
			filesize: file.size,
			total_chunks: totalChunks
		})
	});

	if ( ! initResponse.ok ) {
		const err: ApiErrorResponse = await initResponse.json().catch( () => ({}) );
		throw new Error( err?.message || err?.error || 'Failed to initialize upload session.' );
	}

	const initData: UploadInitResponse = await initResponse.json();
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

		const chunkResponse = await fetch( `${ rootUrl }burst/v1/import/upload/chunk`, {
			method: 'POST',
			headers: {
				'X-WP-Nonce': nonce
			},
			body: formData
		});

		if ( ! chunkResponse.ok ) {
			const err: ApiErrorResponse = await chunkResponse.json().catch( () => ({}) );
			throw new Error( err?.message || err?.error || `Failed to upload chunk #${ i + 1 }.` );
		}

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
	const finalizeResponse = await fetch( `${ rootUrl }burst/v1/import/upload/finalize`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-WP-Nonce': nonce
		},
		body: JSON.stringify({
			upload_id: uploadId
		})
	});

	if ( ! finalizeResponse.ok ) {
		const err: ApiErrorResponse = await finalizeResponse.json().catch( () => ({}) );
		throw new Error( err?.message || err?.error || 'Failed to finalize uploaded file.' );
	}

	const finalizeData: UploadFinalizeResponse = await finalizeResponse.json();

	const resolvedId = finalizeData.upload_id || finalizeData.file_path;

	return {
		uploadId: resolvedId,
		filePath: resolvedId,
		fileSize: finalizeData.filesize
	};
};
