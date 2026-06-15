import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { __, sprintf } from '@wordpress/i18n';
import { getPageParameters } from '@/api/getPageParameters';
import { safeDecodeURI } from '@/utils/lib';

/**
 * Row used inside react-data-table-component's `expandableRowsComponent`.
 *
 * Lazily fetches the parameter variations for the parent row's page URL the
 * first time the row is expanded. Subsequent toggles reuse the cached data.
 *
 * @param {Object} props           Component props.
 * @param {Object} props.data      The parent row data from the pages datatable.
 * @param {string} props.startDate Active start date for the current view.
 * @param {string} props.endDate   Active end date for the current view.
 * @param {string} props.range     Active date range identifier.
 *
 * @return {JSX.Element} Sub-table of parameter variations for the page row.
 */
const ParameterVariationsRow = ({ data, startDate, endDate, range }) => {
	const pageUrl = data?.page_url || '';
	const totalPageviews = Number( data?.pageviews ?? 0 );

	const query = useQuery({
		queryKey: [ 'page-parameters', pageUrl, startDate, endDate ],
		queryFn: () =>
			getPageParameters({
				pageUrl,
				startDate,
				endDate,
				range
			}),
		enabled: !! pageUrl && !! startDate && !! endDate,

		// Variations rarely change for an already-loaded date range.
		staleTime: 1000 * 60 * 5
	});

	const isLoading = query.isLoading || query.isFetching;
	const error = query.error;
	const rows = query.data?.data || [];

	const totalLabel = sprintf(

		// translators: %d is the total pageviews for this page URL.
		__( 'Total: %d views', 'burst-statistics' ),
		totalPageviews
	);

	return (
		<div className="border-b border-gray-100 bg-gray-50 px-6 py-3 @max-xl:px-2.5">
			<div className="mb-2 flex items-baseline gap-2 text-sm">
				<span className="font-medium text-text-black">
					{safeDecodeURI( pageUrl )}
				</span>
				<span className="text-text-gray">({totalLabel})</span>
			</div>

			{isLoading && (
				<div className="space-y-1.5 py-1" aria-busy="true">
					{[ 0, 1, 2 ].map( ( i ) => (
						<div
							key={`burst-param-skeleton-${i}`}
							className="flex items-center gap-3 pl-6"
						>
							<div
								className="h-3 flex-1 max-w-[280px] animate-pulseSlow rounded bg-gray-200"
								style={{ animationDelay: `${i * 100}ms` }}
							/>
							<div
								className="h-3 w-16 animate-pulseSlow rounded bg-gray-200"
								style={{ animationDelay: `${i * 100}ms` }}
							/>
						</div>
					) )}
				</div>
			)}

			{! isLoading && error && (
				<div className="pl-6 text-sm text-red-500">
					{__(
						'Could not load parameter variations.',
						'burst-statistics'
					)}
				</div>
			)}

			{! isLoading && ! error && 0 === rows.length && (
				<div className="pl-6 text-sm text-text-gray">
					{__(
						'No parameter variations recorded for this page.',
						'burst-statistics'
					)}
				</div>
			)}

			{! isLoading && ! error && 0 < rows.length && (
				<ul className="m-0 list-none space-y-1 p-0">
					{rows.map( ( row, index ) => {
						const variation = row?.parameter || '';
						const views = Number( row?.pageviews ?? 0 );
						const viewsLabel = sprintf(

							// translators: %d is the number of pageviews for this parameter variation.
							__( '%d views', 'burst-statistics' ),
							views
						);

						return (
							<li
								key={`burst-param-${pageUrl}-${variation}-${index}`}
								className="flex items-center justify-between gap-3 text-sm"
							>
								<span className="flex min-w-0 items-center gap-1.5 text-text-black">
									<span
										aria-hidden="true"
										className="text-text-gray"
									>
										{'\u21B3'}
									</span>
									<span className="truncate">
										{'?' + variation}
									</span>
								</span>
								<span className="shrink-0 text-text-gray">
									({viewsLabel})
								</span>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
};

export default memo( ParameterVariationsRow );
