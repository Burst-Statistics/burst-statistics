import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { canActivateGoal, describeSelector, getGoalPage, getGoalResumeStep, getGoalSteps, getShortSelector, isElementType, isGoalComplete, isGoalCounting } from './goalHelpers';

// isGoalComplete checks selectors with the DOM's own parser, which node does not have.
globalThis.document = new JSDOM().window.document as unknown as Document;

test( 'click goal without selector is incomplete', () => {
	assert.strictEqual( isGoalComplete({ type: 'clicks', selector: '', page_or_website: 'website' }), false );
});

test( 'click goal with selector on whole site is complete', () => {
	assert.strictEqual( isGoalComplete({ type: 'clicks', selector: '.buy', page_or_website: 'website' }), true );
});

test( 'click or view goal with a selector the browser rejects is incomplete', () => {
	assert.strictEqual( isGoalComplete({ type: 'views', selector: '.qa-pricing[', page_or_website: 'website' }), false );
	assert.strictEqual( isGoalComplete({ type: 'clicks', selector: '.buy >', page_or_website: 'website' }), false );
});

test( 'view goal scoped to a page without a page counts on the home page, so it is complete', () => {
	assert.strictEqual( isGoalComplete({ type: 'views', selector: '.buy', page_or_website: 'page', specific_page: '' }), true );
});

test( 'view goal scoped to a page with a page is complete', () => {
	assert.strictEqual( isGoalComplete({ type: 'views', selector: '.buy', page_or_website: 'page', specific_page: '/pricing' }), true );
});

test( 'visit goal without page is incomplete', () => {
	assert.strictEqual( isGoalComplete({ type: 'visits', specific_page: '' }), false );
});

test( 'visit goal with page is complete', () => {
	assert.strictEqual( isGoalComplete({ type: 'visits', specific_page: '/thank-you' }), true );
});

test( 'hook goal with whitespace hook is incomplete', () => {
	assert.strictEqual( isGoalComplete({ type: 'hook', hook: '  ' }), false );
});

test( 'hook goal with hook name is complete', () => {
	assert.strictEqual( isGoalComplete({ type: 'hook', hook: 'woocommerce_add_to_cart' }), true );
});

test( 'unfinished goal resumes on the target step, finished goal on review', () => {
	assert.strictEqual( getGoalResumeStep({ type: 'hook', hook: '' }), 2 );
	assert.strictEqual( getGoalResumeStep({ type: 'hook', hook: 'init' }), 4 );
});

test( 'click and view goals without a page use the home page', () => {
	assert.strictEqual( getGoalPage({ type: 'clicks', specific_page: '' }), '/' );
	assert.strictEqual( getGoalPage({ type: 'views', specific_page: '/shop/' }), '/shop/' );
});

test( 'visit and hook goals without a page have no page', () => {
	assert.strictEqual( getGoalPage({ type: 'visits', specific_page: '' }), '' );
	assert.strictEqual( getGoalPage({ type: 'hook', specific_page: '' }), '' );
});

test( 'hook goal scoped to a page needs that page', () => {
	assert.strictEqual( isGoalComplete({ type: 'hook', hook: 'init', page_or_website: 'page', specific_page: '' }), false );
	assert.strictEqual( isGoalComplete({ type: 'hook', hook: 'init', page_or_website: 'page', specific_page: '/cart/' }), true );
});

test( 'selector description: element kind from the last part of the selector', () => {
	assert.deepStrictEqual(
		describeSelector( 'li.wp-block-pages-list__item:nth-child(8) > a.wp-block-pages-list__item__link' ),
		{ tag: 'a', name: '' }
	);
	assert.deepStrictEqual( describeSelector( 'div.entry-content > p.wp-block-paragraph:nth-child(1)' ), { tag: 'p', name: '' });
	assert.deepStrictEqual( describeSelector( 'a[href^="https"]' ), { tag: 'a', name: '' });
});

test( 'selector description: readable id or class becomes the name', () => {
	assert.deepStrictEqual( describeSelector( '.burst-test-goal' ), { tag: '', name: 'burst test goal' });
	assert.deepStrictEqual( describeSelector( 'button#buy-now' ), { tag: 'button', name: 'buy now' });
	assert.deepStrictEqual( describeSelector( '.woocommerce .add_to_cart_button' ), { tag: '', name: 'add to cart button' });
	assert.deepStrictEqual( describeSelector( '.is-style-outline.wp-element-button.signup' ), { tag: '', name: 'signup' });
});

test( 'selector description: only the first of a selector list is described', () => {
	assert.deepStrictEqual( describeSelector( '.newsletter-submit, .footer-submit' ), { tag: '', name: 'newsletter submit' });
});

test( 'only click and view goals track an element', () => {
	assert.strictEqual( isElementType( 'clicks' ), true );
	assert.strictEqual( isElementType( 'views' ), true );
	assert.strictEqual( isElementType( 'visits' ), false );
	assert.strictEqual( isElementType( 'hook' ), false );
});

test( 'a goal can be activated when finished and under the limit, or when already active', () => {
	const finished = { type: 'clicks', selector: '.buy', page_or_website: 'website' };
	assert.strictEqual( canActivateGoal({ ...finished, status: 'inactive' }, false ), true );
	assert.strictEqual( canActivateGoal({ ...finished, status: 'inactive' }, true ), false );
	assert.strictEqual( canActivateGoal({ ...finished, status: 'active' }, true ), true );
	assert.strictEqual( canActivateGoal({ type: 'clicks', selector: '', status: 'inactive' }, false ), false );
});

test( 'getGoalSteps skips where it counts for visit and hook goals', () => {
	assert.deepStrictEqual( getGoalSteps( 'clicks' ), [ 1, 2, 3, 4 ]);
	assert.deepStrictEqual( getGoalSteps( 'views' ), [ 1, 2, 3, 4 ]);
	assert.deepStrictEqual( getGoalSteps( 'visits' ), [ 1, 2, 4 ]);
	assert.deepStrictEqual( getGoalSteps( 'hook' ), [ 1, 2, 4 ]);
});

test( 'getShortSelector names the element by its most specific class or id', () => {
	assert.strictEqual( getShortSelector( '.wp-block-button__link.get-pro' ), '.get-pro' );
	assert.strictEqual( getShortSelector( 'main > a.wp-element-button' ), 'main > a.wp-element-button' );
	assert.strictEqual( getShortSelector( 'p.wp-block-paragraph:nth-child(4)' ), 'p.wp-block-paragraph:nth-child(4)' );
	assert.strictEqual( getShortSelector( 'button#buy' ), '#buy' );
	assert.strictEqual( getShortSelector( 'a[href="/pricing/"]' ), 'a[href="/pricing/"]' );
});

test( 'isGoalCounting: only an active, finished goal counts', () => {
	assert.strictEqual( isGoalCounting({ type: 'clicks', selector: '.buy', status: 'active' }), true );
	assert.strictEqual( isGoalCounting({ type: 'clicks', selector: '.buy', status: 'inactive' }), false );
	assert.strictEqual( isGoalCounting({ type: 'views', selector: '.buy[', status: 'active' }), false );
});
