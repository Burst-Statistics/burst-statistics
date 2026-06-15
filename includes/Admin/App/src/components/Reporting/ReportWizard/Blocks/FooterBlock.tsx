import React, { useMemo, useRef, useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import { useWizardStore } from '@/store/reports/useWizardStore';
import { useTheme } from '@/hooks/useTheme';
import { AdminWysiwygField } from '@/components/Fields/Wysiwyg/WysiwygField';
import WysiwygPreview from '@/components/Common/WysiwygPreview';
import { BlockComponentProps } from '@/store/reports/types';
import useSettingsData from '@/hooks/useSettingsData';
import { useDarkAwareAttachmentUrl } from '@/hooks/useAttachmentUrl';

const FOOTER_BLOCK_SETTING = { id: 'email_footer' };

const getDefaultFooterHtml = () => `
	<div>

		<h1 style="font-weight: 700; margin: 0 0 24px 0; letter-spacing: -0.01em;">${ __( 'Our recommendations', 'burst-statistics' ) }</h1>

		<p style="line-height: 1.7; margin: 0 0 32px 0;">
			${ __( 'Write a short introduction about the statistics and what you have accomplished for your client this week or month.', 'burst-statistics' ) }
		</p>

		<p style="font-weight: 600; margin: 0 0 32px 0;">
			${ __( 'If you have questions, please send us an email or give us a call!', 'burst-statistics' ) }
		</p>

		<p style="font-weight: 700; margin: 0 0 4px 0;">${ __( 'Your Name', 'burst-statistics' ) }</p>

		<p style="margin: 0 0 28px 0;">${ __( 'Your Job Title', 'burst-statistics' ) }</p>

		<div style="margin-bottom: 20px;">
			<p style="font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 4px 0;">${ __( 'Email', 'burst-statistics' ) }</p>
			<p style="font-weight: 700; margin: 0;">${ __( 'info@agency.com', 'burst-statistics' ) }</p>
		</div>

		<div style="margin-bottom: 0;">
			<p style="font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 4px 0;">${ __( 'Phone', 'burst-statistics' ) }</p>
			<p style="font-weight: 700; margin: 0;">${ __( '123-456-7890', 'burst-statistics' ) }</p>
		</div>
	</div>
`;

const FooterBlock: React.FC<BlockComponentProps> = ({ reportBlockIndex = 0 }) => {
	const isEditingMode = useWizardStore( ( state ) => state.isEditingMode );
	const content = useWizardStore( ( state ) => state.wizard.content[ reportBlockIndex ]?.content ?? '' );
	const updateComment = useWizardStore( ( state ) => state.updateComment );
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
		updateComment( reportBlockIndex, getDefaultFooterHtml() );
	}, [ isEditingMode, content, reportBlockIndex, updateComment ]); // eslint-disable-line react-hooks/exhaustive-deps

	const field = useMemo( () => ({
		value: content,
		onChange: ( value: string ) => updateComment( reportBlockIndex, value ),
		name: `footer_${ reportBlockIndex }`
	}), [ content, reportBlockIndex, updateComment ]);

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
						<WysiwygPreview html={ content || getDefaultFooterHtml() } isDark={ isDarkTheme } />
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
