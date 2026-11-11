import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { uploadFileInChunks } from './chunkedUpload';

const SETTINGS = { nonce: 'test-nonce', admin_ajax_url: '', is_mainwp: false };

Object.assign( globalThis, {
	burst_settings: { ...SETTINGS, rest_url: '' },
	window: { location: { protocol: 'http:', search: '' } }
});

/**
 * Upload a small file.
 *
 * @return The upload result.
 */
const uploadFile = () => uploadFileInChunks( new File([ 'x' ], 'export.csv' ) );

const realFetch = globalThis.fetch;

/**
 * Run an upload against a stubbed server and collect the requests.
 *
 * @param restUrl The site's REST url.
 * @return The requested urls and their headers.
 */
const uploadWithRestUrl = async( restUrl: string ): Promise<Array<{ url: string; headers: Record<string, string> }>> => {
	( globalThis as unknown as { burst_settings: object }).burst_settings = { ...SETTINGS, rest_url: restUrl };
	const requests: Array<{ url: string; headers: Record<string, string> }> = [];
	globalThis.fetch = ( async( url: string, init: RequestInit ) => {
		requests.push({ url, headers: init.headers as Record<string, string> });
		return new Response( JSON.stringify({ upload_id: 'abc', file_path: 'abc', filesize: 1 }), { status: 200 });
	}) as typeof fetch;

	await uploadFile();
	return requests;
};

/**
 * Get the error of an upload whose first request gets this response.
 *
 * @param response Stubbed response.
 * @return The thrown error.
 */
const uploadErrorFor = async( response: Response ): Promise<Error> => {
	( globalThis as unknown as { burst_settings: object }).burst_settings = { ...SETTINGS, rest_url: 'https://example.com/wp-json/' };
	globalThis.fetch = ( async() => response ) as typeof fetch;

	return uploadFile().then(
		() => assert.fail( 'The upload should have failed.' ),
		( error: Error ) => error
	);
};

afterEach( () => {
	globalThis.fetch = realFetch;
});

test( 'a site in a subfolder uploads to its own REST url', async() => {
	const requests = await uploadWithRestUrl( 'http://example.com/blog/wp-json/' );

	assert.deepStrictEqual( requests.map( ({ url }) => url ), [
		'http://example.com/blog/wp-json/burst/v1/import/upload/init',
		'http://example.com/blog/wp-json/burst/v1/import/upload/chunk',
		'http://example.com/blog/wp-json/burst/v1/import/upload/finalize'
	]);
});

test( 'plain permalinks upload through rest_route', async() => {
	const requests = await uploadWithRestUrl( 'http://example.com/index.php?rest_route=/' );

	assert.deepStrictEqual( requests.map( ({ url }) => url ), [
		'http://example.com/index.php?rest_route=/burst/v1/import/upload/init',
		'http://example.com/index.php?rest_route=/burst/v1/import/upload/chunk',
		'http://example.com/index.php?rest_route=/burst/v1/import/upload/finalize'
	]);
});

test( 'an http REST url is upgraded on an https page', async() => {
	( globalThis as unknown as { window: object }).window = { location: { protocol: 'https:', search: '' } };
	const requests = await uploadWithRestUrl( 'http://example.com/wp-json/' );
	( globalThis as unknown as { window: object }).window = { location: { protocol: 'http:', search: '' } };

	assert.strictEqual( requests[ 0 ].url, 'https://example.com/wp-json/burst/v1/import/upload/init' );
});

test( 'every request sends the nonce, and the browser sets the multipart header of a chunk', async() => {
	const [ init, chunk, finalize ] = await uploadWithRestUrl( 'http://example.com/wp-json/' );

	for ( const { headers } of [ init, chunk, finalize ]) {
		assert.strictEqual( headers[ 'X-WP-Nonce' ], SETTINGS.nonce );
	}
	assert.strictEqual( init.headers[ 'Content-Type' ], 'application/json' );
	assert.strictEqual( chunk.headers[ 'Content-Type' ], undefined );
	assert.strictEqual( finalize.headers[ 'Content-Type' ], 'application/json' );
});

test( 'an html page instead of json gives a readable error', async() => {
	const error = await uploadErrorFor( new Response( '<!doctype html><html></html>', { status: 200 }) );

	assert.strictEqual( error.message, 'Failed to initialize upload session.' );
});

test( 'an error from the server is passed on', async() => {
	const error = await uploadErrorFor( new Response( JSON.stringify({ error: 'File type not allowed.' }), { status: 400 }) );

	assert.strictEqual( error.message, 'File type not allowed.' );
});
