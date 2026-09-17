import { useState, useEffect, useRef } from 'react';

export interface AnchorRect {
	top: number;
	left: number;
	width: number;
	height: number;
	right: number;
	bottom: number;
}

// fallow-ignore-next-line complexity
const isRectEqual = ( prev: AnchorRect | null, next: DOMRect | null ): boolean => {
	if ( ! prev && ! next ) {
		return true;
	}
	if ( ! prev || ! next ) {
		return false;
	}
	return (
		0.5 > Math.abs( prev.top - next.top ) &&
		0.5 > Math.abs( prev.left - next.left ) &&
		0.5 > Math.abs( prev.width - next.width ) &&
		0.5 > Math.abs( prev.height - next.height )
	);
};

export const useAnchorRect = ( anchor?: string ): AnchorRect | null => {
	const [ rect, setRect ] = useState<AnchorRect | null>( null );
	const rectRef = useRef<AnchorRect | null>( null );
	rectRef.current = rect;

	useEffect( () => {
		if ( ! anchor ) {
			if ( rectRef.current ) {
				rectRef.current = null;
				setRect( null );
			}
			return;
		}

		let element: HTMLElement | null = null;
		let resizeObserver: ResizeObserver | null = null;
		let mutationObserver: MutationObserver | null = null;

		// fallow-ignore-next-line complexity
		const measure = () => {
			const el = document.querySelector<HTMLElement>( anchor );
			if ( el ) {
				if ( el !== element ) {
					if ( resizeObserver && element ) {
						resizeObserver.unobserve( element );
					}
					element = el;
					if ( resizeObserver ) {
						resizeObserver.observe( el );
					}
				}
				const r = el.getBoundingClientRect();
				if ( 0 < r.width && 0 < r.height ) {
					if ( ! isRectEqual( rectRef.current, r ) ) {
						const next: AnchorRect = {
							top: r.top,
							left: r.left,
							width: r.width,
							height: r.height,
							right: r.right,
							bottom: r.bottom
						};
						rectRef.current = next;
						setRect( next );
					}
				} else if ( rectRef.current ) {
					rectRef.current = null;
					setRect( null );
				}
			} else if ( rectRef.current ) {
				rectRef.current = null;
				setRect( null );
			}
		};

		if ( 'undefined' !== typeof ResizeObserver ) {
			resizeObserver = new ResizeObserver( measure );
		}

		window.addEventListener( 'scroll', measure, { passive: true, capture: true });
		window.addEventListener( 'resize', measure, { passive: true });

		measure();

		const t1 = setTimeout( measure, 100 );
		const t2 = setTimeout( measure, 300 );
		const t3 = setTimeout( measure, 600 );

		const container = document.getElementById( 'burst' ) || document.body;
		mutationObserver = new MutationObserver( () => {
			measure();
		});
		mutationObserver.observe( container, { childList: true, subtree: true });

		return () => {
			clearTimeout( t1 );
			clearTimeout( t2 );
			clearTimeout( t3 );
			if ( resizeObserver ) {
				resizeObserver.disconnect();
			}
			if ( mutationObserver ) {
				mutationObserver.disconnect();
			}
			window.removeEventListener( 'scroll', measure, true );
			window.removeEventListener( 'resize', measure );
		};
	}, [ anchor ]);

	return rect;
};
