import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { __, sprintf } from '@wordpress/i18n';

import withEmailStyles from './withEmailStyles';
import withAdminStyles from './withAdminStyles';
import { useTheme } from '@/hooks/useTheme';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import Modal from '@/components/Common/Modal';
import HelpTooltip from '@/components/Common/HelpTooltip';
import ButtonInput from '@/components/Inputs/ButtonInput';

const getTemplateDefaultHtml = () => {
	const footerText = sprintf(

		/* translators: %s: domain name */
		__( 'This e-mail is sent from your own WordPress website, which is: %s.<br />If you don\'t want to receive these e-mails in your inbox, please go to the Burst settings page on your website and remove your email from the recipients in the report settings or contact the administrator of your website.', 'burst-statistics' ),
		'{domain}'
	);

	return `
	<h2>${ __( 'Find out more', 'burst-statistics' ) }</h2>
		<p>${ __( 'Dive deeper into your analytics and uncover new opportunities for {domain}.', 'burst-statistics' ) }</p>
		<div style="margin-top: 24px;">
			<a href="#" class="burst-button" style="display: inline-block; border-radius: 4px; padding: 16px 24px; font-size: 16px; font-weight: 600; line-height: 1; color: #ffffff; text-decoration: none;">
				${ __( 'Explore insights', 'burst-statistics' ) }
			</a>
		</div>
		<div role="separator" style="background-color: #a6a6a8; height: 1px; line-height: 1px; margin: 32px 0;">&zwj;</div>

		<p style="margin: 0; font-style: italic; line-height: 18px;">
			${ footerText }
		</p>
`;
};

