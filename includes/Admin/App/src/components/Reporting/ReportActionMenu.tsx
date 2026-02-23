import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import Icon from '@/utils/Icon';
import { useReportsStore } from '@/store/reports/useReportsStore';
import { __ } from '@wordpress/i18n';
import { toast } from 'react-toastify';
import {useWizardStore} from '@/store/reports/useWizardStore';
import useLicenseData from '@/hooks/useLicenseData';
import ProBadge from '@/components/Common/ProBadge';

interface ReportActionMenuProps {
	row: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface MenuItem {
	label: string | React.ReactNode;
	action: () => void;
	divider?: boolean;
	danger?: boolean;
	disabled?: boolean;
	hidden?: boolean;
}

export const ReportActionMenu: React.FC<ReportActionMenuProps> = ({ row }) => {
	const [ isOpen, setIsOpen ] = useState<boolean>( false );
	const wizard = useWizardStore( ( state ) => state.wizard );
	const setCurrentStep = useWizardStore( ( state ) => state.setCurrentStep );
	const loadReportIntoWizard = useReportsStore( ( state ) => state.loadReportIntoWizard );
	const deleteReport = useReportsStore( ( state ) => state.deleteReport );
	const duplicateReport = useReportsStore( ( state ) => state.duplicateReport );
	const duplicateAndLoadReportIntoWizard = useReportsStore( ( state ) => state.duplicateAndLoadReportIntoWizard );
	const sendTestEmail = useReportsStore( ( state ) => state.sendTestEmail );
	const sendEmailNow = useReportsStore( ( state ) => state.sendEmailNow );
	const openPreview = useReportsStore( ( state ) => state.openPreview );
	const { isLicenseValidFor } = useLicenseData();
	const premiumReportsEnabled =  isLicenseValidFor( 'reporting' );

	// Build menu items dynamically based on report type.
	const menuItems: MenuItem[] = [
		{
			label: __( 'Edit', 'burst-statistics' ),
			action: () => {
				loadReportIntoWizard( row.id, true );
				setCurrentStep( 4 );
			},

			//if we have a wizard.id, we are already in edit mode, so we hide the edit option.
			hidden: null !== wizard.id
		},
		{
			label: __( 'Duplicate', 'burst-statistics' ),
			action: () => {
				duplicateReport( row.id ).then( ( response ) => {
					if ( ! response ) {
						toast.error( __( 'Failed to duplicate report', 'burst-statistics' ) );
						return;
					} else {
						toast.success( __( 'Report duplicated successfully', 'burst-statistics' ) );
					}
				});
			}
		},
		{
			label: __( 'Duplicate and edit', 'burst-statistics' ),
			action: () => {
				duplicateAndLoadReportIntoWizard( row.id ).then( ( response ) => {
					if ( ! response ) {
						toast.error( __( 'Failed to duplicate report', 'burst-statistics' ) );
						return;
					}
					setCurrentStep( 4 );
				});
			},
			divider: true
		},
		...( row && row.format && 'story' === row.format ? [ {
			label: (
				<span className="flex items-center gap-2">
					{__( 'Open story in a new tab', 'burst-statistics' )}
							{! premiumReportsEnabled && <ProBadge id="reporting" label={__( 'Pro', 'burst-statistics' )} />}
				</span>
			),
			action: () => openPreview( row.id, false ),
			divider: false,
			disabled: ! premiumReportsEnabled
		} ] : []),
		...( row && row.format && 'story' === row.format ? [ {
			label: (
				<span className="flex items-center gap-2">
					{__( 'Download PDF', 'burst-statistics' )}
					{! premiumReportsEnabled && <ProBadge id="reporting" label={__( 'Pro', 'burst-statistics' )} />}
				</span>
			),
			action: () => openPreview( row.id, true ),
			divider: true,
			disabled: ! premiumReportsEnabled
		} ] : []),
		{
			label: __( 'Send now', 'burst-statistics' ),
			action: () => {
				sendEmailNow( row.id ).then( ( response: boolean ) => {
					if ( response ) {
						toast.success(
							__( 'Email sending has been started.', 'burst-statistics' )
						);
					} else {
						toast.error(
							__( 'Failed to start email sending.', 'burst-statistics' )
						);
					}
				});
			}
		},
		{
			label: __( 'Send test email', 'burst-statistics' ),
			action: () => {
				sendTestEmail( row.id ).then( ( response: boolean ) => {
					if ( response ) {
						toast.success(
							__( 'Test email sending has been started.', 'burst-statistics' )
						);
					} else {
						toast.error(
							__( 'Failed to start test email sending.', 'burst-statistics' )
						);
					}
				});
			},
			divider: true
		},
		{
			label: __( 'Delete', 'burst-statistics' ),
			action: () => {
				deleteReport( row.id ).then( ( success ) => {

					// if inside wizard also close the wizard
					if ( useWizardStore.getState().isOpen ) {
						useWizardStore.getState().closeWizard();
					}
					if ( success ) {
						toast.success( __( 'Report deleted successfully', 'burst-statistics' ) );
					} else {
						toast.error( __( 'Failed to delete report', 'burst-statistics' ) );
					}
				});
			},
			danger: true
		}
	];

	const handleItemClick = ( item: MenuItem ) => {
		if ( item.disabled ) {
			return;
		}
		item.action();
		setIsOpen( false );
	};

	return (
		<Popover.Root open={isOpen} onOpenChange={setIsOpen}>
			<Popover.Trigger asChild>
				<button className="bg-gray-100 border border-gray-400 focus:ring-blue-500 rounded-full p-2.5 transition-all duration-200 hover:bg-gray-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2">
					<Icon name="ellipsis" />
				</button>
			</Popover.Trigger>

			<Popover.Content
				className="z-[200] min-w-[200px] rounded-lg border border-gray-200 bg-white shadow-xl"
				align="end"
				sideOffset={8}
			>
				<div className="flex flex-col">
					{
						menuItems.filter( ( item ) => ! item.hidden ).map( ( item, index ) => {
							const isFirst = 0 === index;
							const isLast = index === menuItems.length - 1;

							const radiusClasses = isFirst ?
								'rounded-t-lg' :
								isLast ?
									'rounded-b-lg' :
									'';

							return (
								<React.Fragment key={index}>
									<button
										onClick={
											( event ) => {
												event.preventDefault();
												handleItemClick( item );
											}
										}
										disabled={item.disabled}
										className={`w-full text-left pl-6 pr-8 py-3 text-base transition-colors ${radiusClasses} ${
											item.disabled ?
												'text-gray-400 cursor-not-allowed opacity-50' :
												item.danger ?
													'text-red-600 hover:bg-red-50' :
													'text-gray-900 hover:bg-gray-50'
										}`}
									>
										{item.label}
									</button>

									{item.divider && ! isLast && (
										<div className="border-t border-gray-200 my-1 ml-6 mr-8" />
									)}
								</React.Fragment>
							);
						})
					}
				</div>
			</Popover.Content>
		</Popover.Root>
	);
};
