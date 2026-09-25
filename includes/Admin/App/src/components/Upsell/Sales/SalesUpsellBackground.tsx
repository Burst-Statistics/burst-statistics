import { useLayoutEffect } from 'react';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import { PageFilter } from '@/components/Filters/PageFilter';
import DateRange from '@/components/Statistics/DateRange';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import Sales from '@/components/Sales/Sales';
import TopPerformers from '@/components/Sales/TopPerformers';
import QuickWins from '@/components/Sales/QuickWins';
import GhostFunnelChart from '@/components/Upsell/Sales/GhostFunnelChart';
import { useTourStore } from '@/store/useTourStore';

const SalesUpsellBackground = () => {
	const setMockDataActive = useTourStore( ( state ) => state.setMockDataActive );

	// Layout effects run before any passive effect, so the mock flag is set
	// before the child React Query subscriptions fire their first fetch.
	useLayoutEffect( () => {
		setMockDataActive( true );
		return () => {
			setMockDataActive( false );
		};
	}, [ setMockDataActive ]);

	return (
		<>
			<div className="col-span-12 flex items-center justify-between">
				<ErrorBoundary>
					<PageFilter/>
				</ErrorBoundary>

				<ErrorBoundary>
					<DateRange />
				</ErrorBoundary>
			</div>

			<ErrorBoundary>
				<GhostFunnelChart />
			</ErrorBoundary>

			<ErrorBoundary>
				<Sales />
			</ErrorBoundary>

			<ErrorBoundary>
				<TopPerformers />
			</ErrorBoundary>

			<ErrorBoundary>
				<QuickWins />
			</ErrorBoundary>

			{/* Mock-only id: served by the tour mock layer, never by the server, so it can't collide with the real pages table in the query cache. */}
			<ErrorBoundary>
				<DataTableBlock allowedConfigs={[ 'pages' ]} id="upsell_pages" isEcommerce={false} />
			</ErrorBoundary>
		</>
	);
};

export default SalesUpsellBackground;
