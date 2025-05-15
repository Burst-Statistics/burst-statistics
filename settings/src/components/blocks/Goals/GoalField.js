import {TextControl} from '@wordpress/components';
import Icon from '../../../utils/Icon';
import RadioButtons from '../Fields/RadioButtons';
import ClassId from '../Fields/ClassId';
import Hook from '../Fields/Hook';
import SelectPage from '../Fields/SelectPage';
import {useEffect, useState} from '@wordpress/element';

const GoalField = ({
                       field = {},
                       goal,
                       value,
                       setGoalValue
                   }) => {

  const [ validated, setValidated ] = useState( false );

  useEffect( () => {
    validateInput( field, value );
  }, []);

  const onChangeHandler = ( value ) => {
    validateInput( field, value );

    // if value is validated, set it
    if ( validated ) {

        //when we update to type=views, the page_or_website property is not visible, so should be reset to the corresponding value.
        if ( 'type' === field.id && 'visits' === value ) {
            setGoalValue( goal.id, 'page_or_website', 'page' );
        }
      setGoalValue( goal.id, field.id, value );
    }
  };

  const validateInput = ( field, value ) =>{

    //check the pattern
    let valid = true;

    //if the field is required check if it has a value
    if ( field.required ) {
      valid = 0 !== value.length;
    }

    if ( valid && 'url' === field.type ) {
      let pattern = new RegExp( '^(https?:\\/\\/)?' + // protocol
          '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
          '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
          '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
          '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
          '(\\#[-a-z\\d_]*)?$', 'i' ); // fragment locator
      valid = !! pattern.test( value );
    }

    setValidated( valid );
  };

  let className = 'burst-' + field.type;
  let disabled = field.disabled;

    if ( 'hidden' === field.type || field.conditionallyDisabled ) {
        return null;
    }

  if ( 'text' === field.type || 'url' === field.type ) {
    return (
        <div className={className}>
          { field.parent_label && <div className="burst-parent-label"><label>{field.parent_label}</label></div>}
          { validated && <Icon name='success' color='green'/>}
          { ! validated && <Icon name='times'/>}
          <TextControl
              help={ field.comment }
              placeholder={ field.placeholder }
              label={ field.label }
              onChange={ ( value ) => onChangeHandler( value ) }
              value= { value }
              disabled={disabled}
          />
        </div>
    );
  }

  if ( 'radio-buttons' === field.type ) {
    return (
        <div className={className}>
          <RadioButtons
              disabled={disabled}
              field={field}
              goal={goal}
              label={field.label}
              help={field.comment}
              value={goal[field.id]}
              onChangeHandler={ ( value ) => onChangeHandler( value ) }
              className="radio-buttons"
          />
        </div>
    );
  }

  if ( 'hook' === field.type ) {
    return (
        <div className={className}>
          <Hook
              disabled={disabled}
              field={field}
              goal={goal}
              label={field.label}
              help={field.comment}
              value={goal.hook}
              onChangeHandler={ ( value ) => onChangeHandler( value ) }
          />
        </div>
    );
  }

  if ( 'class-id' === field.type ) {
      return (
        <div className={className}>
          <ClassId
              disabled={disabled}
              field={field}
              goal={goal}
              label={field.label}
              help={field.comment}
              value={goal.attribute_value}
              onChangeHandler={ ( value ) => onChangeHandler( value ) }
          />
        </div>
    );
  }

  if ( 'select-page' === field.type ) {
    return (
        <div className={className}>
          <SelectPage
              disabled={disabled}
              field={field}
              goal_id={goal.id}
              label={field.label}
              help={field.comment}
              value={false === goal.url || '*' === goal.url ? '' : goal.url}
              onChangeHandler={ ( value ) => onChangeHandler( value ) }
          />
        </div>
    );
  }
};

export default GoalField;
