import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import DataTable, { TableColumn } from 'react-data-table-component';
import { __ } from '@wordpress/i18n';

import FieldWrapper from '@/components/Fields/FieldWrapper';
import EmptyDataTable from '@/components/Statistics/EmptyDataTable';
import {formatDateAndTime, formatUnixToDateTime} from '@/utils/formatting';
import { OverflowTooltip } from '@/components/Common/OverflowTooltip';

import { getReportLogsData } from '@/api/getReportLogsData';
import {
	ReportLogEntry,
	ReportLogBatch,
	ReportLogSeverity,
	ReportLogStatus
} from '@/store/reports/types';
import Icon from '@/utils/Icon';
import { useReportConfigStore } from '@/store/reports/useReportConfigStore';

const getStatusLabel = ( status: ReportLogStatus ) => {
	switch ( status ) {
		case 'sending_successful':
			return __( 'Sent', 'burst-statistics' );
		case 'sending_failed':
			return __( 'Failed', 'burst-statistics' );
		case 'email_domain_error':
			return __( 'Domain Error', 'burst-statistics' );
		case 'email_address_error':
			return __( 'Address Error', 'burst-statistics' );
		case 'cron_miss':
			return __( 'Cron Miss', 'burst-statistics' );
		case 'concept':
			return __( 'Concept', 'burst-statistics' );
		case 'scheduled':
			return __( 'Scheduled', 'burst-statistics' );
		case 'processing':
			return __( 'Processing', 'burst-statistics' );
		case 'partly_sent':
			return __( 'Partly Sent', 'burst-statistics' );
		case 'ready_to_share':
			return __( 'Ready', 'burst-statistics' );
		default:
			return status ? String( status ).split( '_' ).map( s => s.charAt( 0 ).toUpperCase() + s.slice( 1 ) ).join( ' ' ) : '';
	}
};

export const ReportLogsField = ({ field, fieldState, help, context, ...props }: any ) => { // eslint-disable-line @typescript-eslint/no-explicit-any

	const inputId = props.id || field.name;

	const reportLogStatusConfig = useReportConfigStore( ( state ) => state.reportLogStatusConfig );
	const statusSeverityClasses = useReportConfigStore( ( state ) => state.statusSeverityClasses );

	const { data = [], isFetching } = useQuery({
		queryKey: [ 'report-logs' ],
		queryFn: async() => await getReportLogsData(),
		refetchOnMount: 'always'
	});

	const columns: TableColumn<ReportLogEntry>[] = useMemo(
		() => [
			{
				name: __( 'Status', 'burst-statistics' ),
				cell: ( row ) => {
					const severity = reportLogStatusConfig?.[row.status]?.severity ?? 'info';
					return (
						<span
							className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${ statusSeverityClasses[ severity ] }`}
						>
							{ getStatusLabel( row.status ) }
						</span>
					);
				},
				width: '120px',
				grow: 0
			},
			{
				name: __( 'Report', 'burst-statistics' ),
				cell: ( row ) => (
					<OverflowTooltip className="whitespace-nowrap">
						{ row.report_name }
					</OverflowTooltip>
				),
				minWidth: '130px',
				grow: 1
			},
			{
				name: __( 'Date', 'burst-statistics' ),
				cell: ( row ) => (
					<span className="text-text-black whitespace-nowrap">
						{ formatDateAndTime( new Date( row.time * 1000 ) ) }
					</span>
				),
				sortable: true,
				minWidth: '220px',
				grow: 1
			},
			{
				name: __( 'Queue', 'burst-statistics' ),
				cell: ( row ) => (
					<span className="text-text-black whitespace-nowrap">
						{ row.queue_id }
					</span>
				),
				minWidth: '120px',
				grow: 1
			},
			{
				name: __( 'Message', 'burst-statistics' ),
				cell: ( row ) =>
					row.message ? (
						<span className="text-text-black text-sm whitespace-normal py-2 block break-words">
							{ row.message }
						</span>
					) : (
						<span className="text-text-gray">—</span>
					),
				minWidth: '300px',
				grow: 3,
				wrap: true
			}
		],
		[ reportLogStatusConfig, statusSeverityClasses ]
	);

	return (
		<FieldWrapper
			inputId={inputId}
			help={help}
			error={fieldState?.error?.message}
			context={context}
			fullWidthContent={true}
			label=""
			{...props}
		>
			<DataTable
				noDataComponent={
					<EmptyDataTable
						noData={ 0 === data.length }
						isLoading={ isFetching }
						error={null}
						emptyStateMessage={ __( 'No report logs available.', 'burst-statistics' ) }
					/>
				}
				className="burst-data-table no-custom-burst-style report-logs-table"
				pagination
				columns={ columns }
				data={ data }
				sortIcon={
					<Icon
						size={14}
						strokeWidth={1}
						className="ml-1 h-3.5 w-3.5"
						name="arrow-down-up"
					/>
				}
				progressComponent={
					<EmptyDataTable
						noData={ 0 === data.length }
						isLoading={isFetching}
						error={null}
						emptyStateMessage=''
					/>
				}
				expandableRows
				expandableRowsComponent={ ExpandedComponent }
			/>
		</FieldWrapper>
	);
};
const ExpandedComponent = ({ data }: { data: ReportLogEntry }) => {
	const reportLogStatusConfig = useReportConfigStore( ( state ) => state.reportLogStatusConfig );
	const statusSeverityClasses = useReportConfigStore( ( state ) => state.statusSeverityClasses );

	return (
		<div className = "px-6 py-4 bg-gray-50 flex flex-col gap-2">
			<h4 className = "text-sm font-semibold">
				{__( 'Batch details', 'burst-statistics' )}
			</h4>

			<ul className = "flex flex-col gap-1">
				{
					data.batches.map( ( batch: ReportLogBatch ) => {
						const severity: ReportLogSeverity = reportLogStatusConfig[batch.status].severity;

						return (
							<li
								key = {batch.batch_id}
								className = "flex items-start gap-3 text-sm"
							>
								<span
									className = {`px-2 py-0.5 rounded-full text-xs font-medium ${statusSeverityClasses[severity]}`}
								>
									#{batch.batch_id}
								</span>

								<span className = "flex-1">
									{batch.message}
								</span>

								<span className = "text-text-gray whitespace-nowrap">
									{formatUnixToDateTime( batch.time )}
								</span>
							</li>
						);
					})
				}
			</ul>
		</div>
	);
};

ExpandedComponent.displayName = 'ExpandedComponent';

ReportLogsField.displayName = 'ReportLogsField';
