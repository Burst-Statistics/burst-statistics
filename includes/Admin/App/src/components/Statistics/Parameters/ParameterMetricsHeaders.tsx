import React, { memo } from 'react';
import { __ } from '@wordpress/i18n';
import ParameterSortHeader, { SortDirection } from './ParameterSortHeader';

interface ParameterMetricsHeadersProps {

	/** Current active sort field. */
	activeSortField: string;

	/** Current active sort direction. */
	sortDirection: SortDirection;

	/** Callback invoked when a sortable header is clicked. */
	onSort: ( field: string ) => void;

	/** Label for the share column. Defaults to 'Share of page views'. */
	shareLabel?: string;
}

/**
 * Reusable table headers for views, visitors, and share columns.
 *
 * @param {ParameterMetricsHeadersProps} props Component props.
 * @return {JSX.Element} Fragment containing the three header cells.
 */
const ParameterMetricsHeaders: React.FC<ParameterMetricsHeadersProps> = ({
	activeSortField,
	sortDirection,
	onSort,
	shareLabel = __( 'Share of page views', 'burst-statistics' )
}) => {
	return (
		<>
			<ParameterSortHeader
				field="pageviews"
				label={__( 'Views', 'burst-statistics' )}
				activeSortField={activeSortField}
				sortDirection={sortDirection}
				onSort={onSort}
				align="right"
			/>
			<ParameterSortHeader
				field="visitors"
				label={__( 'Visitors', 'burst-statistics' )}
				activeSortField={activeSortField}
				sortDirection={sortDirection}
				onSort={onSort}
				align="right"
			/>
			<th scope="col" className="py-2.5 pl-3 pr-4 text-right uppercase tracking-wider">
				{shareLabel}
			</th>
		</>
	);
};

export default memo( ParameterMetricsHeaders );
