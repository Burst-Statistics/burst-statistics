import { forwardRef } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import ButtonInput from '@/components/Inputs/ButtonInput';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import TextInput from '@/components/Inputs/TextInput';
import Icon from '@/utils/Icon';
import Hyperlink from '@/utils/Hyperlink';
import useLicenseData, { LicenseNotice as LicenseNoticeType } from '@/hooks/useLicenseData';

/**
 * LicenseField component for handling license key inputs.
 *
 * This component renders an input for the license key with a button to activate it.
 * Once activated, it shows the license status and a button to deactivate the license.
 *
 * @param {object} field - Provided by react-hook-form's Controller.
 * @param {object} fieldState - Contains validation state.
 * @param {string} label - Field label.
 * @param {string} help - Help text for the field.
 * @param {string} context - Contextual information for the field.
 * @param {string} className - Additional Tailwind CSS classes.
 * @param {object} props - Additional props.
 * @returns {JSX.Element}
 */
const LicenseField = forwardRef(
    ({ field, fieldState, label, help, context, className, ...props }, ref) => {
        // Use the custom license data hook - React Query is now the single source of truth
        const {
            licenseNotices,
            licenseStatus,
            isLoading,
            isLicenseMutationPending,
            activateLicense,
            deactivateLicense,
        } = useLicenseData();

        // Override label with default when not provided
        const labelText = label || __('Enter your license key', 'burst-statistics');
        const inputId = props.id || field.name;

        // Render the input view for license key
        const renderLicenseInput = () => {
            const contextText = (
                <>
                    {__('Activating your license gives you automatic updates and support.', 'burst-statistics')}{' '}
                    <Hyperlink
                        className={'underline'}
                        url={'https://burst-statistics.com/how-to-install-burst-pro/'}
                        target="_blank"
                        rel="noopener noreferrer"
                        text={__('Having trouble? %sCheck our installation guide%s.', 'burst-statistics')}
                    />{' '}
                    <Hyperlink
                        className={'underline'}
                        url={'https://burst-statistics.com/support/'}
                        target="_blank"
                        rel="noopener noreferrer"
                        text={__(
                            'If that does not help, please %sopen a support ticket%s so we can help you out!',
                            'burst-statistics'
                        )}
                    />
                </>
            );

            return (
                <>
                    <FieldWrapper
                        label={labelText}
                        help={help}
                        error={fieldState?.error?.message}
                        context={contextText}
                        className={className}
                        inputId={inputId}
                        required={props.required}
                        {...props}
                    >
                        <TextInput
                            id={inputId}
                            aria-invalid={!!fieldState?.error?.message}
                            type="password" // masked input for security
                            placeholder={__('Enter your license key here.', 'burst-statistics')}
                            {...field}
                            {...props}
                            ref={ref}
                        />
                        <div className="flex flex-row gap-2 mt-2">
                            {!isLoading && licenseStatus === 'valid' && (
                                <ButtonInput
                                    btnVariant="tertiary"
                                    onClick={() => deactivateLicense()}
                                    disabled={isLicenseMutationPending}
                                >
                                    {__('Deactivate License', 'burst-statistics')}
                                </ButtonInput>
                            )}
                            {!isLoading && licenseStatus !== 'valid' && (
                                <ButtonInput
                                    btnVariant="primary"
                                    onClick={() => activateLicense(field.name, field.value)}
                                    disabled={isLicenseMutationPending}
                                >
                                    {__('Activate License', 'burst-statistics')}
                                </ButtonInput>
                            )}
                            {isLicenseMutationPending && (
                                // Align next to button
                                <Icon name="loading" size={20} />
                            )}
                        </div>
                    </FieldWrapper>
                    <div className="flex flex-col gap-2 p-6">
                        <h3 className="text-md font-medium text-black">
                            {__('License status', 'burst-statistics')}
                        </h3>
                        {!isLoading &&
                            licenseNotices &&
                            licenseNotices.map((notice, i) => <LicenseNotice key={i} notice={notice} />)}
                    </div>
                </>
            );
        };

        // Render view based on the license status from store
        return renderLicenseInput();
    }
);

LicenseField.displayName = 'LicenseField';

export default LicenseField;

/**
 * LicenseNotice component for displaying individual license notices
 */
const LicenseNotice = ({ notice }) => {
    // notice contains icon ('warning', 'open', 'success', 'loading'), label, msg, url (optional)
    const colorMap = {
        warning: 'red',
        open: 'blue',
        success: 'green',
        loading: 'gray',
    };
    const color = colorMap[notice.icon] || 'green';

    return (
        <div className="flex flex-row gap-2">
            <Icon name="bullet" color={color} />
            <p>{notice.msg}</p>
            {notice.url && (
                <a href={notice.url} target="_blank" rel="noopener noreferrer">
                    {__('More info', 'burst-statistics')}
                </a>
            )}
        </div>
    );
};