import { useCallback, useEffect, useMemo, useRef } from 'react';
import debounce from 'lodash/debounce';

/**
 * useDebouncedCallback hook
 *
 * This hook uses lodash's debounce method to create a debounced function
 * that will invoke the provided callback only after the specified delay
 * in milliseconds has elapsed since the last time the debounced function
 * was called. It's particularly useful for handling frequent calls to
 * the callback function, like during typing in a search input.
 *
 * @param {Function} callback - The function to debounce.
 * @param {number}   delay    - The amount of time (in milliseconds) the function should wait
 *                            before the last call to execute the callback.
 * @param {Array}    deps     - The dependencies array which, if changed, will recreate the debounced function.
 *
 * @return {Function} A debounced version of the callback function.
 */
function useDebouncedCallback( callback, delay, deps = []) {
	const callbackRef = useRef( callback );
	callbackRef.current = callback;

	// Convert deps to a stable string key.
	// React Compiler allows this because it's not used *as* a dependency array.
	const depsKey = JSON.stringify( deps );

	// Create debounced fn when delay or deps change
	const debounced = useMemo( () => {
		return debounce( ( ...args ) => callbackRef.current( ...args ), delay );
	}, [ delay, depsKey ]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect( () => {
		return () => debounced.cancel();
	}, [ debounced ]);

	// Stable wrapper; debounced handles deps changes internally
	return useCallback(
		( ...args ) => {
			debounced( ...args );
		},
		[ debounced ] // literal → allowed
	);
}

export default useDebouncedCallback;
