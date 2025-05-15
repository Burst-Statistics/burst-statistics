import { useCallback } from '@wordpress/element';
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
 * @param {number} delay - The amount of time (in milliseconds) the function should wait
 *                         before the last call to execute the callback.
 * @param {Array} deps - The dependencies array which, if changed, will recreate the debounced function.
 *
 * @returns {Function} A debounced version of the callback function.
 */
function useDebouncedCallback( callback, delay, deps = []) {

  // The useCallback hook returns a memoized version of the callback that only changes
  // if one of the dependencies has changed. We're using it here to memoize the debounced
  // version of the provided callback function.
  const debouncedCallback = useCallback(
      debounce( ( ...args ) => callback( ...args ), delay ),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [ delay, ...deps ]
  );

  return debouncedCallback;
}

export default useDebouncedCallback;
