import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeFilterValue, splitFilterValues, isExcluding, resolveEntryFilters, isSalesFilterAvailable } from './filterConfig';

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

test( 'opening the filter pages keeps the URL filters and adds the pinned ones', () => {
	assert.deepStrictEqual(
		resolveEntryFilters({ referrer: 'a.com' }, { device_id: '2' }, { browser: 'firefox' }),
		{ referrer: 'a.com', browser: 'firefox' }
	);
});

test( 'a pinned filter wins over the same filter in the URL', () => {
	assert.deepStrictEqual(
		resolveEntryFilters({ referrer: 'a.com', goal_id: '15' }, {}, { goal_id: '9' }),
		{ referrer: 'a.com', goal_id: '9' }
	);
});

test( 'a filter the navigation asked for explicitly wins over the pinned one', () => {
	assert.deepStrictEqual(
		resolveEntryFilters({ goal_id: '15' }, {}, { goal_id: '9', browser: 'firefox' }, [ 'goal_id' ]),
		{ goal_id: '15', browser: 'firefox' }
	);
});

test( 'without URL filters the last used filters come back, with the pinned ones on top', () => {
	assert.deepStrictEqual(
		resolveEntryFilters({}, { referrer: 'a.com', goal_id: '15' }, { goal_id: '9' }),
		{ referrer: 'a.com', goal_id: '9' }
	);
	assert.deepStrictEqual( resolveEntryFilters({}, { referrer: 'a.com' }, {}), { referrer: 'a.com' });
});

/**
 * Run isSalesFilterAvailable() against the given localized settings.
 *
 * @param settings - The window.burst_settings stand-in.
 * @return Whether the sales filter is offered.
 */
const salesFilterAvailableWith = ( settings: Record<string, unknown> ): boolean => {
	( globalThis as unknown as { window: unknown }).window = { burst_settings: settings };
	return isSalesFilterAvailable();
};

test( 'the sales filter needs ecommerce and the sales capability', () => {
	assert.strictEqual( salesFilterAvailableWith({ shouldLoadEcommerce: true, view_sales_burst_statistics: true }), true );
	assert.strictEqual( salesFilterAvailableWith({ shouldLoadEcommerce: false, view_sales_burst_statistics: true }), false );
	assert.strictEqual( salesFilterAvailableWith({ shouldLoadEcommerce: true, view_sales_burst_statistics: false }), false );
});

test( 'the sales filter is never offered to shared-link viewers', () => {
	assert.strictEqual(
		salesFilterAvailableWith({
			shouldLoadEcommerce: true,
			view_sales_burst_statistics: true,
			share_link_permissions: { is_shareable_link_viewer: true }
		}),
		false
	);
});
