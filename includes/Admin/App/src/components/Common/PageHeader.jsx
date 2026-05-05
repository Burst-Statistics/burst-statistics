import { PageFilter } from '../Filters/PageFilter';
import DateRange from '../Statistics/DateRange';
import { ShareButton } from './ShareButton';
import ErrorBoundary from './ErrorBoundary';

/**
 * PageHeader component encapsulates the filter, date range, and share button layout.
 * Used across statistics, sources, and sales routes.
 *
 * @return {JSX.Element} PageHeader component.
 */
export const PageHeader = () => {
	return (
		<div className="col-span-12 flex justify-between items-center flex-wrap gap-y-2">
			<ErrorBoundary>
				<PageFilter />
			</ErrorBoundary>

			<div className="flex items-center gap-2">
				<ErrorBoundary>
					<DateRange />
				</ErrorBoundary>

				<ErrorBoundary>
					<ShareButton />
				</ErrorBoundary>
			</div>
		</div>
	);
};

