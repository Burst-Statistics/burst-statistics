import assert from 'node:assert/strict';
import test from 'node:test';
import { useGoalWizardStore } from './useGoalWizardStore';

test( 'openWizard without id starts a new goal on step 1', () => {
	useGoalWizardStore.getState().openWizard();
	const state = useGoalWizardStore.getState();
	assert.strictEqual( state.isOpen, true );
	assert.strictEqual( state.goalId, null );
	assert.strictEqual( state.currentStep, 1 );
	assert.strictEqual( state.pendingType, 'clicks' );
});

test( 'openWizard with id opens that goal on the review step', () => {
	useGoalWizardStore.getState().openWizard( 12 );
	const state = useGoalWizardStore.getState();
	assert.strictEqual( state.goalId, 12 );
	assert.strictEqual( state.currentStep, 4 );
});

test( 'openWizard with id and step opens that step', () => {
	useGoalWizardStore.getState().openWizard( 12, 2 );
	assert.strictEqual( useGoalWizardStore.getState().currentStep, 2 );
});

test( 'closeWizard resets the wizard', () => {
	useGoalWizardStore.getState().openWizard( 12, 3 );
	useGoalWizardStore.getState().setPendingType( 'hook' );
	useGoalWizardStore.getState().closeWizard();
	const state = useGoalWizardStore.getState();
	assert.strictEqual( state.isOpen, false );
	assert.strictEqual( state.goalId, null );
	assert.strictEqual( state.currentStep, 1 );
	assert.strictEqual( state.pendingType, 'clicks' );
});

test( 'nextStep and prevStep stay within the four steps', () => {
	useGoalWizardStore.getState().openWizard( 12, 4 );
	useGoalWizardStore.getState().nextStep( 'clicks' );
	assert.strictEqual( useGoalWizardStore.getState().currentStep, 4 );
	useGoalWizardStore.getState().setCurrentStep( 1 );
	useGoalWizardStore.getState().prevStep( 'clicks' );
	assert.strictEqual( useGoalWizardStore.getState().currentStep, 1 );
});

test( 'click goals go through where it counts, visit and hook goals skip it', () => {
	useGoalWizardStore.getState().openWizard( 12, 2 );
	useGoalWizardStore.getState().nextStep( 'clicks' );
	assert.strictEqual( useGoalWizardStore.getState().currentStep, 3 );

	useGoalWizardStore.getState().setCurrentStep( 2 );
	useGoalWizardStore.getState().nextStep( 'hook' );
	assert.strictEqual( useGoalWizardStore.getState().currentStep, 4 );
	useGoalWizardStore.getState().prevStep( 'visits' );
	assert.strictEqual( useGoalWizardStore.getState().currentStep, 2 );
});

test( 'setNewGoal points the wizard at the created goal until close', () => {
	useGoalWizardStore.getState().openWizard();
	useGoalWizardStore.getState().setNewGoal( 7 );
	assert.strictEqual( useGoalWizardStore.getState().goalId, 7 );
	useGoalWizardStore.getState().closeWizard();
	assert.strictEqual( useGoalWizardStore.getState().goalId, null );
});
