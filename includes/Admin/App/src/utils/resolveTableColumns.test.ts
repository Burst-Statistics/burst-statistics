import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTableColumns } from './resolveTableColumns';

const defaults = [ 'term', 'volume', 'results', 'ai_match' ];
const available = [ 'term', 'volume', 'results', 'ai_match' ];

test( 'without a saved selection the available defaults are shown', () => {
	assert.deepStrictEqual(
		resolveTableColumns({ defaults, available: [ 'term', 'volume', 'results' ] }),
		[ 'term', 'volume', 'results' ]
	);
});

test( 'a default column that appeared after the selection was saved is added', () => {
	assert.deepStrictEqual(
		resolveTableColumns({
			saved: [ 'term', 'volume', 'results' ],
			known: [ 'term', 'volume', 'results' ],
			defaults,
			available
		}),
		[ 'term', 'volume', 'results', 'ai_match' ]
	);
});

test( 'a column the user switched off while it existed stays off', () => {
	assert.deepStrictEqual(
		resolveTableColumns({
			saved: [ 'term', 'volume', 'results' ],
			known: [ 'term', 'volume', 'results', 'ai_match' ],
			defaults,
			available
		}),
		[ 'term', 'volume', 'results' ]
	);
});

test( 'a legacy selection only gets the add-when-available columns', () => {
	assert.deepStrictEqual(
		resolveTableColumns({
			saved: [ 'term', 'results' ],
			defaults,
			available,
			addWhenAvailable: [ 'ai_match' ]
		}),
		[ 'term', 'results', 'ai_match' ],
		'volume was switched off by the user and must not come back'
	);
});

test( 'saved columns that no longer exist are dropped', () => {
	assert.deepStrictEqual(
		resolveTableColumns({
			saved: [ 'term', 'volume', 'results', 'ai_match' ],
			known: available,
			defaults,
			available: [ 'term', 'volume', 'results' ]
		}),
		[ 'term', 'volume', 'results' ]
	);
});
