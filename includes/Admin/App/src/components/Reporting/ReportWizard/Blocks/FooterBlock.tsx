import React, { useRef, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { AdminWysiwygField } from '@/components/Fields/Wysiwyg/WysiwygField';
import WysiwygPreview from '@/components/Common/WysiwygPreview';
import { BlockComponentProps } from '@/store/reports/types';
import useSettingsData from '@/hooks/useSettingsData';
import { useDarkAwareAttachmentUrl } from '@/hooks/useAttachmentUrl';
import { useReportBlockEditor } from './blockHooks';
import { getRecommendationsFooterHtml } from './reportTemplates';

const FOOTER_BLOCK_SETTING = { id: 'email_footer' };

// fallow-ignore-next-line complexity
const FooterBlock: React.FC<BlockComponentProps> = ({ reportBlockIndex = 0 }) => {
	const { isEditingMode, content, field } = useReportBlockEditor({
		reportBlockIndex,
		fieldName: 'footer'
	});
	const { isDarkTheme } = useTheme();
	const { getValue } = useSettingsData();
	const logoId = getValue( 'logo_attachment_id' );
	const logoIdDark = getValue( 'logo_attachment_id_dark' );
	const darkLogoDefaultUrl = ( window as any ).burst_settings.plugin_url + 'assets/img/burst-email-logo-dark.png'; // eslint-disable-line @typescript-eslint/no-explicit-any
	const logoQuery = useDarkAwareAttachmentUrl( logoId, logoIdDark, isDarkTheme, undefined, darkLogoDefaultUrl );
	const logoUrl = logoQuery.data?.attachmentUrl ?? '';

	const didSeedTemplate = useRef( false );
	useEffect( () => {
		if ( didSeedTemplate.current || ! isEditingMode || content ) {
			return;
		}
		didSeedTemplate.current = true;
		field.onChange( getRecommendationsFooterHtml() );
	}, [ isEditingMode, content, field ]); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<div className="w-full mt-16">
			<div className="w-full bg-white burst-story-content-width">
				<div className="py-6 @md:py-8 @lg:py-10">
					{ isEditingMode ? (
						<AdminWysiwygField
							field={ field }
							fieldState={ {} }
							setting={ FOOTER_BLOCK_SETTING }
							label={ undefined }
							help={ undefined }
							context={ undefined }
							className="w-full p-0"
							fullWidthContent={ true }
						/>
					) : (
						<WysiwygPreview html={ content || getRecommendationsFooterHtml() } isDark={ isDarkTheme } />
					) }

					{
						logoUrl && (
							<img alt="logo" src={ logoUrl } className="h-8 @md:h-10 w-auto mt-16" />
						)
					}
				</div>
			</div>
		</div>
	);
};

FooterBlock.displayName = 'FooterBlock';
export default FooterBlock;
