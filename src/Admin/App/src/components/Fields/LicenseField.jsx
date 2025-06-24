import {forwardRef} from 'react';
import {__, sprintf} from '@wordpress/i18n';
import ButtonInput from '@/components/Inputs/ButtonInput';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import {doAction} from '@/utils/api';
import TextInput from '@/components/Inputs/TextInput';
import {useQuery, useQueryClient, useMutation} from '@tanstack/react-query';
import useLicenseStore from '@/store/useLicenseStore';
import Icon from '@/utils/Icon';
import useSettingsData from '@/hooks/useSettingsData';
import Hyperlink from "@/utils/Hyperlink";

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
    ({field, fieldState, label, help, context, className, ...props}, ref ) => {
        const queryClient = useQueryClient();

        // Retrieve license status, notices & helper functions from the store.
        const {setLicenseStatus, isLicenseValid, licenseStatus } = useLicenseStore();
        const { saveSettings } = useSettingsData();

        // Updated useQuery with transformation using select and onSuccess.
        const { data, isLoading } = useQuery({
            queryKey: [ 'licenseNotices' ],
            queryFn: () => doAction( 'license_notices', {})
        });

        if ( data && data.licenseStatus !== licenseStatus ) {
            setLicenseStatus( data.licenseStatus );
        }

        // Override label with default when not provided.
        const labelText = label || __( 'Enter your license key', 'burst-statistics' );
        const inputId = props.id || field.name;

        const {mutate: mutateLicense, isPending: isLicenseMutationPending} = useMutation({
            mutationFn: ( action ) => {
                if ( 'activate' === action ) {
                    return saveSettings({ [ field.name ]: field.value });
                } else {
                    return doAction( 'deactivate_license', {});
                }
            },
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: [ 'licenseNotices' ] });
            }
        });
        let licenseNotices;

        // if license is mutating replace notices with a loading notice.
        if ( data === undefined || isLicenseMutationPending ) {
            licenseNotices = [
                {
                        label: 'loading',
                        msg: 'Loading...'
                }
            ];
        } else {
            licenseNotices = data.notices;
        }

        // Render the input view for no license key (empty state).
        const renderLicenseInput = () => {
            const contextText = (
            <>
                    {__( 'Activating your license gives you automatic updates and support.', 'burst-statistics' )}{' '}
                    <Hyperlink
                        className={'underline'}
                        url={'https://burst-statistics.com/how-to-install-burst-pro/'}
                        target="_blank"
                        rel="noopener noreferrer"
                        text={__( 'Having trouble? %sCheck our installation guide%s.', 'burst-statistics' )}
                    />{' '}
                    <Hyperlink
                        className={'underline'}
                        url={'https://burst-statistics.com/support/'}
                        target="_blank"
                        rel="noopener noreferrer"
                        text={__( 'If that does not help, please %sopen a support ticket%s so we can help you out!', 'burst-statistics' )}
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
                >
                    <TextInput
                        id={inputId}
                        aria-invalid={!! fieldState?.error?.message}
                        type="password" // masked input for security.
                        placeholder={__( 'Enter your license key here.', 'burst-statistics' )}
                        {...field}
                        {...props}
                        ref={ref}
                    />
                    <div className='flex flex-row gap-2 mt-2'>
                    {! isLoading && 'valid' === data.licenseStatus && (
                        <ButtonInput
                        btnVariant="tertiary"
                        onClick={() => mutateLicense( 'deactivate' )}
                        disabled={isLicenseMutationPending}
                    >
                        {__( 'Deactivate License', 'burst-statistics' )}
                    </ButtonInput>
                    )}
                    {! isLoading && 'valid' !== data.licenseStatus && (
                            <ButtonInput
                            btnVariant="primary"
                            onClick={() => mutateLicense( 'activate' )}
                            disabled={isLicenseMutationPending}
                        >
                            {__( 'Activate License', 'burst-statistics' )}
                        </ButtonInput>
                    )}
                    {isLicenseMutationPending && (

                        // Align next to button
                        <Icon name="loading" size={20} />
                    )}
                    </div>
                </FieldWrapper>
                <div className="flex flex-col gap-2 p-6">
                    <h3 className='text-md font-medium text-black'>{__( 'License status', 'burst-statistics' )}</h3>
                 { ! isLoading && licenseNotices &&
                        licenseNotices.map( ( notice, i ) => (
                            <LicenseNotice key={i} notice={notice} />
                        ) )
                 }
                </div>
                </>
            );
        };

        // Render view based on the license status from store.
        return renderLicenseInput();
    }
);

LicenseField.displayName = 'LicenseField';

export default LicenseField;

const LicenseNotice = ({notice}) => {
    // notice contains label ('warning', 'open', 'success'), msg, url (optional)
    const colorMap = {
        warning: 'red',
        open: 'blue',
        success: 'green'
    };
    const color = colorMap[notice.icon] || 'green';

    // we have to render a bullet with the color of the label
    // we have to render the msg
    // we have to render the url if it exists
    return (
        <div className="flex flex-row gap-2">
            <Icon name='bullet' color={color} />
            <p>{notice.msg}</p>
            {notice.url && <a href={notice.url} target="_blank">{__( 'More info', 'burst-statistics' )}</a>}
        </div>
    );
};
