import React, { forwardRef, useMemo } from 'react';
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
	ReportLogBatch, ReportLogSeverity
} from '@/store/reports/types';
import Icon from '@/utils/Icon';
import { useReportConfigStore } from '@/store/reports/useReportConfigStore';

export const ReportLogsField = forwardRef<any, any>( // eslint-disable-line @typescript-eslint/no-explicit-any
	({ field, fieldState, help, context, ...props }) => {

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
								className={`px-2 py-1 rounded-full text-xs font-medium ${ statusSeverityClasses[ severity ] }`}
							>
								{ row.message }
							</span>
						);
					},
					grow: 0
				},
				{
					name: __( 'Report', 'burst-statistics' ),
					cell: ( row ) => (
						<OverflowTooltip>
							{ row.report_name }
						</OverflowTooltip>
					),
					grow: 1
				},
				{
					name: __( 'Date', 'burst-statistics' ),
					cell: ( row ) => formatDateAndTime( new Date( row.time * 1000 ) ),
					sortable: true,
					grow: 2
				},
				{
					name: __( 'Queue', 'burst-statistics' ),
					cell: ( row ) => (
						<OverflowTooltip className="text-right">
							{ row.queue_id }
						</OverflowTooltip>
					),
					right: true,
					grow: 1
				},

				{
					name: __( 'Message', 'burst-statistics' ),
					cell: ( row ) =>
						row.message ? (
							<OverflowTooltip className="text-right">
								{ row.message }
							</OverflowTooltip>
						) : (
							<span className="text-gray text-right">—</span>
						),
					right: true,
					grow: 1
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
					className="burst-data-table no-custom-burst-style"
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
					customStyles={{
						headCells: {
							style: {
								fontWeight: '600',
								fontSize: '12px',
								color: '#1c252c',
								padding: 0
							}
						},
						cells: {
							style: {
								padding: 0
							}
						},
						headRow: {
							style: {
								paddingLeft: '0 !important',
								paddingRight: '0 !important',
								gap: '12px',
								fontSize: '12px'
							}
						},
						rows: {
							style: {
								paddingLeft: '0 !important',
								paddingRight: '0 !important',
								gap: '12px',
								fontSize: '12px'
							}
						}
					}}
				/>
			</FieldWrapper>
		);
	}
);

const ExpandedComponent = ({ data }: { data: ReportLogEntry }) => {
	const reportLogStatusConfig = useReportConfigStore( ( state ) => state.reportLogStatusConfig );
	const statusSeverityClasses = useReportConfigStore( ( state ) => state.statusSeverityClasses );

	return (
		<div className = "px-6 py-4 bg-gray-50 space-y-2">
			<h4 className = "text-sm font-semibold">
				{__( 'Batch details', 'burst-statistics' )}
			</h4>

			<ul className = "space-y-1">
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

								<span className = "text-gray whitespace-nowrap">
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
