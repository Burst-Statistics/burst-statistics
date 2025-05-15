import {
  TextControl,
  RadioControl,
  TextareaControl,
  __experimentalNumberControl as NumberControl,
  ToggleControl
} from '@wordpress/components';
import {useState, useEffect} from '@wordpress/element';
import {useFields} from '../../store/useFieldsStore';
import LogoEditor from './Fields/LogoEditor';
import Icon from '../../utils/Icon';
import IpBlock from './Fields/IpBlock';
import UserRoleBlock from './Fields/UserRoleBlock';
import GoalsSettings from './Goals/GoalsSettings';
import RadioButtons from './Fields/RadioButtons';
import SelectInput from './Fields/SelectInput';
import License from './Fields/License';
import RestoreArchivesControl from './Fields/RestoreArchivesControl';
import LabelWrapper from './Fields/LabelWrapper';
import EmailReports from './Fields/EmailReports';
import ButtonControl from './Fields/ButtonControl';

const Field = ( props ) => {
  const [ validated, setValidated ] = useState([]);
  const updateField = useFields( ( state ) => state.updateField );
  const setChangedField = useFields( ( state ) => state.setChangedField );
  const fields = useFields( ( state ) => state.fields );
  const highLightField = useFields( ( state ) => state.highLightField );

  useEffect( () => {
    let field = props.field;
    validateInput( field, field.value );
  });

  const onChangeHandler = ( fieldValue ) => {
    let field = props.field;
    validateInput( field, fieldValue );
    updateField( field.id, fieldValue );
    setChangedField( field.id );
  };

  const validateInput = ( field, fieldValue ) => {

    //check the pattern
    let valid = true;

    //if the field is required check if it has a value
    if ( field.required ) {
      valid = 0 !== fieldValue.length;
    }

    if ( valid && 'url' === field.type ) {
      let pattern = new RegExp( '^(https?:\\/\\/)?' + // protocol
          '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
          '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
          '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
          '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
          '(\\#[-a-z\\d_]*)?$', 'i' ); // fragment locator
      valid = !! pattern.test( fieldValue );
    }

    setValidated( valid );
  };

  let highLightClass = highLightField === props.field.id ?
      'burst-field-wrap burst-highlight' :
      'burst-field-wrap';
  highLightClass += ' burst-' + props.field.type;
  let field = props.field;
  let fieldValue = field.value;
  let visible;
  let disabled = field.disabled;
  let disabledOptions = [];
  let disabledLabel = '';
  let options = [];
  if ( field.options ) {
    for ( var key in field.options ) {
      if ( field.options.hasOwnProperty( key ) ) {
        let item = {};
        item.label = field.options[key];
        item.value = key;
        options.push( item );
      }
    }
  }

  //process pro field
  if ( burst_settings.is_pro && field.pro ) {
    disabled = false;
  }

  visible = ! field.conditionallyDisabled;
  if ( ! visible ) {
    return (
        <></>
    );
  }

  if ( 'checkbox' === field.type ) {
    return (
        <div className={highLightClass}>
          <ToggleControl
              disabled={disabled}
              checked={1 == field.value}
              label={field.label}
              onChange={( fieldValue ) => onChangeHandler( fieldValue )}
          />
          {field.comment &&
              <div dangerouslySetInnerHTML={{__html: field.comment}}></div>}
          {field.warning && <div className={'burst-warning'}>
            <Icon name={'warning'} color={'red'}/>
            <span>{field.warning}</span>
          </div>}
        </div>
    );
  }
  if ( 'multicheckbox' === field.type ) {
    return (
        <div className={highLightClass}>
          {field.parent_label && <div className="burst-parent-label">
            <label>{field.parent_label}</label></div>}
          <MultiCheckboxControl
              index={props.index}
              field={field}
              disabled={disabled}
          />
          {field.comment &&
              <div dangerouslySetInnerHTML={{__html: field.comment}}></div>}
        </div>
    );
  }

  if ( 'hidden' === field.type ) {
    return (
        <input type="hidden" value={field.value}/>
    );
  }

  if ( 'license' === field.type ) {
    return (
        <div className={highLightClass}>
          <License field={field}/>
        </div>

    );
  }

  if ( 'radio' === field.type ) {
    if ( Array.isArray( disabled ) ) {
      disabledOptions = disabled;
      options.forEach( function( option, i ) {
        const found = disabledOptions.indexOf( option.value );
        if ( -1 < found ) {
          disabledLabel = option.label;
          options.splice( i, 1 );
        }
      });
      disabled = false;
    }
    return (
        <div className={highLightClass}>
          {field.parent_label && <div className="burst-parent-label">
            <label>{field.parent_label}</label></div>}
          <div className="burst-label-container" htmlFor={field.id}>
            <label>{field.label}</label>
            {/*<Pro field={field} />*/}
          </div>
          <RadioControl
              label=""
              disabled={disabled}
              onChange={( fieldValue ) => onChangeHandler( fieldValue )}
              selected={fieldValue}
              options={options}
          />
          {disabledOptions && disabledOptions.map( ( option, i ) =>
              <label key={i}><input disabled type="radio"/>{disabledLabel}
              </label>
          )}
          {field.comment && <p>{field.comment}</p>}
        </div>
    );
  }

  if ( 'text' === field.type || 'url' === field.type ) {
    return (
        <div className={highLightClass}>
          {field.parent_label && <div className="burst-parent-label">
            <label>{field.parent_label}</label></div>}
          {validated && <Icon name="success" color="green"/>}
          {! validated && <Icon name="times"/>}
          <TextControl
              help={field.comment}
              placeholder={field.placeholder}
              label={field.label}
              onChange={( fieldValue ) => onChangeHandler( fieldValue )}
              value={fieldValue}
              disabled={disabled}
          />
        </div>
    );
  }

  if ( 'button' === field.type ) {
    return (
        <div className={'burst-field-button ' + highLightClass + ' burst-' +
            field.id}>
          <label>{field.label}</label>
          <ButtonControl label={field.label} field={field} disabled={disabled}/>
          {field.comment && <p className={'burst-comment'}>{field.comment}</p>}
        </div>
    );
  }

  if ( 'textarea' === field.type ) {
    return (
        <div className={highLightClass}>
          {validated && <Icon name="success" color="green"/>}
          {! validated && <Icon name="times"/>}
          <TextareaControl
              label={field.label}
              help={field.comment}
              value={fieldValue}
              onChange={( fieldValue ) => onChangeHandler( fieldValue )}
              disabled={disabled}
          />
        </div>
    );
  }

  if ( 'number' === field.type ) {
    return (
        <div className={highLightClass}>
          <NumberControl
              onChange={( fieldValue ) => onChangeHandler( fieldValue )}
              help={field.comment}
              label={field.label}
              value={fieldValue}
              disabled={disabled}
              min={field.min ? field.min : 0}
          />
        </div>
    );
  }
  if ( 'email' === field.type ) {
    return (
        <div className={highLightClass}>
          {validated && <Icon name="success" color="green"/>}
          {! validated && <Icon name="times"/>}
          <TextControl
              help={field.comment}
              label={field.label}
              onChange={( fieldValue ) => onChangeHandler( fieldValue )}
              value={fieldValue}
              disabled={disabled}
          />
        </div>
    );
  }

  if ( 'select' === field.type ) {
    return (
        <div className={highLightClass}>
          <SelectInput
              disabled={disabled}
              label={<LabelWrapper field={field}/>}
              onChange={( fieldValue ) => onChangeHandler( fieldValue )}
              value={fieldValue}
              options={options}
              field={field}
          />
          {field.warning && <div className={'burst-warning'}>
            <Icon name={'warning'} color={'red'}/>
            <span>{field.warning}</span>
          </div>}
        </div>
    );
  }

  if ( 'restore_archives' === field.type ) {
    return (
        <div className={highLightClass}>
          <RestoreArchivesControl disabled={disabled}/>
        </div>
    );
  }

  if ( 'ip_blocklist' === field.type ) {

    return (
        <div className={highLightClass}>
          <IpBlock
              disabled={disabled}
              field={field}
              label={field.label}
              help={field.comment}
              value={fieldValue}
              onChange={( fieldValue ) => onChangeHandler( fieldValue )}
              id="ip_address"
          />
        </div>

    );
  }

  if ( 'user_role_blocklist' === field.type ) {

    return (
        <div className={highLightClass}>
          <UserRoleBlock
              disabled={disabled}
              field={field}
              label={field.label}
              help={field.comment}
              value={fieldValue}
              onChange={( fieldValue ) => onChangeHandler( fieldValue )}
              id="user_role_block"
          />
        </div>

    );
  }

  if ( 'logo_editor' === field.type ) {

    return (
        <div className={highLightClass}>
          <LogoEditor
              name={field.id}
              disabled={disabled}
              field={field}
              label={<LabelWrapper field={field}/>}
              value={fieldValue}
              onChange={( fieldValue ) => onChangeHandler( fieldValue )}
          />
        </div>

    );
  }

  if ( 'goals' === field.type ) {

    return (
        <div className={highLightClass}>
          <GoalsSettings
              disabled={disabled}
              field={props.field}
              goal_fields={props.goal_fields}
              label={field.label}
              help={field.comment}
              value={fieldValue}
              onChangeHandler={onChangeHandler}
              id="user_role_block"
          />
        </div>

    );
  }

  if ( 'radio-buttons' === field.type ) {
    return (
        <div className={highLightClass}>

          <RadioButtons
              disabled={disabled}
              field={props.field}
              goal={props.goal}
              label={field.label}
              help={field.comment}
              value={fieldValue}
              onChange={( fieldValue ) => onChangeHandler( fieldValue )}
              className="radio-buttons"
          />
        </div>
    );
  }

  if ( 'email_reports' === field.type ) {
    return (
        <div className={highLightClass}>
          <EmailReports
              disabled={disabled}
              field={field}
              label={field.label}
              value={fieldValue}
              onChange={( fieldValue ) => onChangeHandler( fieldValue )}
          />
        </div>
    );
  }

  return (
      'not found field type ' + field.type
  );

};

export default Field;
