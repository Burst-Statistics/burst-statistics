/**
 * Local storage helpers with safe SSR checks and JSON serialization.
 */

export const getLocalStorage = <T = unknown>( key: string, defaultValue: T ): T => {
	if ( 'undefined' !== typeof Storage ) {
		const storedValue = localStorage.getItem( 'burst_' + key );
		if ( storedValue && 0 < storedValue.length ) {
			try {
				return JSON.parse( storedValue ) as T;
			} catch {
				return defaultValue;
			}
		}
	}
	return defaultValue;
};

export const setLocalStorage = ( key: string, value: unknown ): void => {
	if ( 'undefined' !== typeof Storage ) {
		try {
			localStorage.setItem( 'burst_' + key, JSON.stringify( value ) );
		} catch {

			// ignore storage quota errors
		}
	}
};

export const removeLocalStorage = ( key: string ): void => {
	if ( 'undefined' !== typeof Storage ) {
		localStorage.removeItem( 'burst_' + key );
	}
};
