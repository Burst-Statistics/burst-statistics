import { useCallback, useEffect, useRef, useState } from 'react';
import {
	buildCssSelector,
	describeElement,
	resolveTarget
} from '@/utils/buildCssSelector';

const STYLE_ID = 'burst-picker-style';
const PICKER_STYLE = '* { cursor: crosshair !important; }';
const OUTLINE = '2px solid #2B8133';

// The highlight is an inline style, not a class: a class would end up in the
// classList the selector is generated from.

interface PickerOptions {
	onPick: ( selector: string, label: string ) => void;
	onEscape: () => void;
}

interface Picker {
	attach: ( iframe: HTMLIFrameElement | null ) => void;
	hoveredSelector: string;
	hoveredMatches: number;
}

/**
 * Turn a same origin iframe into an element picker.
 *
 * The listeners are injected into the iframe document from the parent, so the
 * frontend does not need to load anything. Call attach() on every iframe load.
 * @param {PickerOptions} options Callbacks for a picked element and for escape.
 * @return {Picker} The attach callback and what the hovered element resolves to.
 */
const useIframeElementPicker = ({ onPick, onEscape }: PickerOptions ): Picker => {
	const [ hoveredSelector, setHoveredSelector ] = useState( '' );
	const [ hoveredMatches, setHoveredMatches ] = useState( 0 );
	const cleanupRef = useRef<( () => void ) | null>( null );

	const attach = useCallback(
		( iframe: HTMLIFrameElement | null ) => {
			cleanupRef.current?.();
			cleanupRef.current = null;
			setHoveredSelector( '' );
			setHoveredMatches( 0 );

			const doc = iframe?.contentDocument;
			if ( ! doc || ! doc.body ) {
				return;
			}

			const style = doc.createElement( 'style' );
			style.id = STYLE_ID;
			style.textContent = PICKER_STYLE;
			doc.head.appendChild( style );

			let highlighted: HTMLElement | null = null;
			let previousStyle: string | null = null;
			const highlight = ( el: Element | null ) => {
				if ( highlighted ) {
					if ( null === previousStyle ) {
						highlighted.removeAttribute( 'style' );
					} else {
						highlighted.setAttribute( 'style', previousStyle );
					}
				}

				highlighted = el as HTMLElement | null;
				if ( ! highlighted ) {
					previousStyle = null;
					return;
				}

				previousStyle = highlighted.getAttribute( 'style' );
				highlighted.style.setProperty( 'outline', OUTLINE, 'important' );
				highlighted.style.setProperty( 'outline-offset', '-2px', 'important' );
			};

			const onMouseOver = ( event: Event ) => {
				const target = resolveTarget( event.target as Element );
				highlight( target );

				const selector = buildCssSelector( target, doc );
				setHoveredSelector( selector );
				setHoveredMatches( doc.querySelectorAll( selector ).length );
			};

			const onClick = ( event: Event ) => {
				event.preventDefault();
				event.stopPropagation();
				const target = resolveTarget( event.target as Element );
				onPick( buildCssSelector( target, doc ), describeElement( target ) );
			};

			const swallow = ( event: Event ) => {
				event.preventDefault();
				event.stopPropagation();
			};

			const onKeyDown = ( event: KeyboardEvent ) => {
				if ( 'Escape' === event.key ) {
					onEscape();
				}
			};

			doc.addEventListener( 'mouseover', onMouseOver, true );
			doc.addEventListener( 'click', onClick, true );
			doc.addEventListener( 'mousedown', swallow, true );
			doc.addEventListener( 'submit', swallow, true );
			doc.addEventListener( 'keydown', onKeyDown, true );

			cleanupRef.current = () => {
				doc.removeEventListener( 'mouseover', onMouseOver, true );
				doc.removeEventListener( 'click', onClick, true );
				doc.removeEventListener( 'mousedown', swallow, true );
				doc.removeEventListener( 'submit', swallow, true );
				doc.removeEventListener( 'keydown', onKeyDown, true );
				highlight( null );
				style.remove();
			};
		},
		[ onPick, onEscape ]
	);

	useEffect( () => {
		return () => {
			cleanupRef.current?.();
			cleanupRef.current = null;
		};
	}, []);

	return { attach, hoveredSelector, hoveredMatches };
};

export default useIframeElementPicker;
