import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_CHART_MODE = 'revenue';
const DEFAULT_DISTRIBUTION_VIEW = 'gateways';
const DEFAULT_RETENTION_PRODUCT_ID = 'all';

const normalizeChartMode = ( chartMode ) => {
	return 'sales' === chartMode ? 'sales' : DEFAULT_CHART_MODE;
};

const normalizeDistributionView = ( distributionView ) => {
	if ( 'currencies' === distributionView ) {
		return 'currencies';
	}

	if ( 'countries' === distributionView ) {
		return 'countries';
	}

	return DEFAULT_DISTRIBUTION_VIEW;
};

const normalizeRetentionProductId = ( retentionProductId ) => {
	if ( ! retentionProductId ) {
		return DEFAULT_RETENTION_PRODUCT_ID;
	}

	return String( retentionProductId );
};

export const useSubscriptionsStore = create(
	persist(
		( set ) => ({
			chartMode: DEFAULT_CHART_MODE,
			distributionView: DEFAULT_DISTRIBUTION_VIEW,
			retentionProductId: DEFAULT_RETENTION_PRODUCT_ID,
			setChartMode: ( chartMode ) => {
				set({
					chartMode: normalizeChartMode( chartMode )
				});
			},
			setDistributionView: ( distributionView ) => {
				set({
					distributionView: normalizeDistributionView( distributionView )
				});
			},
			setRetentionProductId: ( retentionProductId ) => {
				set({
					retentionProductId: normalizeRetentionProductId( retentionProductId )
				});
			}
		}),
		{
			name: 'burst-subscriptions-storage',
			partialize: ( state ) => ({
				chartMode: state.chartMode,
				distributionView: state.distributionView,
				retentionProductId: state.retentionProductId
			}),
			onRehydrateStorage: () => ( state ) => {
				if ( state ) {
					state.chartMode = normalizeChartMode( state.chartMode );
					state.distributionView = normalizeDistributionView( state.distributionView );
					state.retentionProductId = normalizeRetentionProductId( state.retentionProductId );
				}
			}
		}
	)
);
