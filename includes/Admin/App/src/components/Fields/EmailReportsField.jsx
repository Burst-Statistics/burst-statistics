import React, { forwardRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import useDebouncedCallback from '@/hooks/useDebouncedCallback';
import SelectInput from '@/components/Inputs/SelectInput';
import ButtonInput from '@/components/Inputs/ButtonInput';
import DataTable from 'react-data-table-component';
import TextInput from '@/components/Inputs/TextInput';

/**
 * EmailReportsField component
 *
 * This component now contains the email reports input logic previously held in
 * a separate file. It renders a list of email entries using DataTable and
 * allows adding, removing, and modifying email entries (with frequency
 * selection) from within a FieldWrapper.
 *
 * @param {object} field - Provided by react-hook-form's Controller.
 * @param {object} fieldState - Contains validation state.
 * @param {string} help - Help text for the field.
 * @param {string} context - Contextual information for the field.
 * @param {string} className - Additional Tailwind CSS classes.
 * @param {object} props - Additional props from react-hook-form's Controller.
 * @returns {JSX.Element}
 */
const EmailReportsField = forwardRef(
  ({ field, fieldState, help, context, className, ...props }, ref ) => {
    const inputId = props.id || field.name;

    // Use the field.value (an array) to store email entries.
    // Default to an empty array if no value exists.
    const emails = field.value || [];

    const [ entryEmail, setEntryEmail ] = useState( '' );
    const [ emailError, setEmailError ] = useState( '' );

    const frequencyOptions = [
      { value: 'weekly', label: __( 'Weekly', 'burst-statistics' ) },
      { value: 'monthly', label: __( 'Monthly', 'burst-statistics' ) }
    ];

    const isValidEmail = ( email ) => {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test( email );
    };

    const validateEmail = useDebouncedCallback( ( email ) => {
      if ( email.length && ! isValidEmail( email ) ) {
        setEmailError( __( 'Invalid email address', 'burst-statistics' ) );
      } else {
        setEmailError( '' );
      }
    }, 1000 );

    const changeEntryEmail = ( e ) => {
      const email = e.target.value;
      setEntryEmail( email );
      validateEmail( email );
    };

    const handleAddEmail = async() => {
      const email = entryEmail.trim();
      if ( ! email ) {
        setEmailError( __( 'Email address is required', 'burst-statistics' ) );
        return;
      }
      if ( ! isValidEmail( email ) ) {
        setEmailError( __( 'Invalid email address', 'burst-statistics' ) );
        return;
      }
      if ( 10 <= emails.length ) {
        setEmailError( __( 'Maximum 10 emails allowed', 'burst-statistics' ) );
        return;
      }
      if ( emails.find( ( item ) => item.email === email ) ) {
        setEmailError( __( 'Email address already added', 'burst-statistics' ) );
        return;
      }
      setEmailError( '' );
      field.onChange([ ...emails, { email, frequency: 'monthly' } ]);
      setEntryEmail( '' );
    };

    const maybeHandleAddEmail = ( e ) => {
      if ( 'Enter' === e.key ) {
        e.preventDefault();
        handleAddEmail();
      }
    };

    const handleRemoveEmail = ( email ) => {
      const updated = emails.filter( ( item ) => item.email !== email );
      field.onChange( updated );
    };

    const handleFrequencyChange = ( email, newFrequency ) => {
      const updated = emails.map( ( item ) => {
        if ( item.email === email ) {
          return { ...item, frequency: newFrequency };
        }
        return item;
      });
      field.onChange( updated );
    };

    const columns = [
      {
        name: __( 'Email', 'burst-statistics' ),
        selector: ( row ) => row.email
      },
      {
        name: __( 'Frequency', 'burst-statistics' ),
        cell: ( row ) => (
          <SelectInput
            value={row.frequency}
            onChange={( newFrequency ) =>
              handleFrequencyChange( row.email, newFrequency )
            }
            options={frequencyOptions}
          />
        ),
        right: 'true'
      },
      {
        name: __( 'Remove', 'burst-statistics' ),
        cell: ( row ) => (
          <ButtonInput
            onClick={() => handleRemoveEmail( row.email )}
            btnVariant="tertiary"
          >
            {__( 'Remove', 'burst-statistics' )}
          </ButtonInput>
        ),
        right: 'true'
      }
    ];

    return (
      <FieldWrapper
        label=""
        help={help}
        error={fieldState?.error?.message}
        context={context}
        inputId={inputId}
        fullWidthContent={true}
        recommended={props.recommended}
        disabled={props.disabled}
        {...props}
      >
        <div className="w-full space-y-4">
          <p className="px-6 text-sm text-gray">
            {__(
              'Recipients will receive weekly or monthly reports with statistics about your website. Add or remove email addresses in the list below.',
              'burst-statistics'
            )}
          </p>

          <DataTable
            noDataComponent={__( 'No emails added yet', 'burst-statistics' )}
            columns={columns}
            data={emails}
            customStyles={{
              headCells: {
                style: {
                  paddingLeft: '1.5rem',
                  paddingRight: '1.5rem'
                }
              },
              cells: {
                style: {
                  paddingLeft: '1.5rem',
                  paddingRight: '1.5rem'
                }
              }
            }}
          />

          <FieldWrapper
            label="Add emails to receive weekly or monthly reports"
            error={emailError}
            className="justify-start"
          >
            <TextInput
              name={inputId}
              autoComplete="email"
              id={inputId}
              type="email"
              value={entryEmail}
              onChange={changeEntryEmail}
              onKeyDown={maybeHandleAddEmail}
              placeholder={__( 'Enter email address', 'burst-statistics' )}
              className="mt-1 block w-full sm:w-64"
            />
            <ButtonInput
              onClick={handleAddEmail}
              btnVariant="tertiary"
              className="mt-2"
              type="button"
            >
              {__( 'Add to list', 'burst-statistics' )}
            </ButtonInput>
          </FieldWrapper>
        </div>
      </FieldWrapper>
    );
  }
);

EmailReportsField.displayName = 'EmailReportsField';

export default EmailReportsField;
