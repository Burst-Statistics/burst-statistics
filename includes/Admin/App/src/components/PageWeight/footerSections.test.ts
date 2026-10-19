import assert from 'node:assert/strict';
import test from 'node:test';
import { getFooterSections } from './footerSections';

const FIGURES = {
	total_co2_grams: 24780,
	co2_per_pageview_grams: 0.41,
	carbon_rating: 'F'
};

const base = {
	figures: FIGURES,
	isPreviewing: false,
	measuring: false,
	showCo2: true,
	showRating: true
};

test( 'hiding the estimate leaves the carbon rating showing', () => {
	const sections = getFooterSections({ ...base, showCo2: false });
	assert.strictEqual( sections.showEstimate, false );
	assert.strictEqual( sections.showRating, true );
	assert.notStrictEqual( sections.figures, null, 'figures are still needed to render the badge' );
});

test( 'hiding the carbon rating leaves the estimate showing', () => {
	const sections = getFooterSections({ ...base, showRating: false });
	assert.strictEqual( sections.showEstimate, true );
	assert.strictEqual( sections.showRating, false );
});

test( 'both toggles off leaves nothing to report but keeps the figures out of the way', () => {
	const sections = getFooterSections({ ...base, showCo2: false, showRating: false });
	assert.strictEqual( sections.showEstimate, false );
	assert.strictEqual( sections.showRating, false );
});

test( 'measuring suppresses both halves whatever the toggles say', () => {
	for ( const showCo2 of [ true, false ]) {
		for ( const showRating of [ true, false ]) {
			const sections = getFooterSections({ ...base, measuring: true, showCo2, showRating });
			assert.strictEqual( sections.figures, null, `figures with showCo2=${ showCo2 } showRating=${ showRating }` );
			assert.strictEqual( sections.showEstimate, false );
			assert.strictEqual( sections.showRating, false );
		}
	}
});

test( 'measuring never reports a preview, so nothing is labelled hypothetical', () => {
	const sections = getFooterSections({ ...base, measuring: true, isPreviewing: true });
	assert.strictEqual( sections.isAssumed, false );
});

test( 'a preview is marked as assumed once there are figures to preview', () => {
	const sections = getFooterSections({ ...base, isPreviewing: true });
	assert.strictEqual( sections.isAssumed, true );
});

test( 'no figures yet behaves like measuring', () => {
	const sections = getFooterSections({ ...base, figures: null });
	assert.strictEqual( sections.figures, null );
	assert.strictEqual( sections.showEstimate, false );
	assert.strictEqual( sections.showRating, false );
	assert.strictEqual( sections.isAssumed, false );
});

test( 'the reported figures are passed through untouched', () => {
	const sections = getFooterSections( base );
	assert.deepStrictEqual( sections.figures, FIGURES );
});
