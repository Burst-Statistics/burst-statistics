import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRevisionDate } from './PageRevisionsList';

test( 'formatRevisionDate formats 10-digit Unix timestamp (seconds) correctly', () => {
	const revision = { timestamp: 1775750030, date: '' };
	const formatted = formatRevisionDate( revision );
	assert.notStrictEqual( formatted, '' );
	assert.match( formatted, /2026/ );
	assert.match( formatted, /9|09/ );
});

test( 'formatRevisionDate formats MySQL datetime string correctly', () => {
	const revision = { timestamp: 0, date: '2026-04-09 15:53:50' };
	const formatted = formatRevisionDate( revision );
	assert.notStrictEqual( formatted, '' );
	assert.match( formatted, /2026/ );
});

test( 'formatRevisionDate gives timestamp precedence over date string', () => {
	const revision = { timestamp: 1775750030, date: '2020-01-01 00:00:00' };
	const formatted = formatRevisionDate( revision );
	assert.notStrictEqual( formatted, '' );
	assert.match( formatted, /2026/ );
	assert.ok( ! formatted.includes( '2020' ), 'Should format timestamp date (2026), not fallback date (2020)' );
});

test( 'formatRevisionDate falls back to date string when timestamp is 0 or undefined', () => {
	const revisionWithZero = { timestamp: 0, date: '2026-04-09 15:53:50' };
	assert.notStrictEqual( formatRevisionDate( revisionWithZero ), '' );
	assert.match( formatRevisionDate( revisionWithZero ), /2026/ );

	const revisionUndefined = { timestamp: undefined as unknown as number, date: '2026-04-09 15:53:50' };
	assert.notStrictEqual( formatRevisionDate( revisionUndefined ), '' );
	assert.match( formatRevisionDate( revisionUndefined ), /2026/ );
});

test( 'formatRevisionDate returns empty string when neither timestamp nor date is provided', () => {
	assert.strictEqual( formatRevisionDate({ timestamp: 0, date: '' }), '' );
	assert.strictEqual( formatRevisionDate({} as { timestamp: number; date: string }), '' );
});
