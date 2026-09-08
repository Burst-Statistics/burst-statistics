import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const BUILD_DIR = resolve( __dirname, '..', 'build' );
const MAX_INDEX_BUNDLE_BYTES = 350 * 1024;
const INDEX_BUNDLE_PATTERN = /^index\.[a-f0-9]+\.js$/;

const findIndexBundles = (): string[] => {
	try {
		return readdirSync( BUILD_DIR ).filter( ( file ) => INDEX_BUNDLE_PATTERN.test( file ) );
	} catch {
		return [];
	}
};

test( 'core index bundle stays below 350 KB', ( t ) => {
	const bundles = findIndexBundles();

	if ( 0 === bundles.length ) {
		t.skip( 'No build/index.*.js found; run the build first to check the bundle size.' );
		return;
	}

	for ( const bundle of bundles ) {
		const { size } = statSync( join( BUILD_DIR, bundle ) );
		assert.ok(
			size <= MAX_INDEX_BUNDLE_BYTES,
			`${ bundle } is ${ ( size / 1024 ).toFixed( 1 ) } KB, exceeding the ${ MAX_INDEX_BUNDLE_BYTES / 1024 } KB limit.`
		);
	}
});
