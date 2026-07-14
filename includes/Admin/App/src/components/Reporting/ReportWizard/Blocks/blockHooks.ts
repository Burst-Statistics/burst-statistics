import { useMemo } from 'react';
import { useWizardStore } from '@/store/reports/useWizardStore';
import useSettingsData from '@/hooks/useSettingsData';
import { useDarkAwareAttachmentUrl } from '@/hooks/useAttachmentUrl';

const getPluginAssetUrl = ( relativePath: string ): string => {
	return ( window as any ).burst_settings.plugin_url + relativePath; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export const useReportBlockEditor = ({
	reportBlockIndex,
	fieldName,
	toFieldValue = ( value: string ) => value,
	fromFieldValue = ( value: string ) => value
}: {
	reportBlockIndex: number;
	fieldName: string;
	toFieldValue?: ( value: string ) => string;
	fromFieldValue?: ( value: string ) => string;
}) => {
	const isEditingMode = useWizardStore( ( state ) => state.isEditingMode );
	const content = useWizardStore( ( state ) => state.wizard.content[ reportBlockIndex ]?.content ?? '' );
	const updateComment = useWizardStore( ( state ) => state.updateComment );

	const field = useMemo( () => ({
		value: toFieldValue( content ),
		onChange: ( value: string ) => updateComment( reportBlockIndex, fromFieldValue( value ) ),
		name: `${ fieldName }_${ reportBlockIndex }`
	}), [ content, reportBlockIndex, updateComment, fieldName, toFieldValue, fromFieldValue ]);

	return {
		isEditingMode,
		content,
		updateComment,
		field
	};
};

export const useReportLogo = ( isDarkTheme: boolean ) => {
	const { getValue } = useSettingsData();
	const logoId = getValue( 'logo_attachment_id' );
	const logoIdDark = getValue( 'logo_attachment_id_dark' );
	const darkLogoDefaultUrl = getPluginAssetUrl( 'assets/img/burst-email-logo-dark.png' );
	const logoQuery = useDarkAwareAttachmentUrl( logoId, logoIdDark, isDarkTheme, undefined, darkLogoDefaultUrl );

	return {
		logoUrl: logoQuery.data?.attachmentUrl ?? '',
		isLoadingLogo: logoQuery.isLoading
	};
};

export const getReportAssetUrl = getPluginAssetUrl;
