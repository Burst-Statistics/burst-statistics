import assert from 'node:assert/strict';
import test from 'node:test';
import { safeHref } from './safeHref';

const BASE = 'https://example.com';

test( 'an https url is returned normalized', () => {
	assert.strictEqual( safeHref( 'https://burst-statistics.com/pricing', BASE ), 'https://burst-statistics.com/pricing' );
});

test( 'an http url is allowed', () => {
	assert.strictEqual( safeHref( 'http://example.org', BASE ), 'http://example.org/' );
});

test( 'a relative path resolves against the base', () => {
	assert.strictEqual( safeHref( '/blog/post', BASE ), 'https://example.com/blog/post' );
});

test( 'a javascript url is rejected', () => {
	assert.strictEqual( safeHref( 'javascript:alert(1)', BASE ), undefined );
	assert.strictEqual( safeHref( '  JavaScript:alert(1)', BASE ), undefined );
});

test( 'a data url is rejected', () => {
	assert.strictEqual( safeHref( 'data:text/html,<script>alert(1)</script>', BASE ), undefined );
});

test( 'an empty or missing url is rejected', () => {
	assert.strictEqual( safeHref( '', BASE ), undefined );
	assert.strictEqual( safeHref( '   ', BASE ), undefined );
	assert.strictEqual( safeHref( undefined, BASE ), undefined );
	assert.strictEqual( safeHref( null, BASE ), undefined );
});

test( 'a relative path without a base is rejected', () => {
	assert.strictEqual( safeHref( '/blog/post', undefined ), undefined );
});
