import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PageWeightState {
	showCo2: boolean;
	showRating: boolean;
	assumeGreenHosting: boolean;
	toggleCo2: () => void;
	toggleRating: () => void;
	toggleAssumeGreenHosting: () => void;
}

/**
 * Zustand store for the Page weight block's display toggles, persisted to
 * localStorage so the reader's view is remembered across sessions.
 *
 * The green hosting preview lives here too. The server sends the green
 * figures alongside the real ones, so switching between them is a display
 * choice like the others: it makes no request, stores nothing site-wide, and
 * never changes the numbers another reader sees.
 */
export const usePageWeightStore = create<PageWeightState>()(
	persist(
		( set ) => ({
			showCo2: true,
			showRating: false,
			assumeGreenHosting: false,
			toggleCo2: () => {
				set( ( state ) => ({ showCo2: ! state.showCo2 }) );
			},
			toggleRating: () => {
				set( ( state ) => ({ showRating: ! state.showRating }) );
			},
			toggleAssumeGreenHosting: () => {
				set( ( state ) => ({ assumeGreenHosting: ! state.assumeGreenHosting }) );
			}
		}),
		{
			name: 'burst-page-weight-storage',
			partialize: ( state ) => ({
				showCo2: state.showCo2,
				showRating: state.showRating,
				assumeGreenHosting: state.assumeGreenHosting
			})
		}
	)
);
