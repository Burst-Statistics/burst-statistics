import React from 'react';
import { __ } from '@wordpress/i18n';
import { useWizardStore } from '@/store/reports/useWizardStore';
import { useReportConfigStore } from '@/store/reports/useReportConfigStore';
import {ContentBlockId} from '@/store/reports/types';
import {ReportStoryUrl} from '@/components/Reporting/ReportWizard/ReportStoryUrl';

export const Overview = () => {
	const id = useWizardStore( ( state ) => state.wizard.id );
	const scheduled = useWizardStore( ( state ) => state.wizard.scheduled );
	const format = useWizardStore( ( state ) => state.wizard.format );
	const frequency = useWizardStore( ( state ) => state.wizard.frequency );
	const dayOfWeek = useWizardStore( ( state ) => state.wizard.dayOfWeek );
	const weekOfMonth = useWizardStore( ( state ) => state.wizard.weekOfMonth );
	const sendTime = useWizardStore( ( state ) => state.wizard.sendTime );
	const emails = useWizardStore( ( state ) => state.wizard.recipients );
	const content = useWizardStore( ( state ) => state.wizard.content );
	const getScheduleLabel = useReportConfigStore( ( state ) => state.getScheduleLabel );
	const availableContent = useReportConfigStore( ( state ) => state.availableContent );

	const getDeliveryText = () => {
		if ( scheduled ) {
			return __( 'Scheduled email, sent automatically', 'burst-statistics' );
		}

		return __( 'Manual download', 'burst-statistics' );
	};

	const getLabel = ( blockId: ContentBlockId ) => {
		const blockConfig = availableContent.find( item => item.id === blockId );
		if ( blockConfig ) {
			return blockConfig.label;
		}
	};
	return (
		<div className="mt-8 grid grid-cols-[auto_1fr] gap-4 text-md burst-reporting-wizard-gutter">
			{
				scheduled && (
					<>
						<div className="text-gray-600 font-medium">
							{__( 'Delivers:', 'burst-statistics' )}
						</div>

					<div className="text-black font-medium">{getDeliveryText()}</div>

					<div className="text-gray-600 font-medium">
						{__( 'Scheduled:', 'burst-statistics' )}
					</div>

						<div className="text-black font-medium">{getScheduleLabel( scheduled, frequency, dayOfWeek, weekOfMonth, sendTime )}</div>
					</>
				)
			}

			<div className="text-gray-600 font-medium">
				{__( 'Recipients:', 'burst-statistics' )}
			</div>

			<div className="text-black font-medium">
				{
					0 < emails.length ? (
						<ul className="list-disc list-inside">
							{
								emails.map( ( email, index ) => (
									<li key={index} className="text-md m-0">
										{email}
									</li>
								) )
							}
						</ul>
					) : (
						<span className="text-md">{__( 'No recipients added', 'burst-statistics' )}</span>
					)
				}
			</div>

			<div className="text-gray-600 font-medium">
				{__( 'Content:', 'burst-statistics' )}
			</div>

			<div className="text-black font-medium">
				{
					0 < content.length ? (
						<ul className="list-disc list-inside">
							{
								content.map( ( block, index ) => (
									<li key={index} className="text-md m-0">
										{
											getLabel( block.id )
										}
									</li>
								) )
							}
						</ul>
					) : (
						<span className="text-md">{__( 'No content selected', 'burst-statistics' )}</span>
					)
				}
			</div>

			{
				id ? (
					<>
						{'story' === format && <>
							<div className="text-gray-600 font-medium">
								{__( 'Story URL:', 'burst-statistics' )}
							</div>
							<div className="flex gap-2.5">
								<ReportStoryUrl reportId={id}/>
							</div>
						</>}
					</>
				) : null
			}
		</div>
	);
};
