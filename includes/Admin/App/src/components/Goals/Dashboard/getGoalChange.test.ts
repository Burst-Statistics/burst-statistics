import assert from 'node:assert/strict';
import test from 'node:test';
import getGoalChange from './getGoalChange';

test( 'a rise is green', () => {
	assert.strictEqual( getGoalChange( 12, 10 )?.colorClassName, 'text-green' );
});

test( 'a drop is red', () => {
	assert.strictEqual( getGoalChange( 8, 10 )?.colorClassName, 'text-red' );
});

test( 'an unchanged count is neutral, without an arrow', () => {
	assert.deepStrictEqual( getGoalChange( 10, 10 ), { label: '0%', colorClassName: 'text-text-gray' });
});

test( 'nothing shows without a previous period', () => {
	assert.strictEqual( getGoalChange( 10, 0 ), null );
});
