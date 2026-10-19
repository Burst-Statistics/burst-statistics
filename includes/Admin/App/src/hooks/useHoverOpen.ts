import { useEffect, useRef, useState } from 'react';

type UseHoverOpenReturn = {
	isOpen: boolean;
	setIsOpen: ( open: boolean ) => void;

	/** Open now and cancel a pending close. */
	open: () => void;

	/** Close after the delay, unless open() is called first. */
	scheduleClose: () => void;
};

/**
 * Open state for a popover that follows hover and focus. The close is delayed so
 * the pointer can travel from the trigger into the popover without it closing.
 *
 * @param {number} closeDelayMs Delay before closing, in milliseconds.
 * @return {UseHoverOpenReturn} Open state and the handlers to attach.
 */
export function useHoverOpen( closeDelayMs = 150 ): UseHoverOpenReturn {
	const [ isOpen, setIsOpen ] = useState( false );
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>( null );

	const cancelClose = () => {
		if ( closeTimer.current ) {
			clearTimeout( closeTimer.current );
			closeTimer.current = null;
		}
	};

	useEffect( () => cancelClose, []);

	const open = () => {
		cancelClose();
		setIsOpen( true );
	};

	const scheduleClose = () => {
		cancelClose();
		closeTimer.current = setTimeout( () => setIsOpen( false ), closeDelayMs );
	};

	return { isOpen, setIsOpen, open, scheduleClose };
}
