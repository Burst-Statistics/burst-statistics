import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { getGoalsBlockView, getGoalsStatsState } from './getGoalsBlockView';
import type { GoalsBlockViewInput } from './getGoalsBlockView';

const settled: GoalsBlockViewInput = {
	isGoalsListPending: false,
	isGoalsListError: false,
	goalsCount: 2,
	hasStats: true,
	isStatsError: false
};

test( 'goals list pending: loading, never the empty notice', () => {
	assert.equal( getGoalsBlockView({ ...settled, isGoalsListPending: true, goalsCount: 0, hasStats: false }), 'loading' );
});

test( 'goals loaded, statistics pending: loading, not placeholder values as a result', () => {
	assert.equal( getGoalsBlockView({ ...settled, hasStats: false }), 'loading' );
});

test( 'no goals: empty', () => {
	assert.equal( getGoalsBlockView({ ...settled, goalsCount: 0, hasStats: false }), 'empty' );
});

test( 'statistics loaded: stats', () => {
	assert.equal( getGoalsBlockView( settled ), 'stats' );
});

test( 'goals list failed: error, not the empty notice', () => {
	assert.equal( getGoalsBlockView({ ...settled, isGoalsListError: true, goalsCount: 0, hasStats: false }), 'error' );
});

test( 'statistics failed without data: error', () => {
	assert.equal( getGoalsBlockView({ ...settled, hasStats: false, isStatsError: true }), 'error' );
});

test( 'failed refresh keeps earlier data', () => {
	assert.equal( getGoalsBlockView({ ...settled, isStatsError: true }), 'stats' );
	assert.equal( getGoalsBlockView({ ...settled, isGoalsListError: true }), 'stats' );
});

test( 'statistics keep failing: error stays on screen while the next poll runs', async() => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	let finishPoll: ( value: { total: number }) => void = () => {};
	let shouldFail = true;
	const observer = new QueryObserver( client, {
		queryKey: [ 'goals', 'all' ],
		placeholderData: { total: 0 },
		queryFn: () => {
			if ( shouldFail ) {
				return Promise.reject( new Error( 'Server error' ) );
			}
			return new Promise<{ total: number }>( ( resolve ) => {
				finishPoll = resolve;
			});
		}
	});
	const unsubscribe = observer.subscribe( () => {});
	const getView = () => getGoalsBlockView({ ...settled, ...getGoalsStatsState( observer.getCurrentResult() ) });

	await observer.refetch();
	assert.equal( getView(), 'error' );

	// The poll is in flight: the query itself reports a placeholder and no error here.
	shouldFail = false;
	const poll = observer.refetch();
	assert.equal( observer.getCurrentResult().isError, false );
	assert.equal( getView(), 'error' );

	finishPoll({ total: 3 });
	await poll;
	assert.equal( getView(), 'stats' );

	unsubscribe();
	client.clear();
});
