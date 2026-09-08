import assert from 'node:assert/strict';
import test from 'node:test';
import {
	BURST_START_DATE,
	formatDate,
	getBurstSetting,
	getBurstStartDate,
	getForecastRange,
	getRelativeTime,
	parseAndValidateDate
} from './formatting';

test( 'getBurstSetting returns fallback when burst_settings is undefined', () => {
	assert.strictEqual( getBurstSetting( 'non_existent_key', 'fallback' ), 'fallback' );
	assert.strictEqual( getBurstSetting( 'another_key' ), undefined );
});

test( 'getBurstStartDate and BURST_START_DATE evaluate safely in test environment', () => {
	const startDate = getBurstStartDate();
	assert.ok( startDate instanceof Date, 'Should return a Date instance' );
	assert.ok( ! isNaN( startDate.getTime() ), 'Date should be valid' );
	assert.ok( BURST_START_DATE instanceof Date, 'BURST_START_DATE should be a Date instance' );
	assert.ok( ! isNaN( BURST_START_DATE.getTime() ), 'BURST_START_DATE should be valid' );
});

test( 'parseAndValidateDate handles all valid and invalid date types', () => {
	assert.strictEqual( parseAndValidateDate( '' ), null );
	assert.strictEqual( parseAndValidateDate( null ), null );
	assert.strictEqual( parseAndValidateDate( undefined ), null );
	assert.strictEqual( parseAndValidateDate( 'invalid-date' ), null );
	assert.strictEqual( parseAndValidateDate( new Date( 'invalid' ) ), null );

	// Date-only string: parsed as local calendar day
	const dateOnly = parseAndValidateDate( '2026-04-09' );
	assert.ok( dateOnly instanceof Date );
	assert.strictEqual( dateOnly.getFullYear(), 2026 );
	assert.strictEqual( dateOnly.getMonth(), 3 ); // April (0-indexed)
	assert.strictEqual( dateOnly.getDate(), 9 );

	// MySQL datetime string: parsed as UTC
	const mysqlDate = parseAndValidateDate( '2026-04-09 15:53:50' );
	assert.ok( mysqlDate instanceof Date );
	assert.strictEqual( mysqlDate.toISOString(), '2026-04-09T15:53:50.000Z' );

	// Unix timestamp (seconds)
	const timestampSec = parseAndValidateDate( 1775750030 );
	assert.ok( timestampSec instanceof Date );
	assert.strictEqual( timestampSec.getTime(), 1775750030 * 1000 );

	// Unix timestamp (milliseconds)
	const timestampMs = parseAndValidateDate( 1775750030000 );
	assert.ok( timestampMs instanceof Date );
	assert.strictEqual( timestampMs.getTime(), 1775750030000 );
});

test( 'formatDate formats Unix timestamp in milliseconds correctly', () => {
	const timestampMs = 1775750030 * 1000; // April 9, 2026 15:53:50 UTC
	const formatted = formatDate( timestampMs );
	assert.notStrictEqual( formatted, '' );
	assert.match( formatted, /2026/ );
	assert.match( formatted, /9|09/ );
});

test( 'formatDate formats 10-digit Unix timestamp (seconds) correctly', () => {
	const timestampSeconds = 1775750030; // April 9, 2026 15:53:50 UTC
	const formatted = formatDate( timestampSeconds );
	assert.notStrictEqual( formatted, '' );
	assert.match( formatted, /2026/ );
	assert.match( formatted, /9|09/ );
});

test( 'formatDate formats MySQL datetime string correctly', () => {
	const dateStr = '2026-04-09 15:53:50';
	const formatted = formatDate( dateStr );
	assert.notStrictEqual( formatted, '' );
	assert.match( formatted, /2026/ );
});

test( 'formatDate formats date-only string without timezone shifting', () => {
	const dateStr = '2026-04-09';
	const formatted = formatDate( dateStr );
	assert.notStrictEqual( formatted, '' );
	assert.match( formatted, /2026/ );
	assert.match( formatted, /9|09/ );
});

test( 'formatDate respects removeYear option', () => {
	const formatted = formatDate( '2026-04-09', true );
	assert.notStrictEqual( formatted, '' );
	assert.ok( ! formatted.includes( '2026' ), 'Should not include year when removeYear is true' );
});

test( 'formatDate returns empty string for empty / null / undefined / invalid input', () => {
	assert.strictEqual( formatDate( '' ), '' );
	assert.strictEqual( formatDate( null ), '' );
	assert.strictEqual( formatDate( undefined ), '' );
	assert.strictEqual( formatDate( 'not-a-date' ), '' );
});

test( 'getRelativeTime handles various date inputs and invalid fallbacks', () => {
	const now = new Date( '2026-04-09T16:00:00Z' );

	// Past date 10 minutes ago
	const pastDate = new Date( '2026-04-09T15:50:00Z' );
	const relativePast = getRelativeTime( pastDate, now );
	assert.notStrictEqual( relativePast, '-' );
	assert.match( relativePast, /10 minutes ago/ );

	// Past date via MySQL string
	const relativeMysql = getRelativeTime( '2026-04-09 15:50:00', now );
	assert.notStrictEqual( relativeMysql, '-' );
	assert.match( relativeMysql, /10 minutes ago/ );

	// Past date via Unix timestamp (seconds)
	const pastTs = Math.floor( pastDate.getTime() / 1000 );
	const relativeTs = getRelativeTime( pastTs, now );
	assert.notStrictEqual( relativeTs, '-' );
	assert.match( relativeTs, /10 minutes ago/ );

	// Invalid inputs return '-'
	assert.strictEqual( getRelativeTime( '' ), '-' );
	assert.strictEqual( getRelativeTime( null ), '-' );
	assert.strictEqual( getRelativeTime( undefined ), '-' );
	assert.strictEqual( getRelativeTime( 'invalid-date' ), '-' );
	assert.strictEqual( getRelativeTime( new Date( 'invalid' ) ), '-' );
});

test( 'getForecastRange returns the fixed last-12-complete-months window', () => {
	const { groupBy, startDate, endDate } = getForecastRange();

	assert.strictEqual( groupBy, 'month' );
	assert.match( startDate, /^\d{4}-\d{2}-01$/ );
	assert.match( endDate, /^\d{4}-\d{2}-\d{2}$/ );

	// Start is the first day of the month 12 months back; end is the last day
	// of the previous month — exactly 12 complete calendar months apart.
	const start = new Date( `${ startDate }T00:00:00` );
	const end = new Date( `${ endDate }T00:00:00` );
	const now = new Date();

	assert.strictEqual( start.getDate(), 1 );
	assert.strictEqual(
		( end.getFullYear() * 12 + end.getMonth() ) -
			( start.getFullYear() * 12 + start.getMonth() ),
		11
	);

	// End is in the month before the current one.
	assert.strictEqual(
		end.getFullYear() * 12 + end.getMonth(),
		now.getFullYear() * 12 + now.getMonth() - 1
	);

	// End is the final day of its month (calendar-aware, DST-proof).
	const dayAfterEnd = new Date( end.getFullYear(), end.getMonth(), end.getDate() + 1 );
	assert.strictEqual( dayAfterEnd.getDate(), 1 );
});
