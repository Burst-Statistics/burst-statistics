import {doAction} from '../../../utils/api';
import { __ } from '@wordpress/i18n';
import {useFields} from '../../../store/useFieldsStore';
import useLicenseStore from '../../../store/useLicenseStore';
import {useState, useEffect} from '@wordpress/element';
import TaskElement from '../TaskElement';
import Icon from '../../../utils/Icon';
const License = ( props ) => {
    const {fields, updateField} = useFields();
    const {licenseStatus, setLicenseStatus} = useLicenseStore();
    const disabledState = {output: {
            dismissible: false,
            icon: 'skeleton',
            label: __( 'Loading', 'burst-statistics' ),
            msg: false,
            plusone: false,
            url: false
        }
    };
    const skeletonNotices = [
        disabledState,
        disabledState,
        disabledState
    ];
    const [ notices, setNotices ] = useState( skeletonNotices );
    const getLicenseNotices = () => {
        return doAction( 'license_notices', {}).then( ( response ) => {
            return response;
        });
    };
    useEffect( () => {
        getLicenseNotices().then( ( response ) => {
            setLicenseStatus( response.licenseStatus );
            setNotices( response.notices );
        });
    }, [ fields ]);

    const onChangeHandler = ( fieldValue ) => {
        updateField( field.id, fieldValue );
    };

    const toggleActivation = () => {
        if ( 'valid' === licenseStatus ) {
            doAction( 'deactivate_license' ).then( ( response ) => {
                setLicenseStatus( response.licenseStatus );
                setNotices( response.notices );
            });
        } else {
            let data = {};
            data.license = props.field.value;

			doAction( 'activate_license', data ).then( ( response ) => {
                setLicenseStatus( response.licenseStatus );
                const tasks = response.notices;
                //convert tasks to array

                setNotices( response.notices );
            });
        }
    };

    let field = props.field;
    const buttonClass = 'valid' !== licenseStatus ? 'button-primary' : 'button-secondary';

	/**
     * There is no "PasswordControl" in WordPress react yet, so we create our own license field.
     */
    return (
            <div className="components-base-control">
             <div className="components-base-control__field">
                 <label
                     className="components-base-control__label"
                     htmlFor={field.id}>{field.label}</label>
                  <div className="rsssl-license-field">
                     <input className="components-text-control__input"
                            type="password"
                            id={field.id}
                            value={field.value}
                            onChange={ ( e ) => onChangeHandler( e.target.value ) }
                     />
                     <button className={`button ${buttonClass}`} onClick={ () => toggleActivation() }>
                     {'valid' === licenseStatus && <>{__( 'Deactivate', 'really-simple-ssl' )}</>}
                     {'valid' !== licenseStatus && <>{__( 'Activate', 'really-simple-ssl' )}</>}
                     </button>
                 </div>
             </div>
                {notices && notices.map( ( notice, i ) => <TaskElement key={i} index={i} notice={notice} highLightField=""/> )}
            </div>
    );
};

export default License;
