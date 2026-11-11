import assert from 'node:assert/strict';
import test from 'node:test';
import { getLicensedColumns } from './getLicensedColumns';

const columnsOptions = {
	referrer: { group_by: true },
	source_category: { pro: true, group_by: true },
	source: { pro: true, group_by: true },
	visitors: {},
	sessions: { pro: true }
};

test( 'a valid license keeps every selected column', () => {
	const columns = [ 'source', 'source_category', 'visitors', 'sessions' ];

	assert.deepStrictEqual( getLicensedColumns( columns, columnsOptions, true ), columns );
});

test( 'without a valid license pro columns are removed', () => {
	assert.deepStrictEqual(
		getLicensedColumns([ 'referrer', 'source', 'visitors', 'sessions' ], columnsOptions, false ),
		[ 'referrer', 'visitors' ]
	);
});

test( 'a free group column replaces the group columns the license removed', () => {
	assert.deepStrictEqual(
		getLicensedColumns([ 'source', 'source_category', 'visitors', 'sessions' ], columnsOptions, false ),
		[ 'referrer', 'visitors' ]
	);
});

test( 'a selection the user made without a group column stays as it is', () => {
	assert.deepStrictEqual( getLicensedColumns([ 'visitors' ], columnsOptions, false ), [ 'visitors' ]);
});

test( 'nothing is added when the table has no free group column', () => {
	assert.deepStrictEqual(
		getLicensedColumns([ 'product', 'visitors' ], { product: { pro: true, group_by: true }, visitors: {} }, false ),
		[ 'visitors' ]
	);
});
