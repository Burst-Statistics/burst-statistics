/**
 * Generate a CSS selector for an element picked in the selector picker.
 *
 * The selector always resolves to the clicked element and nothing else: a
 * unique id when there is one, then a unique class or attribute, otherwise
 * the shortest ancestor path that matches only that element. A bare tag or
 * a position step (:nth-child) only holds on the page the element was picked
 * on, so both come after anything that names the element.
 */

const VOLATILE_CLASS =
	/^(is-|has-|js-|sc-|wp-container-|elementor-element-|css-[a-z0-9]{5,}$)/;

const TEXT_LEVEL_TAG =
	/^(span|i|em|strong|b|small|svg|path|img|picture|source|figcaption)$/;

const CLICKABLE_ANCESTOR = 'a, button, [role="button"]';

// Attributes that name what an element is, tried before its position.
const NAMING_ATTRIBUTE = /^(href|name|aria-label|data-[\w-]+)$/;

// Longer values are usually generated, e.g. tracking urls or serialized data.
const MAX_ATTRIBUTE_LENGTH = 100;

/**
 * Escape an id or class so it can be used in a selector.
 * @param {string} value The identifier to escape.
 * @return {string} The escaped identifier.
 */
const escapeIdent = ( value: string ): string => {
	if ( 'undefined' !== typeof CSS && CSS.escape ) {
		return CSS.escape( value );
	}
	return value.replace( /[^a-zA-Z0-9_-]/g, '\\$&' );
};

/**
 * The classes of an element that are stable enough to build a selector with.
 * @param {Element} el The element to read the classes from.
 * @return {string[]} The stable classes.
 */
const stableClasses = ( el: Element ): string[] =>
	Array.from( el.classList ).filter(
		( name ) => name && ! VOLATILE_CLASS.test( name )
	);

/**
 * Whether a selector matches the given element and no other element.
 * @param {Element}  el       The element the selector should resolve to.
 * @param {string}   selector The selector to test.
 * @param {Document} doc      The document the element lives in.
 * @return {boolean} True when the selector matches only this element.
 */
const matchesOnly = ( el: Element, selector: string, doc: Document ): boolean => {
	const found = doc.querySelectorAll( selector );
	return 1 === found.length && found[0] === el;
};

/**
 * A selector based on the element id, when that id is unique.
 * @param {Element}  el  The element to build the selector for.
 * @param {Document} doc The document the element lives in.
 * @return {string} The id selector, or an empty string.
 */
const idSelector = ( el: Element, doc: Document ): string => {
	if ( ! el.id ) {
		return '';
	}
	const selector = '#' + escapeIdent( el.id );
	return matchesOnly( el, selector, doc ) ? selector : '';
};

/**
 * The tag of an element with its first stable class.
 * @param {Element} el The element to describe.
 * @return {string} E.g. "a.buy-now", or "a" without a stable class.
 */
const baseStep = ( el: Element ): string => {
	const tag = el.tagName.toLowerCase();
	const classes = stableClasses( el );
	return classes.length ? tag + '.' + escapeIdent( classes[0]) : tag;
};

/**
 * Sort order of the naming attributes: href and name say most about an element.
 * @param {string} name The attribute name.
 * @return {number} Lower sorts first.
 */
const attributeRank = ( name: string ): number => {
	const order = [ 'href', 'name' ];
	return order.includes( name ) ? order.indexOf( name ) : order.length;
};

/**
 * Attribute selectors for the attributes that name the element, best first.
 * @param {Element} el The element to read the attributes from.
 * @return {string[]} E.g. ['[href="/pricing/"]'].
 */
