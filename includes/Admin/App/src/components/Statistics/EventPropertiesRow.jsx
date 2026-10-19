import { memo } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getEventProperties } from '@/api/getEventProperties';
import useExpandableRowQuery from '@/hooks/useExpandableRowQuery';
import useFilters from '@/hooks/useFilters';
import ExpandableRowSkeleton from './ExpandableRowSkeleton';

/**
 * Row used inside react-data-table-component's `expandableRowsComponent`.
 *
 * Lazily fetches the property breakdown for the parent row's event name the
 * first time the row is expanded. Subsequent toggles reuse the cached data.
 *
 * @param {Object} props           Component props.
 * @param {Object} props.data      The parent row data from the events datatable.
 * @param {string} props.startDate Active start date for the current view.
 * @param {string} props.endDate   Active end date for the current view.
 * @param {string} props.range     Active date range identifier.
 *
 * @return {JSX.Element} Sub-table of property variations for the event row.
 */
// fallow-ignore-next-line complexity
const EventPropertiesRow = ({ data, startDate, endDate, range }) => {
	const eventName = data?.name || '';
	const totalCount = Number( data?.count ?? 0 );
	const { getActiveFilters } = useFilters();
	const filters = getActiveFilters();

	const { isLoading, error, rows } = useExpandableRowQuery({
		queryKey: [ 'event-properties', eventName, startDate, endDate, filters ],
		queryFn: () =>
			getEventProperties({
				eventName,
				startDate,
				endDate,
				range,
				filters
			}),
		enabled: !! eventName && !! startDate && !! endDate
	});

	const totalLabel = sprintf(

		// translators: %d is the total occurrences for this event.
		__( 'Total: %d occurrences', 'burst-statistics' ),
		totalCount
	);

	return (
		<div className="border-b border-gray-100 bg-gray-50 px-6 py-3 @max-xl:px-2.5">
			<div className="mb-2 flex items-baseline gap-2 text-sm">
				<span className="font-medium text-text-black">
					{eventName}
				</span>
				<span className="text-text-gray">({totalLabel})</span>
			</div>

			{isLoading && <ExpandableRowSkeleton />}

			{! isLoading && error && (
				<div className="pl-6 text-sm text-red-500">
					{__(
						'Could not load event properties.',
						'burst-statistics'
					)}
				</div>
			)}

			{! isLoading && ! error && 0 === rows.length && (
				<div className="pl-6 text-sm text-text-gray">
					{__(
						'No properties recorded for this event.',
						'burst-statistics'
					)}
				</div>
			)}

			{! isLoading && ! error && 0 < rows.length && (
				<ul className="m-0 list-none space-y-1 p-0">
					{

						// fallow-ignore-next-line complexity
						rows.map( ( row, index ) => {
						const propKey = row?.prop_key || '';
						const value = row?.value || '';
						const count = Number( row?.count ?? 0 );
						const countLabel = sprintf(

							// translators: %d is the number of occurrences for this property value.
							__( '%d occurrences', 'burst-statistics' ),
							count
						);

						return (
							<li
								key={`burst-event-prop-${eventName}-${propKey}-${value}-${index}`}
								className="flex items-center justify-between gap-3 text-sm"
							>
								<span className="flex min-w-0 items-center gap-1.5 text-text-black">
									<span
										aria-hidden="true"
										className="text-text-gray"
									>
										{'↳'}
									</span>
									<span className="truncate">
										{propKey}: {value}
									</span>
								</span>
								<span className="shrink-0 text-text-gray">
									({countLabel})
								</span>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
};

export default memo( EventPropertiesRow );
