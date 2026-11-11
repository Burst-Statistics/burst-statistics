import assert from 'node:assert/strict';
import test from 'node:test';
import { isDateRangeEnabledRoute, isFilterEnabledRoute } from './routeUtils';

test( 'the goals dashboard keeps its date range in the url', () => {
	assert.strictEqual( isDateRangeEnabledRoute( '/goals' ), true );
	assert.strictEqual( isDateRangeEnabledRoute( '/goals/12' ), true );
});

test( 'the goals dashboard has no url filters, the goal comes from the route', () => {
	assert.strictEqual( isFilterEnabledRoute( '/goals' ), false );
	assert.strictEqual( isFilterEnabledRoute( '/goals/12' ), false );
});

test( 'pages without a date range do not get one', () => {
	assert.strictEqual( isDateRangeEnabledRoute( '/settings/general' ), false );
});
