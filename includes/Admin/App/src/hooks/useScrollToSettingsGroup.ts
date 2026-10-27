import { useEffect } from 'react';
import { useSearch } from '@tanstack/react-router';

// Stop following the group once the layout has not changed for this long.
const SETTLED_AFTER_MS = 1000;

// Never follow the group for longer than this.
const MAX_FOLLOW_MS = 5000;

// Input that means the user scrolls the page themselves.
const USER_SCROLL_EVENTS = [ 'wheel', 'touchmove', 'keydown', 'mousedown' ] as const;

/**
 * Scroll to the settings group named in the `group` search param, so a link
 * such as `#/settings/general?group=anonymous_usage_data` lands on that group
 * instead of the top of the page.
 *
 * The fields render their content after the first paint, which grows the page
 * above the group and would push it back out of view. So the hook scrolls to
 * the group again on every size change of the page, until the layout has
 * settled or the user scrolls themselves.
 *
 * @param groupIds The ids of the groups rendered on the current settings page.
 * @return void. Side effect: scrolls the window when the group is on the page.
 */
const useScrollToSettingsGroup = ( groupIds: string[]): void => {
	const { group } = useSearch({ strict: false }) as { group?: string };
	const isGroupOnPage = !! group && groupIds.includes( group );

	useEffect( () => {
		if ( ! isGroupOnPage ) {
			return;
		}

		const target = document.getElementById( `burst-settings-group-${ group }` );
		if ( ! target ) {
			return;
		}

		const scrollToGroup = (): void => target.scrollIntoView({ behavior: 'smooth', block: 'start' });

		let settledTimer: ReturnType<typeof setTimeout> | undefined;
		const observer = new ResizeObserver( () => {
			scrollToGroup();
			clearTimeout( settledTimer );
			settledTimer = setTimeout( stopFollowing, SETTLED_AFTER_MS );
		});
		const maxTimer = setTimeout( stopFollowing, MAX_FOLLOW_MS );

		function stopFollowing(): void {
			observer.disconnect();
			clearTimeout( settledTimer );
			clearTimeout( maxTimer );
			USER_SCROLL_EVENTS.forEach( ( type ) => window.removeEventListener( type, stopFollowing ) );
		}

		USER_SCROLL_EVENTS.forEach( ( type ) => window.addEventListener( type, stopFollowing, { passive: true }) );

		// The app root grows with the fields; body does not, wp-admin gives it a fixed height.
		// Observing fires once right away, which does the first scroll.
		observer.observe( target.closest( '#burst-statistics' ) ?? target.parentElement ?? target );

		return stopFollowing;
	}, [ group, isGroupOnPage ]);
};

export default useScrollToSettingsGroup;
