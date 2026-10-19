import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import {
	buildCssSelector,
	describeElement,
	isPageBoundSelector,
	resolveTarget
} from './buildCssSelector';

const render = ( html: string ): Document =>
	new JSDOM( `<body>${html}</body>` ).window.document;

test( 'a unique id wins', () => {
	const doc = render( '<button id="buy" class="btn">Buy</button>' );
	const el = doc.querySelector( '#buy' ) as Element;
	assert.strictEqual( buildCssSelector( el, doc ), '#buy' );
});

test( 'a duplicated id is ignored and the path is used instead', () => {
	const doc = render(
		'<a id="dup" class="cta">one</a><a id="dup" class="cta">two</a>'
	);
	const el = doc.querySelectorAll( '#dup' )[1];
	const selector = buildCssSelector( el, doc );

	assert.ok( ! selector.startsWith( '#' ) );
	assert.strictEqual( doc.querySelectorAll( selector ).length, 1 );
	assert.strictEqual( doc.querySelector( selector ), el );
});

test( 'a shared class is narrowed down to the clicked element', () => {
	const doc = render(
		'<ul><li><a class="add_to_cart_button">1</a></li>' +
			'<li><a class="add_to_cart_button">2</a></li></ul>'
	);
	const el = doc.querySelectorAll( '.add_to_cart_button' )[1];
	const selector = buildCssSelector( el, doc );

	assert.strictEqual( doc.querySelectorAll( selector ).length, 1 );
	assert.strictEqual( doc.querySelector( selector ), el );
});

test( 'a unique class is used as is', () => {
	const doc = render(
		'<button class="is-active elementor-element-a1b2c3 checkout-button">Go</button>'
	);
	const el = doc.querySelector( 'button' ) as Element;
	assert.strictEqual( buildCssSelector( el, doc ), 'button.checkout-button' );
});

test( 'an element without usable classes falls back to a unique path', () => {
	const doc = render( '<div><p>one</p><p>two</p><p>three</p></div>' );
	const el = doc.querySelectorAll( 'p' )[2];
	const selector = buildCssSelector( el, doc );

	assert.strictEqual( doc.querySelectorAll( selector ).length, 1 );
	assert.strictEqual( doc.querySelector( selector ), el );
	assert.ok( selector.includes( ':nth-child(3)' ) );
});

test( 'the generated selector matches the element and nothing else', () => {
	const doc = render(
		'<section class="is-active"><div><span>a</span><span>b</span></div></section>' +
			'<section class="is-active"><div><span>a</span><span>b</span></div></section>'
	);

	doc.querySelectorAll( 'span' ).forEach( ( el ) => {
		const selector = buildCssSelector( el, doc );
		assert.ok( el.matches( selector ) );
		assert.strictEqual( doc.querySelectorAll( selector ).length, 1 );
	});
});

test( 'resolveTarget climbs from a label to its button', () => {
	const doc = render( '<button class="cta"><span>Buy now</span></button>' );
	const label = doc.querySelector( 'span' ) as Element;
	assert.strictEqual( resolveTarget( label ), doc.querySelector( 'button' ) );
});

test( 'resolveTarget keeps an element that has its own class', () => {
	const doc = render( '<a class="cta"><span class="label">Buy</span></a>' );
	const label = doc.querySelector( '.label' ) as Element;
	assert.strictEqual( resolveTarget( label ), label );
});

test( 'describeElement uses the element text', () => {
	const doc = render( '<button class="cta">  Add to   cart </button>' );
	const el = doc.querySelector( 'button' ) as Element;
	assert.strictEqual( describeElement( el ), 'Add to cart' );
});

test( 'describeElement falls back to aria-label, then alt', () => {
	const doc = render(
		'<button aria-label="Close dialog"></button>' +
			'<img src="x.png" alt="Company logo">'
	);
	const button = doc.querySelector( 'button' ) as Element;
	const image = doc.querySelector( 'img' ) as Element;

	assert.strictEqual( describeElement( button ), 'Close dialog' );
	assert.strictEqual( describeElement( image ), 'Company logo' );
});

test( 'describeElement truncates long text and returns empty when there is none', () => {
	const doc = render(
		'<p>' + 'a'.repeat( 60 ) + '</p><div></div>'
	);
	const paragraph = doc.querySelector( 'p' ) as Element;

	assert.strictEqual( describeElement( paragraph ).length, 41 );
	assert.ok( describeElement( paragraph ).endsWith( '\u2026' ) );
	assert.strictEqual( describeElement( doc.querySelector( 'div' ) as Element ), '' );
});

test( 'a naming attribute is used before a position', () => {
	const doc = render(
		'<nav><a href="/features/">Features</a><a href="/pricing/">Pricing</a></nav>' +
			'<footer><a href="/blog/">Blog</a></footer>'
	);
	const el = doc.querySelectorAll( 'a' )[1];
	const selector = buildCssSelector( el, doc );

	assert.strictEqual( selector, 'a[href="/pricing/"]' );
	assert.ok( ! isPageBoundSelector( selector ) );
});

test( 'a data attribute tells twins apart inside a path', () => {
	const doc = render(
		'<ul><li data-product="1"><a class="add">Add</a></li><li data-product="2"><a class="add">Add</a></li></ul>'
	);
	const el = doc.querySelectorAll( 'a' )[1];
	const selector = buildCssSelector( el, doc );

	assert.strictEqual( doc.querySelectorAll( selector ).length, 1 );
	assert.strictEqual( doc.querySelector( selector ), el );
	assert.ok( selector.includes( '[data-product="2"]' ) );
	assert.ok( ! isPageBoundSelector( selector ) );
});

test( 'quotes in an attribute value are escaped', () => {
	const doc = render( '<a href="/x">a</a><a href="/say-&quot;hi&quot;">b</a>' );
	const el = doc.querySelectorAll( 'a' )[1];
	assert.strictEqual( doc.querySelector( buildCssSelector( el, doc ) ), el );
});

test( 'a link without a class is named by its href, not by its bare tag', () => {
	const doc = render( '<p>Text</p><a href="/pricing/">Pricing</a>' );
	const el = doc.querySelector( 'a' ) as Element;
	const selector = buildCssSelector( el, doc );

	assert.strictEqual( selector, 'a[href="/pricing/"]' );
	assert.ok( ! isPageBoundSelector( selector ) );
});

test( 'a lone button without class or attributes is bound to its page', () => {
	const doc = render( '<section><p>Text</p><button>Go</button></section>' );
	const el = doc.querySelector( 'button' ) as Element;
	const selector = buildCssSelector( el, doc );

	assert.strictEqual( doc.querySelector( selector ), el );
	assert.ok( isPageBoundSelector( selector ) );
});

test( 'isPageBoundSelector flags positions and bare tag paths', () => {
	assert.strictEqual( isPageBoundSelector( 'body > div:nth-child(3) > a' ), true );
	assert.strictEqual( isPageBoundSelector( 'section.hero > div:nth-child(2) > a' ), true );
	assert.strictEqual( isPageBoundSelector( 'button' ), true );
	assert.strictEqual( isPageBoundSelector( 'body > div > section > a' ), true );
	assert.strictEqual( isPageBoundSelector( 'nav.site-header > a' ), false );
	assert.strictEqual( isPageBoundSelector( 'a[href="/pricing/"]' ), false );
	assert.strictEqual( isPageBoundSelector( '#signup' ), false );
	assert.strictEqual( isPageBoundSelector( 'a.get-pro' ), false );
});
