import { useEffect, useRef, useState } from 'react';

/**
 * Defer mounting until the element is (nearly) in the viewport, or until a
 * grace period elapses. Used by Block to prioritize data loading: blocks in
 * view mount — and thus fire their queries — immediately, off-screen blocks
 * follow when scrolled near or after the grace period, so the visible part of
 * the dashboard is never stuck behind requests for blocks nobody sees yet.
 *
 * @param {number} graceMs Delay after which off-screen elements mount anyway.
 * @return {{ref: React.RefObject<HTMLDivElement|null>, mounted: boolean}} Ref to attach and whether to render children.
 */
export const useDeferredMount = ( graceMs = 3000 ) => {
	const ref = useRef<HTMLDivElement | null>( null );
	const [ mounted, setMounted ] = useState( false );

	useEffect( () => {
		if ( mounted ) {
			return;
		}
		const el = ref.current;
		if ( ! el || 'undefined' === typeof IntersectionObserver ) {
			setMounted( true );
			return;
		}
		const observer = new IntersectionObserver(
			( entries ) => {
				if ( entries.some( ( entry ) => entry.isIntersecting ) ) {
					setMounted( true );
				}
			},
			{ rootMargin: '200px' }
		);
		observer.observe( el );
		const timer = window.setTimeout( () => setMounted( true ), graceMs );
		return () => {
			observer.disconnect();
			window.clearTimeout( timer );
		};
	}, [ mounted, graceMs ]);

	return { ref, mounted };
};
