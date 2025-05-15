import {useState, useEffect} from '@wordpress/element';
import DataTable from 'react-data-table-component';
import {__} from '@wordpress/i18n';
import SwitchText from './SwitchText';
import SelectInput from './SelectInput';
import useDebouncedCallback from '../../../hooks/useDebouncedCallback';
import Icon from '../../../utils/Icon';
import {useFields} from '../../../store/useFieldsStore';

const EmailReports = ({name, value, onChange, comment}) => {
  const saveFields = useFields( ( state ) => state.saveFields );

  const [ emailError, setEmailError ] = useState( '' );
  const [ entryEmail, setEntryEmail ] = useState( '' );

  const frequencyOptions = [
    { value: 'weekly', label: __( 'Weekly', 'burst-statistics' ) },
    { value: 'monthly', label: __( 'Monthly', 'burst-statistics' ) }
  ];

  /**
   * Change the email entry field and maybe add error message
   * @param e
   */
  const changeEntryEmail = ( e ) => {
    setEntryEmail( e.target.value );
    validateEmail( e.target.value );
  };

  /**
   * Add email address on Enter key
   * @param e
   */
  const maybeHandleAddEmail = ( e ) => {
    if ( 'Enter' === e.key ) {
      handleAddEmail( entryEmail );
    }
  };

  const handleRemoveEmail = async( email ) => {
    onChange( value.filter( item => item.email !== email ) );
    await saveFields();
  };

  const handleFrequencyChange = async( email, newFrequency ) => {
    onChange( value.map( item => {
      if ( item.email === email ) {
        return { ...item, frequency: newFrequency };
      }
      return item;
    }) );
    await saveFields();
  };

  /**
   * Add email address to the list
   * @param e
   */
  const handleAddEmail = async( e ) => {
    const email = entryEmail;
    if ( ! isValidEmail( email ) ) {
      return;
    }

    if ( ! email ) {
      setEmailError( __( 'Email address is required', 'burst-statistics' ) );
      return;
    }

    // allow max 10 emails
    if ( 10 <= value.length ) {
      setEmailError( __( 'Maximum 10 emails allowed', 'burst-statistics' ) );
      return;
    }

    // check for duplicates
    if ( value.find( item => item.email === email ) ) {
      setEmailError( __( 'Email address already added', 'burst-statistics' ) );
      return;
    }

    setEmailError( '' );

    // default frequency is monthly
    onChange([ ...value, {email, frequency: 'monthly'} ]);
    setEntryEmail( '' );
    await saveFields();
  };

  /**
   * Validate email address
   * @param email
   * @return {boolean}
   */
  const isValidEmail = ( email ) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test( email );
  };

  /**
   * Validate email address
   */
  const validateEmail = useDebouncedCallback( ( email ) => {
    if ( ! isValidEmail( email ) && email.length ) {
      setEmailError( __( 'Invalid email address', 'burst-statistics' ) );
    } else {
      setEmailError( '' );
    }
  }, 1000 );

  return (
      <div className="burst-field burst-email-reports-field">
        <p className={'burst-field-description'}>
          {__(
              'Recipients will receive weekly or monthly reports with statistics about your website. Add or remove email addresses in the list below.',
              'burst-statistics' )}
        </p>
        <DataTable
            noDataComponent={__( 'No emails added yet', 'burst-statistics' )}
            columns={[
          {
            name: __( 'Email', 'burst-statistics' ),
            selector: row => row.email,
            grow: 2
          },
          {
            name: __( 'Frequency', 'burst-statistics' ),
            cell: row => (
                <SelectInput
                    value={row.frequency}
                    onChange={( newFrequency ) => {
                      handleFrequencyChange( row.email, newFrequency );

                    }}
                    options={frequencyOptions}
                />
            ),
            right: 1
          },
          {
            name: 'Remove',
            cell: row => <button className={'burst-button-icon burst-button-icon--delete'}
                                 onClick={() => handleRemoveEmail( row.email ) }>
                  <Icon name={'trash'} size={18}/>
                </button>,
            right: 1
          }
        ]}
                   data={value}
        />

        <div className="burst-email-reports-field__add">
          <label className={'burst-email-reports-field__add_label'}
                 htmlFor={name}>{__(
              'Add emails to receive weekly or monthly reports',
              'burst-statistics' )}</label>
          <input
              type="text"
              name={name}
              id={name}
              value={entryEmail}
              onChange={changeEntryEmail}
              onKeyDown={maybeHandleAddEmail}
          />
          <button
              aria-label={__( 'Add to list', 'burst-statistics' )}
              className={'burst-button burst-button--primary'}
              onClick={handleAddEmail}
          >
            {__( 'Add to list', 'burst-statistics' )}
          </button>
        </div>
        {emailError &&
            <div className="burst-warning warning">{emailError}</div>}
      </div>
  );
};

export default EmailReports;
