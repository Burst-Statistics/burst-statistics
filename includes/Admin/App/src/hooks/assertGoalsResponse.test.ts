import assert from 'node:assert/strict';
import test from 'node:test';
import { assertGoalsResponse } from './assertGoalsResponse';

test( 'expired nonce response: rejected with the server message', () => {
	assert.throws(
		() => assertGoalsResponse({ success: false, message: 'Session expired. Try refreshing the page.' }),
		{ message: 'Session expired. Try refreshing the page.' }
	);
});

test( 'response with goals: returned unchanged', () => {
	const response = { goals: [ { id: 1 } ] };
	assert.equal( assertGoalsResponse( response ), response );
});

test( 'response without goals: returned, a site can have none', () => {
	const response = { goals: [] };
	assert.equal( assertGoalsResponse( response ), response );
});
