import { PageFilter } from '../Filters/PageFilter';
import DateRange from '../Statistics/DateRange';
import { ShareButton } from './ShareButton';
import ErrorBoundary from './ErrorBoundary';

/**
 * PageHeader component encapsulates the filter, date range, and share button layout.
 * Used across statistics, sources, sales, and subscriptions routes.
 *
 * @param {Object} props - Component props.
 * @param {boolean} [props.showFilter=true] - Whether to display filter controls.
 * @return {JSX.Element} PageHeader component.
 */
export const PageHeader = ({ showFilter = true }) => {
	return (
		<div className="col-span-12 flex justify-between items-center flex-wrap gap-y-2">
			{showFilter ? (
				<ErrorBoundary>
					<PageFilter />
				</ErrorBoundary>
			) : (
				<div />
			)}

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

