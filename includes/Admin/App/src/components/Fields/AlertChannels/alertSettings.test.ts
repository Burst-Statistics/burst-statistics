import assert from 'node:assert/strict';
import test from 'node:test';
import {
	getAlertValue,
	isChannelInUse,
	isSlackWebhookSet,
	setAlertValue
} from './alertSettings';
import type { AlertRows, AlertValues } from './alertSettings';

const rows: AlertRows = {
	tracking_health: { label: 'Tracking stopped working', pro: false },
	traffic_spike: { label: 'Traffic spike', pro: true },
	traffic_drop: { label: 'Traffic drop', pro: true }
};

const defaults: AlertValues = {
	tracking_health: { email: true, slack: true },
	traffic_spike: { email: false, slack: true },
	traffic_drop: { email: false, slack: true }
};

test( 'a saved switch wins over the default, a missing one falls back to it', () => {
	const values = { tracking_health: { email: false } };

	assert.equal( getAlertValue( values, defaults, 'tracking_health', 'email' ), false );
	assert.equal( getAlertValue( values, defaults, 'tracking_health', 'slack' ), true );
	assert.equal( getAlertValue( undefined, defaults, 'traffic_spike', 'email' ), false );
	assert.equal( getAlertValue( undefined, undefined, 'unknown_row', 'email' ), false );
});

test( 'changing one switch keeps the others and fills in the full shape', () => {
	const next = setAlertValue({ traffic_drop: { slack: false } }, defaults, rows, 'traffic_spike', 'email', true );

	assert.deepEqual( next, {
		tracking_health: { email: true, slack: true },
		traffic_spike: { email: true, slack: true },
		traffic_drop: { email: false, slack: false }
	});
});

test( 'Pro rows only count as email alerts with a valid license', () => {
	const onlySpikeEmail = {
		tracking_health: { email: false, slack: false },
		traffic_spike: { email: true, slack: false },
		traffic_drop: { email: false, slack: false }
	};

	assert.equal( isChannelInUse( onlySpikeEmail, rows, 'email', true ), true );
	assert.equal( isChannelInUse( onlySpikeEmail, rows, 'email', false ), false );
	assert.equal( isChannelInUse( defaults, rows, 'email', false ), true );
	assert.equal( isChannelInUse( onlySpikeEmail, rows, 'slack', true ), false );
});

test( 'switches that were never saved count with their default', () => {
	assert.equal( isChannelInUse( undefined, rows, 'email', false, defaults ), true );
	assert.equal( isChannelInUse({ tracking_health: {} }, rows, 'email', false, defaults ), true );
	assert.equal( isChannelInUse( undefined, rows, 'email', false ), false );
});

test( 'a saved (masked) or typed Slack webhook counts as set, anything else does not', () => {
	const prefix = 'https://hooks.slack.com/services/';

	assert.equal( isSlackWebhookSet( 'https://hooks.slack.com/services/••••••••/••••••••/••••', prefix ), true );
	assert.equal( isSlackWebhookSet( ' https://hooks.slack.com/services/T0/B0/XYZ', prefix ), true );
	assert.equal( isSlackWebhookSet( '', prefix ), false );
	assert.equal( isSlackWebhookSet( 'https://example.com/hook', prefix ), false );
	assert.equal( isSlackWebhookSet( undefined, prefix ), false );
});

test( 'without a localized prefix (free) no webhook counts as set', () => {
	assert.equal( isSlackWebhookSet( 'https://hooks.slack.com/services/T0/B0/XYZ' ), false );
});
