import assert from 'node:assert/strict';
import test from 'node:test';
import { useWizardStore } from './useWizardStore';

/**
 * Set the localized burst_settings the wizard reads its default channel from.
 *
 * @param {unknown} channels Value of burst_settings.default_report_channels.
 */
const setLocalizedChannels = ( channels: unknown ): void => {
	( globalThis as unknown as { window: unknown }).window = { burst_settings: { default_report_channels: channels } };
};

test.afterEach( () => {
	delete ( globalThis as unknown as { window?: unknown }).window;
});

test( 'a new report starts with email when no default is localized', () => {
	useWizardStore.getState().resetWizard();
	assert.strictEqual( useWizardStore.getState().wizard.channels, 'email' );
});

test( 'a new report starts with email and Slack when PHP localizes "both"', () => {
	setLocalizedChannels( 'both' );
	useWizardStore.getState().resetWizard();
	assert.strictEqual( useWizardStore.getState().wizard.channels, 'both' );
});

test( 'an unknown localized value falls back to email', () => {
	setLocalizedChannels( 'slack' );
	useWizardStore.getState().resetWizard();
	assert.strictEqual( useWizardStore.getState().wizard.channels, 'email' );
});
