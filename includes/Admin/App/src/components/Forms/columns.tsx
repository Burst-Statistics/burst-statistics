import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import { formatNumber, getChangePercentage, truncateMiddle } from '@/utils/formatting';
import type { BarColumn } from '@/components/DataTable/BarDataTable';
import type { FormRow } from './useFormsData';

/**
 * Returns the column definitions for the forms table.
 *
 * Columns: Form (title + provider badge), Submissions (count with bar),
 * Conversion rate (% with period-over-period coloring).
 *
 * @return {BarColumn<FormRow>[]} The column definitions.
 */
export function getFormsColumns(): BarColumn<FormRow>[] {
	return [
		{
			key: 'formTitle',
			label: __( 'Form', 'burst-statistics' ),
			align: 'left',
			minWidth: 160,
			cell: ( row ) => {
				const titleContent = row.submissionsUrl ? (
					<a
						href={ row.submissionsUrl }
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 text-text-black hover:text-blue-600 transition-colors font-medium min-w-0"
						title={ row.formTitle }
					>
						<span className="truncate">{ truncateMiddle( row.formTitle, 30 ) }</span>
						<Icon name="external-link" size={ 11 } color="gray" className="shrink-0" />
					</a>
				) : (
					<span
						className="block truncate font-medium text-text-black"
						title={ row.formTitle }
					>
						{ truncateMiddle( row.formTitle, 30 ) }
					</span>
				);

				return (
					<span className="flex flex-col min-w-0">
						{ titleContent }
						{ row.formProviderLabel && (
							<span className="text-xs text-text-gray truncate">
								{ row.formProviderLabel }
							</span>
						) }
					</span>
				);
			}
		},
		{
			key: 'submissions',
			label: __( 'Submissions', 'burst-statistics' ),
			align: 'right',
			minWidth: 90,
			cell: ( row ) => (
				<span className="font-medium text-text-black">
					{ formatNumber( row.submissions ) }
				</span>
			)
		},
		{
			key: 'conversionRate',
			label: __( 'Conv. rate', 'burst-statistics' ),
			align: 'right',
			minWidth: 88,
			cell: ( row ) => {
				if ( 0 === row.submissions ) {
					return (
						<span className="text-text-gray">{ __( 'N/A', 'burst-statistics' ) }</span>
					);
				}

				const rate = `${ row.conversionRate }%`;

				// Show change indicator only when we have a previous period to compare to.
				if ( 0 === row.previousConversionRate ) {
					return (
						<span className="font-medium text-text-black">{ rate }</span>
					);
				}

				const { status } = getChangePercentage( row.conversionRate, row.previousConversionRate );

				return (
					<span className={ 'positive' === status ? 'text-green font-medium' : 'text-red font-medium' }>
						{ rate }
					</span>
				);
			}
		}
	];
}
