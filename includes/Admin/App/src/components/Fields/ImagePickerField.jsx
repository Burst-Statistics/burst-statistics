import React, { useRef } from 'react';
import { __ } from '@wordpress/i18n';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import Icon from '@/utils/Icon';
import ButtonInput from '@/components/Inputs/ButtonInput';
import {useAttachmentUrl} from '@/hooks/useAttachmentUrl';
import useSettingsData from '@/hooks/useSettingsData';

/**
 * ImagePickerField component
 *
 * Generic image picker that opens the WordPress media library. Used for any
 * field that stores a single attachment ID (e.g. report logo, hero background).
 *
 * Media frame title and button label are configurable per field via
 * `setting.media_title` and `setting.media_button` in the PHP field config.
 * Both fall back to generic strings when not provided.
 *
 * @param {Object} field      - Provided by react-hook-form's Controller.
 * @param {Object} fieldState - Contains validation state.
 * @param {string} label      - Field label, also used as the preview image alt text.
 * @param {string} help       - Help text for the field.
 * @param {string} className  - Additional Tailwind CSS classes.
 * @param {Object} props      - Additional props including `setting` from the PHP field config.
 * @return {JSX.Element}
 */
const ImagePickerField =
	({ field, fieldState, label, help, className, ...props }) => {

		const { data, isLoading } = useAttachmentUrl( field.value, props.setting?.default_image );
		const colorOverlayCfg = props.setting?.color_overlay;
		const { getValue } = useSettingsData();
		const brandColor = colorOverlayCfg ? getValue( colorOverlayCfg.color ) : null;
		const colorOverlayEnabled = colorOverlayCfg ? getValue( colorOverlayCfg.enabled ) : false;
		const attachmentUrl = data?.attachmentUrl;

		// wp.media frames are expensive to create — reuse across opens.
		const frameRef = useRef( null );

		// Allow per-field overrides from PHP config; fall back to generic strings.
		const mediaTitle = props.setting?.media_title ?? __( 'Select an image', 'burst-statistics' );
		const mediaButton = props.setting?.media_button ?? __( 'Set image', 'burst-statistics' );

		const runUploader = () => {
			if ( props.disabled ) {
				return;
			}

			// Reuse existing frame to preserve selection state between opens.
			if ( frameRef.current ) {
				frameRef.current.open();
				return;
			}

			const frame = wp.media({
				title: mediaTitle,
				button: { text: mediaButton },
				multiple: false
			});

			frame.on( 'select', () => {
				const selection = frame.state().get( 'selection' ).first();
				const thumbnailId = selection.id;

				const image =
					selection.attributes.sizes.medium ||
					selection.attributes.sizes.thumbnail ||
					selection.attributes.sizes.full;

				if ( image ) {
					field.onChange( thumbnailId );
				}
			});

			frameRef.current = frame;
			frame.open();
		};

		const resetToDefault = () => {
			field.onChange( 0 );
		};

		return (
			<FieldWrapper
				label={label}
				help={help}
				className={className}
				error={fieldState.error}
				pro={props.setting.pro}
				context={props.setting.context}
				recommended={props.recommended}
				disabled={props.disabled}
				{...props}
			>
				<div className="flex flex-col items-start gap-2">
					<div
						className={`inline-flex items-center justify-center bg-gray-100 rounded-md p-4 border-dashed border-2 border-gray-500 cursor-pointer min-w-16 min-h-12 ${props.disabled ? 'opacity-50 disabled pointer-events-none' : ''}`}
						onClick={runUploader}
					>
						{attachmentUrl && ! isLoading ? (
							colorOverlayCfg ? (
								<div className="relative">
									<img
										src={attachmentUrl}
										alt={label}
										className="max-w-72 max-h-48 object-contain grayscale"
									/>
									{ !! brandColor && !! colorOverlayEnabled && (
										<div
											aria-hidden="true"
											className="absolute inset-0 opacity-80 mix-blend-overlay pointer-events-none"
											style={{ backgroundColor: brandColor }}
										/>
									) }
								</div>
							) : (
								<img
									src={attachmentUrl}
									alt={label}
									className="max-w-72 max-h-48 object-contain"
								/>
							)
						) : (
							<Icon name="loading" size={18} />
						)}
					</div>
					<ButtonInput
						btnVariant="tertiary"
						size="sm"
						onClick={resetToDefault}
						disabled={
							props.disabled ||
							0 === field.value ||
							'0' === field.value
						}
					>
						{__( 'Reset to Default', 'burst-statistics' )}
					</ButtonInput>
				</div>
			</FieldWrapper>
		);
	};

ImagePickerField.displayName = 'ImagePickerField';

export default ImagePickerField;
