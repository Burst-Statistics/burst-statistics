import assert from 'node:assert/strict';
import test from 'node:test';
import getGoalDetailTitle, { getLeadingGoal } from './getGoalDetailTitle';

test( 'a rise of 5% or more names the goal behind it', () => {
	assert.strictEqual(
		getGoalDetailTitle({ conversions: 124, conversionsPrevious: 100, leadingGoal: 'Purchase' }),
		'Conversions up 24%, led by Purchase'
	);
});

test( 'a rise without a leading goal only states the change', () => {
	assert.strictEqual( getGoalDetailTitle({ conversions: 110, conversionsPrevious: 100 }), 'Conversions up 10%' );
});

test( 'a drop of 5% or more is reported as down', () => {
	assert.strictEqual( getGoalDetailTitle({ conversions: 80, conversionsPrevious: 100 }), 'Conversions down 20%' );
});

test( 'a change under 5% either way is steady', () => {
	assert.strictEqual( getGoalDetailTitle({ conversions: 104, conversionsPrevious: 100 }), 'Conversions steady compared to the previous period' );
	assert.strictEqual( getGoalDetailTitle({ conversions: 96, conversionsPrevious: 100 }), 'Conversions steady compared to the previous period' );
});

test( 'no conversions in the period says so', () => {
	assert.strictEqual( getGoalDetailTitle({ conversions: 0, conversionsPrevious: 12 }), 'No conversions yet in this period' );
});

test( 'without a previous period there is no title, since it would repeat the count', () => {
	assert.strictEqual( getGoalDetailTitle({ conversions: 12, conversionsPrevious: 0 }), '' );
});

test( 'a goal that stopped counting has no title, since the notice says it', () => {
	assert.strictEqual( getGoalDetailTitle({ conversions: 0, conversionsPrevious: 40, notCountingSince: 1760000000 }), '' );
});

test( 'the leading goal is the one that added the most conversions', () => {
	assert.strictEqual(
		getLeadingGoal([
			{ title: 'Signup', conversions: 50, conversionsPrevious: 45 },
			{ title: 'Purchase', conversions: 30, conversionsPrevious: 10 },
			{ title: 'Download', conversions: 5, conversionsPrevious: 20 }
		]),
		'Purchase'
	);
});

test( 'no goal leads when none grew', () => {
	assert.strictEqual( getLeadingGoal([ { title: 'Signup', conversions: 5, conversionsPrevious: 5 } ]), '' );
});
