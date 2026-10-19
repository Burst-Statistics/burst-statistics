import { useCallback, useEffect, useRef, useState } from 'react';
import debounce from 'lodash/debounce';
import { __ } from '@wordpress/i18n';

const DEBOUNCE_DELAY = 300;

interface SelectorMatches {
	iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
	matchCount: number | null;
	previews: string[];
	previewIndex: number;
	stepPreview: ( step: number ) => void;
	warning: string;
	error: string;
	isTesting: boolean;
	retest: () => void;
}

/**
 * Render one matched element on its own, with the site's stylesheets.
 *
 * Only styling is copied: running the site's head scripts inside the admin
 * page would execute third party and user authored markup here.
 * @param {Document} doc  The document the element was found in.
 * @param {Element}  node The matched element.
 * @return {string} A standalone HTML document.
 */
const buildPreviewDocument = ( doc: Document, node: Element ): string => {
	const head = Array.from(
		doc.head.querySelectorAll( 'style, link[rel="stylesheet"]' )
	)
		.map( ( el ) => el.outerHTML )
		.join( '' );

	return `<!DOCTYPE html><html><head>${head}</head><body style="display: flex; justify-content: center; align-items: center; height: 100vh;">${node.outerHTML}</body></html>`;
};

/**
 * Warn when a matched element is invisible to visitors.
 * @param {Element} node The matched element.
 * @return {string} The warning, or an empty string.
 */
const getHiddenWarning = ( node: Element ): string => {
	const style = getComputedStyle( node );
	const isHidden = 'none' === style.display || 'hidden' === style.visibility;

	return isHidden ?
		__(
				'This element is hidden via CSS, so it may never be clicked.',
				'burst-statistics'
			) :
		'';
};

/**
 * Count what a selector matches on a page, and preview each match.
 *
 * The page is loaded in a hidden same origin iframe, whose ref this hook
 * returns; call retest() once that iframe has loaded.
 * @param {string} selector The CSS selector to test.
 * @return {SelectorMatches} The match state and the iframe ref to attach.
 */
const useSelectorMatches = ( selector: string ): SelectorMatches => {
	const [ matchCount, setMatchCount ] = useState<number | null>( null );
	const [ previews, setPreviews ] = useState<string[]>([]);
	const [ previewIndex, setPreviewIndex ] = useState( 0 );
	const [ warning, setWarning ] = useState( '' );
	const [ error, setError ] = useState( '' );
	const [ isTesting, setIsTesting ] = useState( false );
	const iframeRef = useRef<HTMLIFrameElement | null>( null );

	const clear = useCallback( ( message: string ) => {
		setMatchCount( null );
		setPreviews([]);
		setWarning( '' );
		setError( message );
	}, []);

	const applyMatches = useCallback( ( doc: Document, nodes: Element[]) => {
		setError( '' );
		setMatchCount( nodes.length );
		setPreviews( nodes.map( ( node ) => buildPreviewDocument( doc, node ) ) );
		setPreviewIndex( 0 );
		setWarning( nodes.length ? getHiddenWarning( nodes[0]) : '' );
	}, []);

	const test = useCallback(
		( value: string ) => {
			const doc = iframeRef.current?.contentDocument;
			if ( ! value || ! doc ) {
				clear( '' );
				return;
			}

			try {
				applyMatches( doc, Array.from( doc.querySelectorAll( value ) ) );
			} catch ( e ) {
				clear( ( e as Error ).message );
			}
		},
		[ clear, applyMatches ]
	);

	const debouncedTest = useRef<ReturnType<typeof debounce> | null>( null );

	useEffect( () => {
		const fn = debounce( ( value: string ) => {
			test( value );
			setIsTesting( false );
		}, DEBOUNCE_DELAY );

		debouncedTest.current = fn;
		return () => fn.cancel();
	}, [ test ]);

	useEffect( () => {
		setIsTesting( true );
		debouncedTest.current?.( selector );
	}, [ selector ]);

	const stepPreview = useCallback(
		( step: number ) => {
			setPreviewIndex(
				( current ) =>
					( current + step + previews.length ) % previews.length
			);
		},
		[ previews.length ]
	);

	const retest = useCallback( () => test( selector ), [ test, selector ]);

	return {
		iframeRef,
		matchCount,
		previews,
		previewIndex,
		stepPreview,
		warning,
		error,
		isTesting,
		retest
	};
};

export default useSelectorMatches;
