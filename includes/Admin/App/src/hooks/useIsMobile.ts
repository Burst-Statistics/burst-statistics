import { useEffect, useState } from 'react';

const MOBILE_MEDIA_QUERY = '(max-width: 639px)';

const getMatches = (): boolean => {
	if ( 'undefined' === typeof window || ! window.matchMedia ) {
		return false;
	}

	return window.matchMedia( MOBILE_MEDIA_QUERY ).matches;
};

/**
 * Hook to detect mobile viewports, matching the Tailwind `sm` breakpoint.
 *
 * @return {boolean} True when the viewport is narrower than 640px.
 */
export const useIsMobile = (): boolean => {
	const [ isMobile, setIsMobile ] = useState( getMatches );

	useEffect( () => {
		if ( 'undefined' === typeof window || ! window.matchMedia ) {
			return;
		}

		const mediaQuery = window.matchMedia( MOBILE_MEDIA_QUERY );

		const handleChange = ( event: MediaQueryListEvent ) => {
			setIsMobile( event.matches );
		};

		if ( mediaQuery.addEventListener ) {
			mediaQuery.addEventListener( 'change', handleChange );
			return () => {
				mediaQuery.removeEventListener( 'change', handleChange );
			};
		}

		mediaQuery.addListener( handleChange );
		return () => {
			mediaQuery.removeListener( handleChange );
		};
	}, []);

	return isMobile;
};
