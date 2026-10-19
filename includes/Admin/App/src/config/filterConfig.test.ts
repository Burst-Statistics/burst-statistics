import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeFilterValue, splitFilterValues, isExcluding, isSalesFilterAvailable } from './filterConfig';

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
