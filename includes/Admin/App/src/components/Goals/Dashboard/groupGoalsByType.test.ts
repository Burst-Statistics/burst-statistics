import assert from 'node:assert/strict';
import test from 'node:test';
import { groupGoalsByType } from './groupGoalsByType';
import type { Goal } from '@/components/Goals/goalHelpers';

const goal = ( id: number, type: string ): Goal => ({
	id,
	type,
	title: `Goal ${ id }`,
	status: 'active',
	conversion_metric: 'visitors',
	selector: '',
	hook: '',
	specific_page: '',
	page_or_website: 'website',
	date_created: 0
});

test( 'groups follow the goal type order and keep the goal order within a group', () => {
	const groups = groupGoalsByType([ goal( 1, 'hook' ), goal( 2, 'clicks' ), goal( 3, 'visits' ), goal( 4, 'clicks' ) ]);
	assert.deepStrictEqual(
		groups.map( ( group ) => [ group.type, group.goals.map( ( item ) => item.id ) ]),
		[ [ 'clicks', [ 2, 4 ] ], [ 'visits', [ 3 ] ], [ 'hook', [ 1 ] ] ]
	);
});

test( 'unknown types come last', () => {
	const groups = groupGoalsByType([ goal( 1, 'legacy' ), goal( 2, 'views' ) ]);
	assert.deepStrictEqual( groups.map( ( group ) => group.type ), [ 'views', 'legacy' ]);
});

test( 'file downloads and custom events get their own group', () => {
	const groups = groupGoalsByType([
		{ ...goal( 1, 'event' ), hook: 'generate_lead' },
		{ ...goal( 2, 'event' ), hook: 'file_download' }
	]);
	assert.deepStrictEqual(
		groups.map( ( group ) => [ group.type, group.goals.map( ( item ) => item.id ) ]),
		[ [ 'download', [ 2 ] ], [ 'event', [ 1 ] ] ]
	);
});

test( 'no goals, no groups', () => {
	assert.deepStrictEqual( groupGoalsByType([]), []);
});
