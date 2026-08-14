import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Persisted store for Sources chart block user preferences.
 *
 * - groupBy:        time-grouping interval shown in the stacked bar chart.
 * - selectedMetric: the traffic metric rendered in the chart bars.
 */
const useSourcesStore = create(
	persist(
		( set ) => ({
			groupBy: 'auto',
			selectedMetric: 'visitors',
			setGroupBy: ( groupBy ) => set({ groupBy }),
			setSelectedMetric: ( selectedMetric ) => set({ selectedMetric })
		}),
		{
			name: 'burst-sources-store'
		}
	)
);

export default useSourcesStore;
