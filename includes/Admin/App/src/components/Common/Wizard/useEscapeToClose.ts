import { useEffect } from 'react';

/**
 * Close a wizard with Escape, but only while it is enabled: on later steps Escape would throw away progress.
 *
 * @param {boolean}  isEnabled Whether Escape closes the wizard now.
 * @param {Function} onClose   Closes the wizard.
 * @return {void}
 */
const useEscapeToClose = ( isEnabled: boolean, onClose: () => void ): void => {
	useEffect( () => {
		const onKeyDown = ( e: KeyboardEvent ) => {
			if ( 'Escape' === e.key && isEnabled ) {
				onClose();
			}
		};

		window.addEventListener( 'keydown', onKeyDown );
		return () => window.removeEventListener( 'keydown', onKeyDown );
	}, [ isEnabled, onClose ]);
};

export default useEscapeToClose;
