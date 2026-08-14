import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SalesChartMode = 'revenue' | 'sales';

interface SalesChartState {
	chartMode: SalesChartMode;
	showComparison: boolean;
	showForecast: boolean;
	setChartMode: ( chartMode: string ) => void;
	toggleComparison: () => void;
	toggleForecast: () => void;
}

const DEFAULT_CHART_MODE: SalesChartMode = 'revenue';

const normalizeChartMode = ( chartMode: string ): SalesChartMode => {
	return 'sales' === chartMode ? 'sales' : DEFAULT_CHART_MODE;
};

/**
 * Zustand store for the Sales tab sales-over-time chart.
 * Persists the chart mode and the comparison/forecast toggles to localStorage
 * so the user's view is remembered across sessions.
 */
export const useSalesChartStore = create<SalesChartState>()(
	persist(
		( set ) => ({
			chartMode: DEFAULT_CHART_MODE,
			showComparison: false,
			showForecast: false,
			setChartMode: ( chartMode ) => {
				set({ chartMode: normalizeChartMode( chartMode ) });
			},
			toggleComparison: () => {
				set( ( state ) => ({ showComparison: ! state.showComparison }) );
			},
			toggleForecast: () => {
				set( ( state ) => ({ showForecast: ! state.showForecast }) );
			}
		}),
		{
			name: 'burst-sales-chart-storage',
			partialize: ( state ) => ({
				chartMode: state.chartMode,
				showComparison: state.showComparison,
				showForecast: state.showForecast
			})
		}
	)
);
