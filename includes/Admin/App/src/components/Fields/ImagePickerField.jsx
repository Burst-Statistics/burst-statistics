import React, { useRef, useState } from 'react';
import { useController } from 'react-hook-form';
import * as Switch from '@radix-ui/react-switch';
import { __ } from '@wordpress/i18n';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import Icon from '@/utils/Icon';
import ButtonInput from '@/components/Inputs/ButtonInput';
import {useAttachmentUrl} from '@/hooks/useAttachmentUrl';
import useSettingsData from '@/hooks/useSettingsData';
import { darkOverlayStyle } from '@/utils/overlayStyle';

/**
 * ImagePickerControl component
 *
 * Generic image picker that opens the WordPress media library. Used for any
 * field that stores a single attachment ID (e.g. report logo, hero background).
 *
 * Media frame title and button label are configurable per field via
 * `setting.media_title` and `setting.media_button` in the PHP field config.
 * Both fall back to generic strings when not provided.
 *
 * @param {Object} field         - Provided by react-hook-form's Controller.
 * @param {Object} fieldState    - Contains validation state.
 * @param {string} label         - Field label, also used as the preview image alt text.
 * @param {string} help          - Help text for the field.
 * @param {string} className     - Additional Tailwind CSS classes.
 * @param {boolean} isDarkPreview - Whether the dark mode image is being shown/edited.
 * @param {JSX.Element} darkToggle - Optional dark mode toggle rendered at the top right.
 * @param {Object} props         - Additional props including `setting` from the PHP field config.
 * @return {JSX.Element}
 */
const ImagePickerControl =
	({ field, fieldState, label, help, className, isDarkPreview = false, darkToggle = null, ...props }) => {

		const defaultImage = isDarkPreview ?
			props.setting?.default_image_dark ?? props.setting?.default_image :
			props.setting?.default_image;
		const { data, isLoading } = useAttachmentUrl( field.value, defaultImage );
		const colorOverlayCfg = props.setting?.color_overlay;
		const { getValue } = useSettingsData();
		const brandColor = colorOverlayCfg ? getValue( colorOverlayCfg.color ) : null;
		const colorOverlayEnabled = colorOverlayCfg ? getValue( colorOverlayCfg.enabled ) : false;
		const attachmentUrl = data?.attachmentUrl;

		// wp.media frames are expensive to create — reuse across opens.
		const frameRef = useRef( null );

		// The bound field can swap between the light and dark variant — the
		// frame's select handler must always write to the active one.
		const fieldRef = useRef( field );
		fieldRef.current = field;

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
					fieldRef.current.onChange( thumbnailId );
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
					{darkToggle && (
						<div className="flex w-full justify-end">{darkToggle}</div>
					)}
					<div
						className={`inline-flex items-center justify-center bg-gray-100 transition-colors duration-200 rounded-md p-4 border-dashed border-2 border-gray-500 cursor-pointer min-w-16 min-h-12 ${props.disabled ? 'opacity-50 disabled pointer-events-none' : ''}`}
						onClick={runUploader}
					>
						{attachmentUrl && ! isLoading ? (
							colorOverlayCfg ? (
								<div className="relative">
									<img
										src={attachmentUrl}
										alt={label}
										className={`max-w-72 max-h-48 object-contain ${isDarkPreview ? '' : 'grayscale'}`}
									/>
									{ !! brandColor && !! colorOverlayEnabled && (
										<div
											aria-hidden="true"
											className={`absolute inset-0 mix-blend-overlay pointer-events-none ${isDarkPreview ? '' : 'opacity-80'}`}
											style={ isDarkPreview ? darkOverlayStyle( attachmentUrl, brandColor ) : { backgroundColor: brandColor } }
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

/**
 * Image picker with a dark mode variant stored in a separate hidden field
 * (`setting.dark_mode_field_id`). The toggle only switches which image is
 * shown and edited — it does not follow the dashboard theme.
 */
const DarkModeImagePicker = ({ field, control, ...props }) => {
	const [ showDark, setShowDark ] = useState( false );
	const { field: darkField } = useController({
		name: props.setting.dark_mode_field_id,
		control
	});

	// Same root/thumb classes as SwitchInput so the toggle animates like every
	// other switch in the app, with a sun/moon icon inside the thumb.
	const toggle = (
		<Switch.Root
			checked={showDark}
			onCheckedChange={setShowDark}
			disabled={props.disabled}
			aria-label={__( 'Toggle dark mode image', 'burst-statistics' )}
			title={
				showDark ?
					__( 'Switch to light mode image', 'burst-statistics' ) :
					__( 'Switch to dark mode image', 'burst-statistics' )
			}
			className="w-10 h-6 bg-gray-400 rounded-full relative focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed data-[state=checked]:bg-primary"
		>
			<Switch.Thumb className="flex items-center justify-center w-4 h-4 translate-x-1 data-[state=checked]:translate-x-5 bg-white rounded-full shadow transform transition-transform duration-200">
				<Icon
					name={showDark ? 'moon' : 'sun'}
					size={12}
					className={showDark ? 'text-text-gray' : 'text-yellow-500'}
				/>
			</Switch.Thumb>
		</Switch.Root>
	);

	return (
		<ImagePickerControl
			{...props}
			control={control}
			field={showDark ? darkField : field}
			isDarkPreview={showDark}
			darkToggle={toggle}
		/>
	);
};

/**
 * ImagePickerField component
 *
 * Renders a plain image picker, or one with a dark mode variant when the PHP
 * field config sets `dark_mode_field_id`.
 */
const ImagePickerField = ( props ) => {
	if ( props.setting?.dark_mode_field_id ) {
		return <DarkModeImagePicker {...props} />;
	}

	return <ImagePickerControl {...props} />;
};

ImagePickerField.displayName = 'ImagePickerField';

export default ImagePickerField;
