/**
 * Radix UI dialogs lock the page while open (body[data-scroll-locked] +
 * inline pointer-events: none, applied by react-remove-scroll). If a dialog
 * crashes or renders invisibly — e.g. the onboarding modal when its
 * stylesheet is missing — that lock survives with nothing visible to
 * dismiss, leaving the whole wp-admin unclickable. This watchdog releases
 * the lock whenever it is active while no dialog or popover is actually
 * visible in the viewport. It is page-global on purpose: it also covers
 * dialogs of the separately bundled onboarding app.
 */

const OVERLAY_SELECTOR =
	'[role="dialog"],[role="alertdialog"],[role="listbox"],[role="menu"],[data-radix-popper-content-wrapper]';
const CHECK_INTERVAL_MS = 2000;

let started = false;

// A hidden/background window can report a zero-size viewport, which would
// make every dialog look "outside the viewport".
const hasViewport = (): boolean =>
	0 < window.innerWidth && 0 < window.innerHeight;

const isLocked = ( body: HTMLElement ): boolean =>
	body.hasAttribute( 'data-scroll-locked' ) ||
	'none' === body.style.pointerEvents;

const isInViewport = ( rect: DOMRect ): boolean =>
	[ rect.width, rect.height, rect.bottom, rect.right ].every(
		( value ) => 0 < value
	) &&
	rect.top < window.innerHeight &&
	rect.left < window.innerWidth;

const isOverlayVisible = ( element: Element ): boolean => {
	const style = window.getComputedStyle( element );
	if ( 'none' === style.display || 'hidden' === style.visibility ) {
		return false;
	}

	return isInViewport( element.getBoundingClientRect() );
};

const anyOverlayVisible = (): boolean =>
	Array.from( document.querySelectorAll( OVERLAY_SELECTOR ) ).some(
		isOverlayVisible
	);

const releaseLock = ( body: HTMLElement ): void => {
	body.style.pointerEvents = '';
	body.removeAttribute( 'data-scroll-locked' );
};

export const startScrollLockWatchdog = (): void => {
	if ( started ) {
		return;
	}
	started = true;

	let strikes = 0;
	setInterval( () => {
		const body = document.body;
		const staleLock =
			hasViewport() && isLocked( body ) && ! anyOverlayVisible();
		if ( ! staleLock ) {
			strikes = 0;
			return;
		}

		// Require two consecutive misses so the lock is never released
		// during the brief window in which a dialog is still mounting.
		strikes++;
		if ( 2 > strikes ) {
			return;
		}

		releaseLock( body );
		strikes = 0;
	}, CHECK_INTERVAL_MS );
};
