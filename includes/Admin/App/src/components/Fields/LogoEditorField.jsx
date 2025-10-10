import React, { forwardRef } from 'react';
import { __ } from '@wordpress/i18n';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import Icon from '@/utils/Icon';
import ButtonInput from '@/components/Inputs/ButtonInput';
import { useQuery } from '@tanstack/react-query';

/**
 * LogoEditorField component
 *
 * This component allows users to upload and select a logo image using the WordPress media library.
 *
 * @param {object} field - Provided by react-hook-form's Controller.
 * @param {object} fieldState - Contains validation state.
 * @param {string} label - Field label.
 * @param {string} help - Help text for the field.
 * @param {string} className - Additional Tailwind CSS classes.
 * @param {object} props - Additional props from react-hook-form's Controller.
 * @returns {JSX.Element}
 */
const LogoEditorField = forwardRef(
  ({ field, fieldState, label, help, className, ...props }, ref) => {
    const defaultLogoUrl = burst_settings.plugin_url + 'assets/img/burst-email-logo.png';

    // onChange to update the field value (attachment ID)
    const { data, isLoading } = useQuery({
        queryKey: [ 'attachment', field.value ],
        queryFn: async() => {
            if ( '0' !== field.value && 0 !== field.value ) {
                return await wp.media.attachment( field.value ).fetch();
            }
            return null;
        }
    });

    const attachmentUrl = data?.sizes?.medium?.url ||
               data?.sizes?.large?.url ||
               data?.sizes?.full?.url ||
               defaultLogoUrl;
               '';

    let frame;
    const runUploader = () => {
      if (props.disabled) {
        return;
      }

      if ( frame ) {
        frame.open();
        return;
      }

      frame = wp.media({
        title: __( 'Select a logo', 'burst-statistics' ),
        button: {
          text: __( 'Set logo', 'burst-statistics' )
        },
        multiple: false
      });

      frame.on( 'select', () => {
        const selection = frame.state().get( 'selection' ).first();
        const thumbnailId = selection.id;
        const image = selection.attributes.sizes.medium ||
                      selection.attributes.sizes.thumbnail ||
                      selection.attributes.sizes.full;

        if ( image ) {
          field.onChange( thumbnailId );
        }
      });

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

          <div
            className={`flex items-center justify-center bg-gray-100 rounded-md p-4 border-dashed border-2 border-gray-500 cursor-pointer max-w-72 max-h-24 ${props.disabled ? 'opacity-50 disabled pointer-events-none' : ''}`}
            onClick={runUploader}
          >
            {attachmentUrl && ! isLoading ? (
              <img src={attachmentUrl} alt="Logo" className="max-w-64 max-h-20" />
            ) : (
              <Icon name="loading" size={18} />
            )}
          </div>
          <ButtonInput
            btnVariant="tertiary"
            size="sm"
            className="mt-2"
            onClick={resetToDefault}
            disabled={props.disabled || 0 === field.value || '0' === field.value}
          >
            {__( 'Reset to Default', 'burst-statistics' )}
          </ButtonInput>

      </FieldWrapper>
    );
  }
);

export default LogoEditorField;
