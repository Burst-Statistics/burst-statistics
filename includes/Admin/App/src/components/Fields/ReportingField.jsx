import React, { forwardRef, useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import ButtonInput from '@/components/Inputs/ButtonInput';
import DataTable from 'react-data-table-component';
import Icon from '@/utils/Icon';
import SwitchInput from '@/components/Inputs/SwitchInput';
import Tooltip from '@/components/Common/Tooltip';

import { useReportsStore } from '@/store/reports/useReportsStore';
import { useWizardStore } from '@/store/reports/useWizardStore';
import { useReportConfigStore } from '@/store/reports/useReportConfigStore';
import { ReportWizard } from '@/components/Reporting/ReportWizard';
import { ReportActionMenu } from '@/components/Reporting/ReportActionMenu';
import { AnimatePresence } from 'framer-motion';
import { formatDateAndTime } from '@/utils/formatting';
import { OverflowTooltip } from '@/components/Common/OverflowTooltip';
import { useQuery } from '@tanstack/react-query';
import { getReportsData } from '@/api/getReportsData';
import EmptyDataTable from '@/components/Statistics/EmptyDataTable';

const ReportingField = forwardRef( ({ field, fieldState, help, context, ...props }) => {
	const inputId = props.id || field.name;

	const { data, isFetching } = useQuery({
		queryKey: [ 'reports' ],
		queryFn: async() => await getReportsData(),
		refetchOnMount: 'always'
	});

	const reports = useReportsStore( ( state ) => state.reports );
	const setReports = useReportsStore( ( state ) => state.setReports );
	const toggleReportActive = useReportsStore( ( state ) => state.toggleReportActive );
	const loadReportIntoWizard = useReportsStore( ( state ) => state.loadReportIntoWizard );

	const setCurrentStep = useWizardStore( ( state ) => state.setCurrentStep );

	const isAddingReport = useWizardStore( ( state ) => state.isOpen );

	const formats = useReportConfigStore( ( state ) => state.formats );
	const getScheduleLabel = useReportConfigStore( ( state ) => state.getScheduleLabel );
	const reportLogStatusConfig = useReportConfigStore( ( state ) => state.reportLogStatusConfig );
	const statusSeverityClasses = useReportConfigStore( ( state ) => state.statusSeverityClasses );

	const handleAddReport = () => {
		useWizardStore.getState().resetWizard();
		useWizardStore.getState().openWizard();
	};

	const handleEditReport = ( reportId ) => {
		loadReportIntoWizard( reportId, true );
		setCurrentStep( 4 );
	};

	const getSeverity = ( status ) => {
		if ( ! status ) {
			console.warn( 'No lastSendStatus found' );
			return 'info';
		}

		if ( ! reportLogStatusConfig || ! reportLogStatusConfig[status]) {
			console.warn( `Unknown status: ${status}` );
			return 'info';
		}

		const config = reportLogStatusConfig[status];
		if ( ! config.severity ) {
			console.warn( `Severity not found for status: ${status}` );
			return 'info';
		}

		return reportLogStatusConfig[status].severity;
	};

	useEffect( () => {
		if ( data ) {
			setReports( data );
		}
	}, [ data, setReports ]);

	const columns = [
		{
			name: __( 'Report name', 'burst-statistics' ),
			selector: ( row ) => row.name,
			cell: ( row ) => (
				<button
					type="button"
					onClick={ () => handleEditReport( row.id ) }
					className=""
				>
					<OverflowTooltip className="text-left text-blue hover:text-blue-dark hover:underline font-semibold transition-colors cursor-pointer">
						{ row.name }
					</OverflowTooltip>
				</button>
			),
			sortable: true,
			minWidth: '150px',
			maxWidth: '200px',
			grow: 0
		},
		{
			name: __( 'Last status', 'burst-statistics' ),
			cell: ( row ) => {
				const severity = getSeverity( row.lastSendStatus );

				return (
					<span className={`px-2 py-1 rounded-full text-xs font-medium ${ statusSeverityClasses[ severity ] }`}>
						{ row.lastSendMessage }
					</span>
				);
			},
			sortable: true,
			minWidth: '60px',
			maxWidth: '200px'
		},
		{
			name: __( 'Format', 'burst-statistics' ),
			cell: ( row ) => {
				const formatObj = formats.find( ( f ) => f.key === row.format );
				return (
					<span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-light text-blue">
						{formatObj?.label ?? row.format}
					</span>
				);
			},
			sortable: true,
			minWidth: '60px',
			maxWidth: '70px'
		},
		{
			name: __( 'Schedule', 'burst-statistics' ),
			sortable: true,
			grow: 2,
			cell: ( row ) => {
				return (
					<OverflowTooltip>
						{ getScheduleLabel( row.scheduled, row.frequency, row.dayOfWeek, row.weekOfMonth ) }
					</OverflowTooltip>
				);
			}
		},
		{
			name: __( 'Last edit', 'burst-statistics' ),
			grow: 2,
			cell: ( row ) => (
				<OverflowTooltip>
					{ row.lastEdit ? formatDateAndTime( new Date( row.lastEdit * 1000 ) ) : __( 'N/A', 'burst-statistics' ) }
				</OverflowTooltip>
			)
		},
		{
			name: '',
			right: true,
			grow: 0,
			width: '52px',
			cell: ( row ) => {

				// Only show toggle if report has scheduling and recipients.
				const hasSchedule = row.scheduled;
				const hasRecipients = row.recipients && 0 < row.recipients.length;

				if ( ! hasSchedule || ! hasRecipients ) {
					return null;
				}

				return (
					<Tooltip content={row.enabled ?
						__( 'This report is active and will be sent on schedule. Toggle to pause.', 'burst-statistics' ) :
						__( 'This report is paused. Toggle to activate and resume scheduled sending.', 'burst-statistics' )
					}>
						<div>
							<SwitchInput
								onChange={() => toggleReportActive( row.id )}
								checked={row.enabled}
							/>
						</div>
					</Tooltip>
				);
			}
		},
		{
			name: '',
			right: true,
			grow: 0,
			width: '52px',
			cell: ( row ) => (
				<ReportActionMenu row={ row } />
			)
		}
	];

	return (
		<>
			<FieldWrapper
				help={help}
				error={fieldState?.error?.message}
				context={context}
				inputId={inputId}
				fullWidthContent={true}
				recommended={props.recommended}
				disabled={props.disabled}
				{...props}
				label=""
			>
				<div className="w-full lg:w-4/6 space-y-4">
					<p className="px-6 text-base text-black">
						{__( 'Share Burst Insights with your team on a schedule that works for them. All reports are generated locally on your site and sent directly to your chosen emails.', 'burst-statistics' )}
					</p>
				</div>

				<div className="px-6 w-full space-y-4 flex flex-col mt-4">
					<ButtonInput onClick={() => handleAddReport()} className="mt-2 w-fit self-end" type="button">
						{__( 'New report', 'burst-statistics' )}
					</ButtonInput>

					{
						isFetching ? (
							<p className="text-center text-gray">{__( 'Loading reports...', 'burst-statistics' )}</p>
						) : (
							<DataTable
								noDataComponent={
									<EmptyDataTable
										noData={ 0 === reports.length }
										data={[]}
										isLoading={isFetching}
										emptyStateMessage={ __( 'There are no reports available.', 'burst-statistics' ) }
									/>
								}
								className="burst-data-table no-custom-burst-style"
								pagination
								columns={columns}
								data={reports}
								sortIcon={ <Icon size={14} strokeWidth={1} className="ml-1 h-3.5 w-3.5" name="arrow-down-up" /> }
								progressComponent={
									<EmptyDataTable
										noData={ 0 === reports.length }
										data={[]}
										isLoading={isFetching}
									/>
								}
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
											gap: '18px',
											fontSize: '12px'
										}
									},
									rows: {
										style: {
											paddingLeft: '0 !important',
											paddingRight: '0 !important',
											gap: '18px',
											fontSize: '12px'
										}
									}
								}}
							/>
						)
					}
				</div>
			</FieldWrapper>

			<AnimatePresence>
				{
					isAddingReport && <ReportWizard />
				}
			</AnimatePresence>
		</>
	);
});

ReportingField.displayName = 'ReportingField';

export default ReportingField;
