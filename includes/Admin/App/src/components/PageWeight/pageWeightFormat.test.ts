import assert from 'node:assert/strict';
import test from 'node:test';
import { formatEmissions, getWeightChange } from './pageWeightFormat';

test( 'getWeightChange reports a fall in weight as an improvement', () => {
	const change = getWeightChange( 1000, 2000 );
	assert.ok( change );
	assert.strictEqual( change.isImprovement, true );
	assert.match( change.label, /^-50/ );
});

test( 'getWeightChange reports a rise in weight as a regression and signs it', () => {
	const change = getWeightChange( 2000, 1000 );
	assert.ok( change );
	assert.strictEqual( change.isImprovement, false );
	assert.match( change.label, /^\+100/ );
});

test( 'getWeightChange treats an unchanged weight as an improvement, not a regression', () => {
	const change = getWeightChange( 1500, 1500 );
	assert.ok( change );
	assert.strictEqual( change.isImprovement, true );
});

test( 'getWeightChange returns null when a period has nothing measured', () => {
	assert.strictEqual( getWeightChange( 1000, 0 ), null );
	assert.strictEqual( getWeightChange( 0, 1000 ), null );
});

test( 'formatEmissions renders grams below one kilo', () => {
	assert.match( formatEmissions( 840 ), /840(\.0)? g CO2e/ );
});

test( 'formatEmissions switches to kilograms from one kilo up', () => {
	assert.match( formatEmissions( 8400 ), /8\.4 kg CO2e/ );
	assert.match( formatEmissions( 1000 ), /1 kg CO2e/ );
});

test( 'formatEmissions keeps sub-tenth-gram values legible as milligrams', () => {

	// 0.03 g sits inside the A+ rating band; it must never render as "0 g".
	assert.match( formatEmissions( 0.03 ), /^30 mg CO2e/ );
	assert.match( formatEmissions( 0.034 ), /^34 mg CO2e/ );
});

test( 'formatEmissions stays in grams from a tenth of a gram up', () => {
	assert.match( formatEmissions( 0.1 ), /^0\.1 g CO2e/ );
	assert.match( formatEmissions( 0.45 ), /^0\.5 g CO2e/ );
});
