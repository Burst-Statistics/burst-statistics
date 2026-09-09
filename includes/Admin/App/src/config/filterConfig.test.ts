import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeFilterValue, splitFilterValues, isExcluding } from './filterConfig';

test( 'normalizeFilterValue keeps strings as they are', () => {
	assert.strictEqual( normalizeFilterValue( 'desktop' ), 'desktop' );
	assert.strictEqual( normalizeFilterValue( '!google.com' ), '!google.com' );
	assert.strictEqual( normalizeFilterValue( '' ), '' );
});

test( 'normalizeFilterValue turns numeric ids into strings', () => {

	// The devices block passes the lookup-table id straight from the API.
	assert.strictEqual( normalizeFilterValue( 1 ), '1' );
	assert.strictEqual( normalizeFilterValue( 0 ), '0' );
});

test( 'normalizeFilterValue maps null and undefined to an empty value', () => {
	assert.strictEqual( normalizeFilterValue( null ), '' );
	assert.strictEqual( normalizeFilterValue( undefined ), '' );
});

test( 'a normalized numeric id works with the string-based filter helpers', () => {
	const value = normalizeFilterValue( 1 );
	assert.deepStrictEqual( splitFilterValues( value ), [ '1' ]);
	assert.strictEqual( isExcluding( value ), false );
});
