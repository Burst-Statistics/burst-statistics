import { __ } from '@wordpress/i18n';
import React from 'react';

import { useWizardStore } from '@/store/reports/useWizardStore';
import { useReportConfigStore } from '@/store/reports/useReportConfigStore';
import RadioButtonsInput, {RadioOption} from '@/components/Inputs/RadioButtonsInput';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import useLicenseData from '@/hooks/useLicenseData';

export const Formats = () => {
	const formats = useReportConfigStore( ( state ) => state.formats );
	const format = useWizardStore( ( state ) => state.wizard.format );
	const setFormat = useWizardStore( ( state ) => state.setFormat );
	const options: Record<string, RadioOption> = {};
	const { isLicenseValidFor } = useLicenseData();
	const licenseValidFor =  isLicenseValidFor( 'reporting' );
	formats.forEach( ( formatOption ) => {
		options[ formatOption.key ] = {
			type: formatOption.key,
			label: formatOption.label,
			disabled: formatOption.disabled && ! licenseValidFor,
			pro: formatOption.pro && ! licenseValidFor
		};
	});

	const onFormatChange = ( key: 'classic' | 'story' ) => {
		if ( key === format ) {
			return;
		}

		setFormat( key );
	};

	return (
		<FieldWrapper
		label={__( 'Choose the report format', 'burst-statistics' )}
		inputId="report-format"
		help={__( 'The classic format will be sent as an email. This does not allow much customization and is best suited for a quick regular update on your websites performance. The story format will create an shareable page on this website. This allows for more customization and allows you to create a fully custom report that can be shared with your team or clients. This report can also be downloaded as a PDF file.', 'burst-statistics' )}
		context={__( 'A classic report will be sent by the email. A story report will create a report on this website, which you can choose to share with your team or clients.', 'burst-statistics' ) }
		>
			<RadioButtonsInput inputId="report-format" options={options} value={format} onChange={( value ) => onFormatChange( value as 'classic' | 'story' )} />
		</FieldWrapper>
	);
};