const attributeSteps = ( el: Element ): string[] =>
	Array.from( el.attributes )
		.filter( ( attr ) => NAMING_ATTRIBUTE.test( attr.name ) && attr.value && attr.value.length <= MAX_ATTRIBUTE_LENGTH )
		.sort( ( a, b ) => attributeRank( a.name ) - attributeRank( b.name ) )
		.map( ( attr ) => '[' + escapeIdent( attr.name ) + '="' + attr.value.replace( /["\\]/g, '\\$&' ) + '"]' );

/**
 * A selector of the element's tag, class and one naming attribute, when that matches only this element.
 * @param {Element}  el  The element to build the selector for.
 * @param {Document} doc The document the element lives in.
 * @return {string} The attribute selector, or an empty string.
 */
const attributeSelector = ( el: Element, doc: Document ): string => {
	const base = baseStep( el );
	return attributeSteps( el )
		.map( ( attribute ) => base + attribute )
		.find( ( selector ) => matchesOnly( el, selector, doc ) ) ?? '';
};

/**
 * The element's tag and stable class, when that matches only this element.
 * A bare tag is never returned: a page with a single button says nothing
 * about the buttons on other pages.
 * @param {Element}  el  The element to build the selector for.
 * @param {Document} doc The document the element lives in.
 * @return {string} The class selector, or an empty string.
 */
const classSelector = ( el: Element, doc: Document ): string => {
	const base = baseStep( el );
	return base.includes( '.' ) && matchesOnly( el, base, doc ) ? base : '';
};

/**
 * One step of a path selector: tag and stable class, then a naming attribute
 * or, when nothing else tells it apart from its siblings, its position.
 * @param {Element} el The element to describe.
 * @return {string} The selector for this single element.
 */
const pathStep = ( el: Element ): string => {
	const base = baseStep( el );
	const parent = el.parentElement;
	if ( ! parent ) {
		return base;
	}

	const siblings = Array.from( parent.children );
	const twins = siblings.filter(
		( sibling ) => sibling.tagName === el.tagName
	);
	if ( 2 > twins.length ) {
		return base;
	}

	const named = attributeSteps( el )
		.map( ( attribute ) => base + attribute )
		.find( ( step ) => 1 === twins.filter( ( twin ) => twin.matches( step ) ).length );
	if ( named ) {
		return named;
	}

	return base + ':nth-child(' + ( siblings.indexOf( el ) + 1 ) + ')';
};

/**
 * A path selector, walking up the ancestors until the path is unique.
 * @param {Element}  el  The element to build the selector for.
 * @param {Document} doc The document the element lives in.
 * @return {string} The path selector.
 */
const pathSelector = ( el: Element, doc: Document ): string => {
	const parts: string[] = [];
	let current: Element | null = el;

	while ( current && 'html' !== current.tagName.toLowerCase() ) {
		parts.unshift( pathStep( current ) );
		const candidate = parts.join( ' > ' );
		if ( matchesOnly( el, candidate, doc ) ) {
			return candidate;
		}
		current = current.parentElement;
	}

	return parts.join( ' > ' );
};

/**
 * The element a click should select: clicking a label inside a button or link
 * should select that button or link, not the label.
 * @param {Element} el The clicked element.
 * @return {Element} The element to build the selector for.
 */
export const resolveTarget = ( el: Element ): Element => {
	if ( ! TEXT_LEVEL_TAG.test( el.tagName.toLowerCase() ) ) {
		return el;
	}
	if ( el.id || stableClasses( el ).length ) {
		return el;
	}
	return el.closest( CLICKABLE_ANCESTOR ) || el;
};

/**
 * Build a CSS selector that matches only the given element.
 * @param {Element}  el  The element to build the selector for.
 * @param {Document} doc The document the element lives in.
 * @return {string} The selector.
 */
export const buildCssSelector = ( el: Element, doc: Document ): string =>
	idSelector( el, doc ) ||
	classSelector( el, doc ) ||
	attributeSelector( el, doc ) ||
	pathSelector( el, doc );

/**
 * Whether a selector only identifies its element on the page it was picked on:
 * by position, or by tags alone without an id, class or attribute anywhere in
 * the path. On other pages the same position or tag can hold a different element.
 * @param {string} selector The selector.
 * @return {boolean} True when the selector is bound to the page it was picked on.
 */
export const isPageBoundSelector = ( selector: string ): boolean =>
	selector.includes( ':nth-child(' ) || ! /[#.[]/.test( selector );

const MAX_LABEL_LENGTH = 40;

/**
 * The places an element can carry a human readable name, best first.
 * @param {Element} el The element to read.
 * @return {Array<string|null>} The raw candidate values.
 */
const labelSources = ( el: Element ): Array<string | null> => [
	( el as HTMLElement ).innerText,
	el.textContent,
	el.getAttribute( 'aria-label' ),
	el.getAttribute( 'alt' ),
	el.getAttribute( 'title' )
];

/**
 * A short human readable name for an element, used to name a goal.
 * @param {Element} el The element to describe.
 * @return {string} The label, or an empty string when the element has none.
 */
export const describeElement = ( el: Element ): string => {
	const label = labelSources( el )
		.map( ( value ) => String( value ?? '' ).replace( /\s+/g, ' ' ).trim() )
		.find( Boolean );

	if ( ! label ) {
		return '';
	}

	return label.length > MAX_LABEL_LENGTH ?
		label.slice( 0, MAX_LABEL_LENGTH ).trim() + '\u2026' :
		label;
};
