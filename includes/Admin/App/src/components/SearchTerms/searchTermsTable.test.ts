import assert from 'node:assert/strict';
import test from 'node:test';
import { getSearchTermsTableConfig } from './searchTermsTableConfig';
import { summarizeSmartMatchRows } from './smartMatchSummaryData';

test( 'the AI match column does not exist without SmartMatch', () => {
	const config = getSearchTermsTableConfig( false );

	assert.deepStrictEqual( config.defaultColumns, [ 'term', 'volume', 'results' ]);
	assert.strictEqual( 'ai_match' in config.columnsOptions, false );
});

test( 'the AI match column is available and shown by default with SmartMatch', () => {
	const config = getSearchTermsTableConfig( true );

	assert.deepStrictEqual( config.defaultColumns, [ 'term', 'volume', 'results', 'ai_match' ]);
	assert.strictEqual( config.columnsOptions.ai_match.format, 'ai_match' );
	assert.strictEqual( config.columnsOptions.ai_match.label, 'AI match' );
	assert.strictEqual( config.columnsOptions.ai_match.addWhenAvailable, true, 'Saved selections from before SmartMatch get the column too' );
});

test( 'the native results column keeps its own format with SmartMatch', () => {
	assert.strictEqual( getSearchTermsTableConfig( true ).columnsOptions.results.format, 'search_results' );
});

test( 'the volume column shows the AI match count next to the volume', () => {
	assert.strictEqual( getSearchTermsTableConfig( false ).columnsOptions.volume.format, 'search_volume' );
});

test( 'the summary only counts searches that found nothing natively', () => {
	const summary = summarizeSmartMatchRows([
		{ volume: 142, results: 9, ai_shown: 131 },
		{ volume: 64, results: 0, ai_shown: 61 },
		{ volume: 23, results: 0, ai_shown: 23 },
		{ volume: 17, results: 0, ai_shown: 0 }
	]);

	assert.deepStrictEqual( summary, { answered: 84, emptySearches: 104, termsWithoutPage: 1 });
});

test( 'the summary handles numeric strings and missing ai fields', () => {
	const summary = summarizeSmartMatchRows([
		{ volume: '5', results: '0' },
		{ volume: '3', results: '0', ai_shown: '2' }
	]);

	assert.deepStrictEqual( summary, { answered: 2, emptySearches: 8, termsWithoutPage: 1 });
});
