import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { getGoalsBlockNotice } from './getGoalsBlockNotice';
import type { Goal } from '@/components/Goals/goalHelpers';

// isGoalComplete checks selectors with the DOM's own parser, which node does not have.
globalThis.document = new JSDOM().window.document as unknown as Document;

/**
 * A finished, active click goal, overridden per test.
 *
 * @param {Partial<Goal>} overrides Fields that differ from the defaults.
 * @return {Goal} The goal.
 */
const makeGoal = ( overrides: Partial<Goal> ): Goal => ({
	id: 1,
	title: 'Goal',
	status: 'active',
	type: 'clicks',
	conversion_metric: 'visitors',
	selector: '.buy',
	hook: '',
	specific_page: '',
	page_or_website: 'website',
	date_created: 0,
	...overrides
});

test( 'no goals: invite to create one', () => {
	const notice = getGoalsBlockNotice([], 'all' );
	assert.strictEqual( notice?.action, 'Create goal' );
	assert.strictEqual( notice?.goalId, undefined );
});

test( 'all goals: notice only when none is active', () => {
	assert.strictEqual( getGoalsBlockNotice([ makeGoal({}), makeGoal({ id: 2, status: 'inactive' }) ], 'all' ), null );
	assert.strictEqual( getGoalsBlockNotice([ makeGoal({ status: 'inactive' }) ], 'all' )?.action, 'Manage goals' );
});

test( 'selected unfinished goal opens its setup', () => {
	const notice = getGoalsBlockNotice([ makeGoal({ id: 7, selector: '' }) ], '7' );
	assert.strictEqual( notice?.action, 'Finish setup' );
	assert.strictEqual( notice?.goalId, 7 );
	assert.strictEqual( notice?.step, 2 );
});

test( 'selected paused goal opens its review', () => {
	const notice = getGoalsBlockNotice([ makeGoal({ id: 7, status: 'inactive' }) ], 7 );
	assert.strictEqual( notice?.action, 'Manage goal' );
	assert.strictEqual( notice?.step, 4 );
});

test( 'selected active goal or unknown id: no notice', () => {
	assert.strictEqual( getGoalsBlockNotice([ makeGoal({ id: 7 }) ], 7 ), null );
	assert.strictEqual( getGoalsBlockNotice([ makeGoal({ id: 7 }) ], 99 ), null );
});
