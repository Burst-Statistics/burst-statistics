import assert from 'node:assert/strict';
import test from 'node:test';
import { useWizardStore } from './useWizardStore';

test( 'useWizardStore initializes with enabled: false', () => {
	useWizardStore.getState().resetWizard();
	const wizard = useWizardStore.getState().wizard;
	assert.strictEqual( wizard.enabled, false );
	assert.strictEqual( wizard.scheduled, true );
});

test( 'useWizardStore setEnabled updates wizard enabled state', () => {
	useWizardStore.getState().resetWizard();
	useWizardStore.getState().setEnabled( true );
	assert.strictEqual( useWizardStore.getState().wizard.enabled, true );
	useWizardStore.getState().setEnabled( false );
	assert.strictEqual( useWizardStore.getState().wizard.enabled, false );
});

test( 'useWizardStore setScheduled toggles schedule correctly', () => {
	useWizardStore.getState().resetWizard();
	assert.strictEqual( useWizardStore.getState().wizard.scheduled, true );
	useWizardStore.getState().setScheduled( false );
	assert.strictEqual( useWizardStore.getState().wizard.scheduled, false );
});
