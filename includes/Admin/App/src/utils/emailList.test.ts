import assert from 'node:assert/strict';
import test from 'node:test';
import { validateEmailList } from './emailList';

test( 'email addresses are checked for a plausible shape', () => {
	assert.equal( validateEmailList([ 'admin@example.com', ' shop@example.com ' ]), true );
	assert.equal( validateEmailList([ 'foo@' ]), 'One or more email addresses are invalid' );
	assert.equal( validateEmailList([ 'no spaces@example.com' ]), 'One or more email addresses are invalid' );
});

test( 'an empty list is only an error when the list is required', () => {
	assert.equal( validateEmailList([]), true );
	assert.equal(
		validateEmailList([], { isRequired: true, requiredMessage: 'Add at least one address, or turn off email alerts.' }),
		'Add at least one address, or turn off email alerts.'
	);
	assert.equal( validateEmailList([ 'admin@example.com' ], { isRequired: true }), true );
});

test( 'invalid, duplicate and too many addresses are rejected', () => {
	assert.equal( validateEmailList([ 'admin@example.com', 'foo@' ]), 'One or more email addresses are invalid' );
	assert.equal( validateEmailList([ 'admin@example.com', 'Admin@Example.com' ]), 'Duplicate email addresses are not allowed' );
	assert.equal( validateEmailList([ 'a@example.com', 'b@example.com' ], { max: 1 }), 'Maximum 1 recipients allowed' );
});
