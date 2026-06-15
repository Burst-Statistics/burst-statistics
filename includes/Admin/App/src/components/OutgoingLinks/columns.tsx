import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import { formatNumber, getChangePercentage, truncateMiddle } from '@/utils/formatting';
import type { BarColumn } from '@/components/DataTable/BarDataTable';
import type { OutgoingLinkRow } from './useOutgoingLinksData';

/**
 * Returns the column definitions for the outgoing links table.
 *
 * @return {BarColumn<OutgoingLinkRow>[]} The column definitions.
 */
export function getOutgoingLinksColumns(): BarColumn<OutgoingLinkRow>[] {
	return [
		{
			key: 'url',
			label: __( 'URL', 'burst-statistics' ),
			align: 'left',
			minWidth: 160,
			cell: ( row ) => {
				let display = row.url;
				try {
					const parsed = new URL( row.url );
					display = parsed.hostname + ( '/' !== parsed.pathname ? parsed.pathname : '' );
				} catch {

					// Fall back to the raw URL if parsing fails.
				}

				return (
					<a
						href={ row.url }
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 text-text-black hover:text-blue-600 transition-colors"
						title={ row.url }
					>
						<span>{ truncateMiddle( display, 30 ) }</span>
						<Icon name="external-link" size={ 11 } color="gray" className="shrink-0" />
					</a>
				);
			}
		},
		{
			key: 'clicks',
			label: __( 'Clicks', 'burst-statistics' ),
			align: 'right',
			minWidth: 64,
			cell: ( row ) => (
				<span className="font-medium text-text-black">
					{ formatNumber( row.clicks ) }
				</span>
			)
		},
		{
			key: 'change',
			label: __( 'Change', 'burst-statistics' ),
			align: 'right',
			minWidth: 96,
			cell: ( row ) => {
				if ( 0 === row.previousClicks ) {
					return (
						<span className="text-text-gray">{ __( 'N/A', 'burst-statistics' ) }</span>
					);
				}

				const { val, status } = getChangePercentage( row.clicks, row.previousClicks );

				return (
					<span className={ 'positive' === status ? 'text-green font-medium min-w-fit whitespace-nowrap' : 'text-red font-medium min-w-fit whitespace-nowrap' }>
						{ val }
					</span>
				);
			}
		}
	];
}
