import { __ } from '@wordpress/i18n';
import { formatNumber } from '@/utils/formatting';
import type { BarColumn } from '@/components/DataTable/BarDataTable';
import type { EventRow } from './useEventsData';

/**
 * Returns the column definitions for the events table.
 *
 * @return {BarColumn<EventRow>[]} The column definitions.
 */
export function getEventsColumns(): BarColumn<EventRow>[] {
	return [
		{
			key: 'name',
			label: __( 'Event', 'burst-statistics' ),
			align: 'left',
			minWidth: 160,
			cell: ( row ) => (
				<span className="text-text-black">{ row.name }</span>
			)
		},
		{
			key: 'count',
			label: __( 'Count', 'burst-statistics' ),
			align: 'right',
			minWidth: 64,
			cell: ( row ) => (
				<span className="font-medium text-text-black">
					{ formatNumber( row.count ) }
				</span>
			)
		}
	];
}
