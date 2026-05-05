import ErrorBoundary from '@/components/Common/ErrorBoundary';
import { PageFilter } from '@/components/Filters/PageFilter';
import DateRange from '@/components/Statistics/DateRange';
import GhostWorldMapBlock from '@/components/Upsell/GhostWorldMapBlock';
import DataTableBlock from '@/components/Statistics/DataTableBlock';

const SourcesUpsellBackground = () => {
	return (
		<>
			<div className="col-span-12 flex items-center justify-between">
				<ErrorBoundary>
					<PageFilter />
				</ErrorBoundary>
				<ErrorBoundary>
					<DateRange />
				</ErrorBoundary>
			</div>
			<ErrorBoundary>
				<GhostWorldMapBlock />
			</ErrorBoundary>
			<ErrorBoundary>
				<DataTableBlock allowedConfigs={[ 'pages' ]} id="99" isEcommerce={false} />
			</ErrorBoundary>
			<ErrorBoundary>
				<DataTableBlock allowedConfigs={[ 'pages' ]} id="100" isEcommerce={false} />
			</ErrorBoundary>
			<ErrorBoundary>
				<DataTableBlock allowedConfigs={[ 'pages' ]} id="101" isEcommerce={false} />
			</ErrorBoundary>
		</>
	);
};

export default SourcesUpsellBackground;
