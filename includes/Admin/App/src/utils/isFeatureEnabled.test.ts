import assert from 'node:assert/strict';
import test from 'node:test';
import { isFeatureEnabled } from './isFeatureEnabled';

const settings = { non_essential_features: [ 'goals', 'scroll_depth', 'co2' ] };

test( 'every feature is on when essentials mode is off', () => {
	assert.strictEqual( isFeatureEnabled( 'goals', false, settings ), true );
	assert.strictEqual( isFeatureEnabled( 'co2', false, settings ), true );
});

test( 'essentials mode turns off the non-essential features', () => {
	assert.strictEqual( isFeatureEnabled( 'goals', true, settings ), false );
	assert.strictEqual( isFeatureEnabled( 'scroll_depth', true, settings ), false );
	assert.strictEqual( isFeatureEnabled( 'co2', true, settings ), false );
});

test( 'essentials mode leaves features outside the list on', () => {
	assert.strictEqual( isFeatureEnabled( 'pageviews', true, settings ), true );
});

test( 'a viewer without settings fields falls back to the localized flag', () => {
	assert.strictEqual( isFeatureEnabled( 'goals', undefined, { ...settings, essentials_mode: true }), false );
	assert.strictEqual( isFeatureEnabled( 'goals', undefined, { ...settings, essentials_mode: false }), true );
});

test( 'a manager toggling the setting wins over a stale localized flag', () => {
	assert.strictEqual( isFeatureEnabled( 'goals', false, { ...settings, essentials_mode: true }), true );
	assert.strictEqual( isFeatureEnabled( 'goals', true, { ...settings, essentials_mode: false }), false );
});
