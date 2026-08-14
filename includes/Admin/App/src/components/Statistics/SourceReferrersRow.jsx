import { memo } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getSourceReferrers } from '@/api/getSourceReferrers';
import { safeDecodeURI } from '@/utils/lib';
import useExpandableRowQuery from '@/hooks/useExpandableRowQuery';
import ExpandableRowSkeleton from './ExpandableRowSkeleton';

/**
 * Row used inside react-data-table-component's `expandableRowsComponent`.
 *
 * Lazily fetches the raw referrers for the parent row's Source the
 * first time the row is expanded. Subsequent toggles reuse the cached data.
 *
 * @param {Object} props           Component props.
 * @param {Object} props.data      The parent row data from the referrers datatable.
 * @param {string} props.startDate Active start date for the current view.
 * @param {string} props.endDate   Active end date for the current view.
 * @param {string} props.range     Active date range identifier.
 *
 * @return {JSX.Element} Sub-table of raw referrers for the source row.
 */
// fallow-ignore-next-line complexity
const SourceReferrersRow = ({ data, startDate, endDate, range }) => {
	const source = data?.source || data?.referrer || '';
	const totalVisitors = Number( data?.visitors ?? 0 );

	const { isLoading, error, rows } = useExpandableRowQuery({
		queryKey: [ 'source-referrers', source, startDate, endDate ],
		queryFn: () =>
			getSourceReferrers({
				source,
				startDate,
				endDate,
				range
			}),
		enabled: !! source && !! startDate && !! endDate
	});

	// translators: %d is the total visitors for this traffic source.
	const totalLabel = sprintf(
		__( 'Total: %d visitors', 'burst-statistics' ),
		totalVisitors
	);

	return (
		<div className="border-b border-gray-100 bg-gray-50 px-6 py-4 @max-xl:px-2.5">
			<div className="mb-3 flex items-baseline gap-2 text-sm">
				<span className="font-semibold text-text-black">
					{safeDecodeURI( source )}
				</span>
				<span className="text-text-gray text-xs">({totalLabel})</span>
			</div>

			{isLoading && <ExpandableRowSkeleton />}

			{! isLoading && error && (
				<div className="pl-6 text-sm text-red-500">
					{__(
						'Could not load raw referrers details.',
						'burst-statistics'
					)}
				</div>
			)}

			{! isLoading && ! error && 0 === rows.length && (
				<div className="pl-6 text-sm text-text-gray">
					{__(
						'No raw referrers recorded for this source.',
						'burst-statistics'
					)}
				</div>
			)}

			{! isLoading && ! error && 0 < rows.length && (
				<ul className="m-0 list-none space-y-2 p-0 pl-4">
				{rows.map( ( row, index ) => {
						const rawReferrer = row?.referrer || __( 'Direct / unknown', 'burst-statistics' );
						const visitors = Number( row?.visitors ?? 0 );

						// translators: %d is the number of visitors for this raw referrer.
						const visitorsLabel = sprintf(
							__( '%d visitors', 'burst-statistics' ),
							visitors
						);

						return (
							<li
								key={`burst-referrer-${source}-${rawReferrer}-${index}`}
								className="flex items-center justify-between gap-3 text-sm border-b border-gray-100/50 pb-1.5 last:border-0 last:pb-0"
							>
								<div className="flex min-w-0 items-center gap-2 text-text-black">
									<span aria-hidden="true" className="text-text-gray">
										{'\u21B3'}
									</span>
									<span className="truncate font-mono text-xs">
										{rawReferrer}
									</span>
								</div>
								<span className="shrink-0 text-text-gray text-xs">
									{visitorsLabel}
								</span>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
};

export default memo( SourceReferrersRow );
