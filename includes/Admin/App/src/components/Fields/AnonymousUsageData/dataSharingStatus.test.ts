import assert from 'node:assert/strict';
import test from 'node:test';
import { getDataSharingStatus } from './dataSharingStatus';

const lastSend = Date.UTC( 2026, 9, 1, 12 ) / 1000;
const nextSend = Date.UTC( 2026, 9, 31, 12 ) / 1000;

test( 'data sharing status is off when the toggle is off', () => {
	assert.strictEqual( getDataSharingStatus( false, true, { last_send: lastSend, next_send: nextSend, is_staging: false }), 'Off' );
});

test( 'data sharing status shows the last and next sync once saved', () => {
	const status = getDataSharingStatus( true, true, { last_send: lastSend, next_send: nextSend, is_staging: false });
	assert.match( status, /^On\. Last synced on October 1, 2026, next sync around October 31, 2026\.$/ );
});

test( 'data sharing status shows the planned first sync', () => {
	const status = getDataSharingStatus( true, true, { last_send: 0, next_send: nextSend, is_staging: false });
	assert.match( status, /^On\. The first sync is planned for October 31, 2026\.$/ );
});

test( 'data sharing status ignores the stale sync status before the opt-in is saved', () => {
	const status = getDataSharingStatus( true, false, { last_send: 0, next_send: nextSend, is_staging: false });
	assert.match( status, /After you save, the first comparison arrives after a month of tracking/ );
});

test( 'data sharing status explains that staging sites do not share', () => {
	const status = getDataSharingStatus( true, true, { last_send: 0, next_send: 0, is_staging: true });
	assert.match( status, /Staging and local sites/ );
});
