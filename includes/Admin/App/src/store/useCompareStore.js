import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Valid comparison mode values.
 *
 * @type {Record<string, string>}
 */
export const COMPARE_MODES = {
	PREVIOUS_PERIOD: 'previous_period',
	YEAR_OVER_YEAR: 'year_over_year'
};

/**
 * Zustand store for the active comparison period mode.
 * Persisted to localStorage so the user's preference is remembered across sessions.
 */
export const useCompareStore = create(
	persist(
		( set ) => ({
			compareMode: COMPARE_MODES.PREVIOUS_PERIOD,

			/**
			 * Set the active comparison mode.
			 *
			 * @param {string} mode - One of COMPARE_MODES values.
			 */
			setCompareMode: ( mode ) => {
				if ( Object.values( COMPARE_MODES ).includes( mode ) ) {
					set({ compareMode: mode });
				}
			}
		}),
		{
			name: 'burst-compare-storage',
			partialize: ( state ) => ({
				compareMode: state.compareMode
			})
		}
	)
);
