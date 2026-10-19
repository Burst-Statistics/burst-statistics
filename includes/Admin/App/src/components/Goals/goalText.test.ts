import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { getBlockingHint, getCountsOnText, getFinishLabel, getTracksText, getWhereText } from './goalText';
import type { Goal } from './goalHelpers';

// isGoalComplete checks selectors with the DOM's own parser, which node does not have.
globalThis.document = new JSDOM().window.document as unknown as Document;

/**
 * A goal with defaults, overridden per test.
 *
 * @param {Partial<Goal>} overrides Fields that differ from the defaults.
 * @return {Goal} The goal.
 */
const makeGoal = ( overrides: Partial<Goal> ): Goal => ({
	id: 1,
	title: 'Goal',
	status: 'active',
	type: 'clicks',
	conversion_metric: 'visitors',
	selector: '',
	hook: '',
	specific_page: '',
	page_or_website: 'website',
	date_created: 0,
	...overrides
});

test( 'tracks text names the element by its readable id or class', () => {
	assert.strictEqual( getTracksText( makeGoal({ type: 'clicks', selector: 'button#buy-now' }) ), 'Clicks on “buy now”' );
	assert.strictEqual( getTracksText( makeGoal({ type: 'views', selector: '.newsletter-signup' }) ), 'Views of “newsletter signup”' );
});

test( 'tracks text falls back to the kind of element', () => {
	assert.strictEqual( getTracksText( makeGoal({ type: 'clicks', selector: 'h2.wp-block-post-title > a' }) ), 'Link clicks' );
	assert.strictEqual( getTracksText( makeGoal({ type: 'views', selector: 'h3' }) ), 'Heading views' );
	assert.strictEqual( getTracksText( makeGoal({ type: 'clicks', selector: 'section' }) ), 'Element clicks' );
});

test( 'tracks text for hook and visit goals, empty until set up', () => {
	assert.strictEqual( getTracksText( makeGoal({ type: 'hook', hook: 'init' }) ), 'When init runs' );
	assert.strictEqual( getTracksText( makeGoal({ type: 'hook', hook: '' }) ), '' );
	assert.strictEqual( getTracksText( makeGoal({ type: 'visits', specific_page: '/thank-you/' }) ), 'Visits to /thank-you/' );
	assert.strictEqual( getTracksText( makeGoal({ type: 'visits', specific_page: '' }) ), '' );
	assert.strictEqual( getTracksText( makeGoal({ type: 'clicks', selector: '' }) ), '' );
});

test( 'counts on: page for page scope and visits, whole site otherwise', () => {
	assert.strictEqual( getCountsOnText( makeGoal({ page_or_website: 'website' }) ), 'Whole site' );
	assert.strictEqual( getCountsOnText( makeGoal({ page_or_website: 'page', specific_page: '/pricing/' }) ), '/pricing/' );
	assert.strictEqual( getCountsOnText( makeGoal({ type: 'visits', page_or_website: 'website', specific_page: '/cart/' }) ), '/cart/' );
	assert.strictEqual( getCountsOnText( makeGoal({ type: 'hook', page_or_website: 'page', specific_page: '' }) ), '' );
});

test( 'where text: every page, or only the picked page', () => {
	assert.strictEqual( getWhereText( makeGoal({ page_or_website: 'website', specific_page: '/pricing/' }) ), 'Every page where it appears' );
	assert.strictEqual( getWhereText( makeGoal({ page_or_website: 'page', specific_page: '/pricing/' }) ), 'Only on /pricing/' );
	assert.strictEqual( getWhereText( makeGoal({ page_or_website: 'page', specific_page: '' }) ), 'Only on /' );
});

test( 'blocking hint only on setup steps for an unfinished goal', () => {
	const unfinishedClick = makeGoal({ type: 'clicks', selector: '' });
	assert.strictEqual( getBlockingHint( unfinishedClick, 2 ), 'Choose the element to track to continue.' );
	assert.strictEqual( getBlockingHint( unfinishedClick, 3 ), 'Choose the element to track to continue.' );
	assert.strictEqual( getBlockingHint( unfinishedClick, 1 ), '' );
	assert.strictEqual( getBlockingHint( unfinishedClick, 4 ), '' );
	assert.strictEqual( getBlockingHint( null, 2 ), '' );
	assert.strictEqual( getBlockingHint( makeGoal({ type: 'clicks', selector: '.buy' }), 2 ), '' );
});

test( 'blocking hint names what is missing', () => {
	assert.strictEqual( getBlockingHint( makeGoal({ type: 'hook', hook: ' ' }), 2 ), 'Enter the hook to track to continue.' );
	assert.strictEqual( getBlockingHint( makeGoal({ type: 'clicks', selector: '.buy[' }), 2 ), 'Fix the CSS selector to continue.' );
	assert.strictEqual( getBlockingHint( makeGoal({ type: 'hook', hook: 'init', page_or_website: 'page' }), 3 ), 'Choose a page to continue.' );
	assert.strictEqual( getBlockingHint( makeGoal({ type: 'visits' }), 2 ), 'Choose a page to continue.' );
});

test( 'finish label: an active goal, like a freshly added preset, is saved, an inactive one is started', () => {
	assert.strictEqual( getFinishLabel( makeGoal({ status: 'active' }) ), 'Save changes' );
	assert.strictEqual( getFinishLabel( makeGoal({ status: 'inactive' }) ), 'Save and start tracking' );
});