const getTemplate2Html = () => `
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

const TINYMCE_MODAL_STYLE_ID = 'burst-tinymce-modal-styles';
const TINYMCE_LIGHT_OVERRIDE_STYLE_ID = 'burst-tinymce-light-override';

/**
 * When the admin chooses light mode but the OS prefers dark, the
 * `@media (prefers-color-scheme: dark)` rules in email.css still fire inside
 * the TinyMCE iframe. We inject a <style> that resets those rules whenever
 * the admin is in light mode, and remove it in dark mode.
 *
 * email.css cannot carry these overrides itself because it is also inlined
 * into actual sent emails where we must honour the recipient's OS preference.
 */
const TINYMCE_LIGHT_OVERRIDE_CSS = `
	@media (prefers-color-scheme: dark) {
		body, .email-body {
			background-color: #f0f0f1 !important;
			color: #333 !important;
		}
		.email-wrapper {
			background-color: #f0f0f1 !important;
			color: #333 !important;
		}
		.email-card {
			background-color: transparent !important;
			color: #333 !important;
		}
		h1, h2, h3,
		.email-wrapper h1, .email-wrapper h2, .email-wrapper h3 {
			color: #333 !important;
		}
		p, a { color: #333 !important; }
		.email-message, .email-introduction { color: #696969 !important; }
		.email-muted  { color: #696969 !important; }
		.email-link   { color: #333 !important; }
		.email-divider { background-color: #a6a6a8 !important; }
		.email-logo-light { display: inline !important; }
		.email-logo-dark  { display: none !important; }
	}
`;

const applyIframeLightOverride = ( editor, isDark ) => {
	const doc = editor.getDoc?.();
	if ( ! doc ) {
		return;
	}
	let el = doc.getElementById( TINYMCE_LIGHT_OVERRIDE_STYLE_ID );
	if ( isDark ) {
		if ( el ) {
			el.remove();
		}
		return;
	}
	if ( ! el ) {
		el = doc.createElement( 'style' );
		el.id = TINYMCE_LIGHT_OVERRIDE_STYLE_ID;
		doc.head.appendChild( el );
	}
	el.textContent = TINYMCE_LIGHT_OVERRIDE_CSS;
};

/**
 * The TinyMCE iframe (editable area) and TinyMCE's native `.mce-window` dialogs
 * (used by the wplink plugin, etc.) both render outside `#burst-statistics`,
 * so they cannot inherit the theme-scoped CSS custom properties. We resolve the
 * values once from the burst scope and inject them as literals.
 */
const readThemeColors = () => {
	const scope = document.getElementById( 'burst-statistics' ) || document.body;
	const styles = window.getComputedStyle( scope );
	const v = ( name ) => styles.getPropertyValue( name ).trim();
	return {
		surface: v( '--color-white' ),
		surfaceMuted: v( '--color-gray-100' ),
		surfaceSubtle: v( '--color-gray-200' ),
		border: v( '--color-border' ),
		text: v( '--color-text-black' ),
		primary: v( '--color-primary-500' )
	};
};

const buildTinymceModalCss = ( themeColors ) => `
	.mce-window.mce-in { background-color: ${ themeColors.surface } !important; }
	.mce-window .mce-window-head {
		background-color: ${ themeColors.surfaceMuted } !important;
		border-bottom-color: ${ themeColors.border } !important;
	}
	.mce-window .mce-title,
	.mce-window .mce-close { color: ${ themeColors.text } !important; }
	.mce-window textarea.mce-textbox {
		background-color: ${ themeColors.surfaceMuted } !important;
		color: ${ themeColors.text } !important;
		border-color: ${ themeColors.border } !important;
	}
	.mce-window .mce-foot {
		background-color: ${ themeColors.surface } !important;
		border-top-color: ${ themeColors.border } !important;
	}
	.mce-window .mce-btn button {
		background-color: ${ themeColors.surfaceSubtle } !important;
		color: ${ themeColors.text } !important;
		border-color: ${ themeColors.border } !important;
	}
	.mce-window .mce-btn.mce-primary button {
		background-color: ${ themeColors.primary } !important;
		color: ${ themeColors.surface } !important;
		border-color: ${ themeColors.primary } !important;
	}
`;

const WysiwygField = ({
	field,
	fieldState,
	label,
	help,
	context,
	className,
	setting,
	contentCss,
	contentStyle,
	emailMode = false,
	disabled,
	...props
}) => {
	const generatedId = useId();
	const inputId = ( field?.name ?? generatedId ).replace( /[^\w-]/g, '' );

	const { isDarkTheme } = useTheme();
	const isDisabled = disabled;

	// Persist field reference across renders; init callback needs current value but can't add field to deps
	const fieldRef = useRef( field );
	useEffect( () => {
		fieldRef.current = field;
	}, [ field ]);

	// Access editor instance from callbacks without reinitializing on every change
	const editorRef = useRef( null );

	// Distinguish internal changes (from editor) from external ones (prop updates) to prevent sync loops
	const isInternalChangeRef = useRef( false );

	// Mark the next field.value change as originating from the editor, so the
	// external-sync effect skips re-setting content that the editor just produced.
	const emitChange = useCallback( ( value ) => {
		isInternalChangeRef.current = true;
		fieldRef.current?.onChange?.( value );
	}, []);

	const [ sourceModalOpen, setSourceModalOpen ] = useState( false );
	const [ sourceContent, setSourceContent ] = useState( '' );

	// Inject styles for TinyMCE's native dialogs (`.mce-window`) — rendered at <body>,
	// outside the burst scope, so they can't pick up theme tokens directly. Re-runs
	// on theme toggle so the modal CSS reflects the current computed token values.
	useEffect( () => {
		void isDarkTheme;
		let el = document.getElementById( TINYMCE_MODAL_STYLE_ID );
		if ( ! el ) {
			el = document.createElement( 'style' );
			el.id = TINYMCE_MODAL_STYLE_ID;
			document.head.appendChild( el );
		}
		el.innerHTML = buildTinymceModalCss( readThemeColors() );
	}, [ isDarkTheme ]);

	useEffect( () => {
		const initEditor = () => {
			if ( ! window.wp?.editor ) {
				return;
			}

			if ( window.tinymce?.get( inputId ) ) {
				window.wp.editor.remove( inputId );
			}

			const getValidElements = () => {
				const adminElements = [
					'p[style|class]',
					'br',
					'strong,b',
					'em,i',
					'u',
					'ul[style|class],ol[style|class]',
					'li[style|class]',
					'h1[style|class],h2[style|class],h3[style|class]',
					'h4[style|class],h5[style|class],h6[style|class]',
					'span[style|class]',
					'a[href|target|rel|class]',
					'blockquote[style|class]',
					'div[style|class]',
					'img[src|alt|style|class|width|height]',
					'hr[style|class]'
				];
				const emailElements = [
					'p[style|class]',
					'br',
					'strong,b',
					'em,i',
					'u',
					'ul[style|class],ol[style|class]',
					'li[style|class]',
					'h1[style|class],h2[style|class],h3[style|class]',
					'h4[style|class],h5[style|class],h6[style|class]',
					'span[style|class]',
					'a[href|target|rel|class]',
					'blockquote[style|class]',
					'div[style|class|align]',
					'img[src|alt|style|class|width|height|border]',
					'hr[style|class]',
					'table[style|class|border|cellpadding|cellspacing|width|align]',
					'thead[style|class]',
					'tbody[style|class]',
					'tr[style|class]',
					'td[style|class|colspan|rowspan|align|valign|width|height]',
					'th[style|class|colspan|rowspan|align|valign|width|height]',
					'center',
					'font[color|size|face]'
				];
				return emailMode ? emailElements.join( ',' ) : adminElements.join( ',' );
			};

			window.wp.editor.initialize( inputId, {
				tinymce: {
					...({
						valid_elements: getValidElements()
					}),
					wpautop: true,
					branding: false,
					menubar: false,
					statusbar: ! isDisabled,
					resize: ! isDisabled,
					height: 300,
					readonly: isDisabled ? 1 : 0,
					content_css: contentCss,
					content_style: contentStyle,
					plugins: 'lists,paste,wordpress,wplink,link',
					toolbar: isDisabled ? false : '',
					toolbar1: isDisabled ? false : `bold,italic,underline,bullist,numlist,link,formatselect,removeformat,html_source${ 'email_footer' === setting?.id ? ',templates' : '' }`,
					setup: ( editor ) => {
						editorRef.current = editor;

						editor.on( 'init', () => {
							editor.setContent( fieldRef.current?.value || '' );
							const body = editor.getBody();
							if ( isDisabled ) {
								body.classList.add( 'is-disabled' );
							} else {
								body.classList.remove( 'is-disabled' );
							}
						});
						editor.on( 'change blur keyup', () => {
							const content = editor.getContent();
							if ( fieldRef.current?.value !== content ) {
								emitChange( content );
							}
						});

						if ( 'email_footer' === setting?.id ) {
							const applyTemplate = ( html ) => {
								editor.setContent( html );
								emitChange( editor.getContent() );
							};
							editor.addButton( 'templates', {
								type: 'menubutton',
								icon: 'template',
								tooltip: __( 'Templates', 'burst-statistics' ),
								menu: [
									{
										text: __( 'Template 1 (default)', 'burst-statistics' ),
										onclick: () => applyTemplate( getTemplateDefaultHtml() )
									},
									{
										text: __( 'Template 2', 'burst-statistics' ),
										onclick: () => applyTemplate( getTemplate2Html() )
									}
								]
							});
						}

						if ( ! isDisabled ) {
							editor.addButton( 'html_source', {
								title: __( 'Source Code', 'burst-statistics' ),
								text: '<>',
								onclick: () => {
									setSourceContent( editor.getContent({ format: 'raw' }) );
									setSourceModalOpen( true );
								}
							});
						}
					}
				},
				quicktags: false,
				mediaButtons: false
			});
		};

		const timeoutId = setTimeout( initEditor, 50 );

		return () => {
			clearTimeout( timeoutId );
			if ( window.wp?.editor && window.tinymce?.get( inputId ) ) {
				window.wp.editor.remove( inputId );
			}
			editorRef.current = null;
		};
	}, [ contentCss, contentStyle, inputId, isDisabled, setting?.id, emailMode, emitChange ]);

	// Propagate current theme mode to the editor iframe without re-initializing.
	// Only relevant when email.css is loaded — the admin variant encodes theme
	// colours directly in `contentStyle` and has nothing to override here.
	useEffect( () => {
		if ( ! emailMode ) {
			return;
		}
		const editor = window.tinymce?.get( inputId );
		const body = editor?.getBody?.();
		if ( body ) {
			body.classList.toggle( 'burst-dark-mode', isDarkTheme );
			applyIframeLightOverride( editor, isDarkTheme );
		}
	}, [ inputId, isDarkTheme, emailMode ]);

	// Sync external value changes into the editor without re-initializing.
	useEffect( () => {
		if ( isInternalChangeRef.current ) {
			isInternalChangeRef.current = false;
			return;
		}
		const editor = window.tinymce?.get( inputId );
		if ( editor && field?.value !== editor.getContent() ) {
			editor.setContent( field?.value || '' );
		}
	}, [ field?.value, inputId ]);

	const closeSourceModal = useCallback( () => setSourceModalOpen( false ), []);

	const applySource = useCallback( () => {
		editorRef.current?.setContent( sourceContent );
		emitChange( sourceContent );
		setSourceModalOpen( false );
	}, [ sourceContent, emitChange ]);

	return (
		<>
			<FieldWrapper
				label={label}
				help={help}
				error={fieldState?.error?.message}
				context={context}
				className={className}
				inputId={inputId}
				disabled={isDisabled}
				setting={setting}
				{...props}
			>
				{ ! isDisabled && (
					<div className="flex justify-end mb-2">
						<HelpTooltip
							content={
								<div className="flex flex-col gap-1.5 text-xs">
									<p className="font-medium mb-0.5">
										{ __( 'Allowed HTML elements', 'burst-statistics' ) }
									</p>
									{ ( emailMode ?
										[ 'p', 'strong', 'em', 'u', 'h1–h6', 'ul, ol, li', 'a[href]', 'span', 'blockquote', 'div', 'img', 'hr', 'table', 'thead, tbody', 'tr', 'td, th', 'center', 'font' ] :
										[ 'p', 'strong', 'em', 'u', 'h1–h6', 'ul, ol, li', 'a[href]', 'span', 'blockquote', 'div', 'img', 'hr' ]
									).map( tag => (
										<code key={ tag } className="font-mono bg-white/20 px-1 rounded">{ tag }</code>
									) ) }
								</div>
							}
							side="left"
							delayDuration={ 200 }
						>
							<button
								type="button"
								className="text-xs text-text-gray-light hover:text-text-gray flex items-center gap-1 cursor-help"
							>
								<span>HTML</span>
								<span className="rounded-full border border-current w-3.5 h-3.5 flex items-center justify-center text-[9px] leading-none">?</span>
							</button>
						</HelpTooltip>
					</div>
				) }

				<div
					className={clsx(
						'burst-wysiwyg-wrapper overflow-auto rounded-md border border-gray-400 transition-colors',
						'focus-within:border-primary-700 focus-within:ring-3 focus-within:ring-primary-700/20',
						isDisabled ? 'bg-gray-200 cursor-not-allowed' : 'bg-white cursor-text'
					)}
				>
					<textarea
						id={inputId}
						defaultValue={field?.value || ''}
						className="hidden"
					/>
				</div>
			</FieldWrapper>

			<Modal
				isOpen={sourceModalOpen}
				onClose={closeSourceModal}
				title={__( 'Source Code', 'burst-statistics' )}
				content={
					<textarea
						className="w-full h-96 rounded-md border border-gray-300 bg-gray-100 p-3 font-mono text-sm text-text-black resize-y focus:outline-hidden focus:border-primary-700 focus:ring-3 focus:ring-primary-700/20"
						value={sourceContent}
						onChange={( e ) => setSourceContent( e.target.value )}
						onKeyDown={( e ) => e.stopPropagation()}
						spellCheck={false}
					/>
				}
				footer={
					<>
						<ButtonInput btnVariant="tertiary" onClick={closeSourceModal}>
							{__( 'Cancel', 'burst-statistics' )}
						</ButtonInput>

						<ButtonInput btnVariant="primary" onClick={applySource}>
							{__( 'Save', 'burst-statistics' )}
						</ButtonInput>
					</>
				}
			/>
		</>
	);
};

WysiwygField.displayName = 'WysiwygField';

export const AdminWysiwygField = withAdminStyles( WysiwygField );
export const EmailWysiwygField = withEmailStyles( WysiwygField );
