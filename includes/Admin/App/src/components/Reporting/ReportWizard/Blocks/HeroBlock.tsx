import React, { useEffect, useMemo, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { useWizardStore } from '@/store/reports/useWizardStore';
import { useTheme } from '@/hooks/useTheme';
import { AdminWysiwygField } from '@/components/Fields/Wysiwyg/WysiwygField';
import WysiwygPreview from '@/components/Common/WysiwygPreview';
import { BlockComponentProps } from '@/store/reports/types';
import useSettingsData from '@/hooks/useSettingsData';
import { useDarkAwareAttachmentUrl } from '@/hooks/useAttachmentUrl';
import { darkOverlayStyle } from '@/utils/overlayStyle';

const HERO_BLOCK_SETTING = { id: 'hero' };

const LABEL_STYLE = 'margin:0 0 2px;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;';

const DEFAULT_HERO_TEMPLATE = [
	`<p style="${ LABEL_STYLE }">${ __( 'Created by', 'burst-statistics' ) }</p>`,
	'<p style="margin:0 0 14px;font-size:13px;">{created_by}</p>',
	`<p style="${ LABEL_STYLE }">${ __( 'Created on', 'burst-statistics' ) }</p>`,
	'<p style="margin:0;font-size:13px;">{created_at}</p>'
].join( '' );


const HeroBlock: React.FC<BlockComponentProps> = ({ reportBlockIndex = 0 }) => {
	const isEditingMode = useWizardStore( ( state ) => state.isEditingMode );
	const content = useWizardStore( ( state ) => state.wizard.content[ reportBlockIndex ]?.content ?? '' );
	const updateComment = useWizardStore( ( state ) => state.updateComment );
	const { isDarkTheme } = useTheme();
	const { getValue } = useSettingsData();

	const logoId = getValue( 'logo_attachment_id' );
	const logoIdDark = getValue( 'logo_attachment_id_dark' );
	const rawBgImageId = getValue( 'hero_background_image_attachment_id' );
	const rawBgImageIdDark = getValue( 'hero_background_image_attachment_id_dark' );
	const brandColor: string = getValue( 'brand_color' );
	const colorOverlayEnabled: boolean = getValue( 'hero_color_overlay_enabled' );

	const heroBgDefaultUrl = ( window as any ).burst_settings.plugin_url + 'assets/img/burst-report-hero-bg.jpg'; // eslint-disable-line @typescript-eslint/no-explicit-any
	const heroBgDarkDefaultUrl = ( window as any ).burst_settings.plugin_url + 'assets/img/burst-report-hero-dark-bg.png'; // eslint-disable-line @typescript-eslint/no-explicit-any
	const darkLogoDefaultUrl = ( window as any ).burst_settings.plugin_url + 'assets/img/burst-email-logo-dark.png'; // eslint-disable-line @typescript-eslint/no-explicit-any
	const logoQuery = useDarkAwareAttachmentUrl( logoId, logoIdDark, isDarkTheme, undefined, darkLogoDefaultUrl );
	const bgImageQuery = useDarkAwareAttachmentUrl( rawBgImageId ?? 0, rawBgImageIdDark ?? 0, isDarkTheme, heroBgDefaultUrl, heroBgDarkDefaultUrl );
	const logoUrl = logoQuery.data?.attachmentUrl ?? '';
	const bgImageUrl = bgImageQuery.data?.attachmentUrl ?? '';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const [ displayName, setDisplayName ] = useState<string>( () => ( window as any ).wp?.data?.select( 'core' )?.getCurrentUser()?.name ?? '' );

	useEffect( () => {
		if ( displayName ) {
			return;
		}

		apiFetch<{ name: string }>({ path: '/wp/v2/users/me' })
			.then( ( user ) => setDisplayName( user?.name ?? '' ) )
			.catch( () => {});
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	const dateStr = new Intl.DateTimeFormat( 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format( new Date() );

	// Strip full burst wrapper, keeping only the raw shortcode.
	const stripBurstComments = ( html: string ) => html
		.replace( /<!-- burst:\w+ -->[\s\S]*?(\{[^}]+\})<!-- \/burst:\w+ -->/g, '$1' );

	// Wrap each shortcode: <!-- burst:name -->value{shortcode}<!-- /burst:name -->
	const injectValues = ( html: string ) => {
		const clean = stripBurstComments( html );
		return clean
			.replace( /\{created_by\}/g, `<!-- burst:created_by -->${displayName}{created_by}<!-- /burst:created_by -->` )
			.replace( /\{created_at\}/g, `<!-- burst:created_at -->${dateStr}{created_at}<!-- /burst:created_at -->` );
	};

	// Editor sees raw shortcodes — strip comments and values.
	const stripValues = ( html: string ) => stripBurstComments( html );

	// Preview/story: extract value from between opening comment and shortcode.
	const resolveFromComments = ( html: string ) => html
		.replace( /<!-- burst:(\w+) -->([\s\S]*?)\{[^}]+\}<!-- \/burst:\1 -->/g, '$2' );

	// Seed default template once when hero block is first added (empty content, editing mode).
	// Wait for displayName so the resolved value is stored immediately.
	const didSeedTemplate = useRef( false );
	useEffect( () => {
		if ( didSeedTemplate.current || ! isEditingMode || content || ! displayName ) {
			return;
		}

		didSeedTemplate.current = true;
		updateComment( reportBlockIndex, injectValues( DEFAULT_HERO_TEMPLATE ) );
	}, [ isEditingMode, content, reportBlockIndex, updateComment, displayName ]); // eslint-disable-line react-hooks/exhaustive-deps

	const field = useMemo( () => ({
		value: stripValues( content ),
		onChange: ( value: string ) => updateComment( reportBlockIndex, injectValues( value ) ),
		name: `hero_${ reportBlockIndex }`
	}), [ content, reportBlockIndex, updateComment, displayName ]); // eslint-disable-line react-hooks/exhaustive-deps

	const previewContent = resolveFromComments( content || injectValues( DEFAULT_HERO_TEMPLATE ) );

	const leftColClass = bgImageUrl ? '@md:col-span-7' : '@md:col-span-12';

	return (
		<div className="w-full bg-white mb-16 burst-story-content-width">
			<div className="grid grid-cols-1 @md:grid-cols-12 gap-x-16 overflow-hidden">
				<div className={ `${ leftColClass } py-6 @md:py-8 @lg:py-10` }>
				<div className='flex flex-col gap-4'>
					{
						logoUrl && (
							<div className='flex-shrink-0 mb-12 mt-8'>
								<img alt="logo" src={ logoUrl } className="max-w-36 max-h-36 w-auto h-auto" />
							</div>
						)
					}

					<div className='flex-1'>
						{ isEditingMode ? (
							<AdminWysiwygField
								field={ field }
								fieldState={ {} }
								setting={ HERO_BLOCK_SETTING }
								label={ undefined }
								help={ undefined }
								context={ undefined }
								className="w-full p-0"
								fullWidthContent={ true }
							/>
						) : (
							<WysiwygPreview html={ previewContent } isDark={ isDarkTheme } />
						) }
					</div>
				</div>
			</div>

			{
				bgImageUrl && (
					<div className="print:hidden hidden @md:flex @md:col-span-5 items-center overflow-hidden">
						<div className="relative w-full">
							<img
								src={ bgImageUrl }
								alt=""
								className={ `w-full h-auto pointer-events-none ${ isDarkTheme ? '' : 'grayscale' }` }
							/>
							{
								!! brandColor && colorOverlayEnabled && (
									<div
										aria-hidden="true"
										className={ `absolute inset-0 mix-blend-overlay pointer-events-none ${ isDarkTheme ? '' : 'opacity-80' }` }
										style={ isDarkTheme ? darkOverlayStyle( bgImageUrl, brandColor ) : { backgroundColor: brandColor } }
									/>
								)
							}
						</div>
					</div>
				)
			}
			</div>
		</div>
	);
};

HeroBlock.displayName = 'HeroBlock';
export default HeroBlock;
