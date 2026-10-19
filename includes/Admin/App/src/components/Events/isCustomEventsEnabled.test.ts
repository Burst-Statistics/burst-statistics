import assert from 'node:assert/strict';
import test from 'node:test';
import { isCustomEventsEnabled } from './isCustomEventsEnabled';

test( 'a manager with the setting on sees events', () => {
	assert.strictEqual( isCustomEventsEnabled( true, {}), true );
});

test( 'a manager with the setting off sees no events', () => {
	assert.strictEqual( isCustomEventsEnabled( false, {}), false );
});

test( 'a viewer without settings fields falls back to the localized flag', () => {
	assert.strictEqual(
		isCustomEventsEnabled( undefined, { custom_events_enabled: true }),
		true
	);
	assert.strictEqual(
		isCustomEventsEnabled( undefined, { custom_events_enabled: false }),
		false
	);
});

test( 'a missing localization object is not an error', () => {
	assert.strictEqual( isCustomEventsEnabled( undefined, undefined ), false );
});

test( 'the setting wins over a localized flag that lags behind it', () => {
	assert.strictEqual(
		isCustomEventsEnabled( true, { custom_events_enabled: false }),
		true
	);
});

test( 'the string values a setting can hold are read as truthy', () => {
	assert.strictEqual( isCustomEventsEnabled( '1', undefined ), true );
	assert.strictEqual( isCustomEventsEnabled( '', undefined ), false );
});
