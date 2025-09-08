import Icon from '@/utils/Icon';
import SelectPageField from '@/components/Fields/SelectPageField';
import { useEffect, useState } from 'react';
import  TextField from '@/components/Fields/TextField';
import RadioButtonsField from '@/components/Fields/RadioButtonsField';
import SelectorField from '@/components/Fields/SelectorField';

const GoalField = ({ field = {}, fields, goal, value, setGoalValue }) => {
  const [ validated, setValidated ] = useState( false );

  useEffect( () => {
    validateInput( field, value );
  });

  const onChangeHandler = ( value ) => {
    validateInput( field, value );

    //when we update to type=views, the page_or_website property is not visible, so should be reset to the corresponding value.
    if ( 'type' === field.id && 'visits' === value ) {
      setGoalValue( goal.id, 'page_or_website', 'page' );
    }
    setGoalValue( goal.id, field.id, value );
  
  };

  const validateInput = ( field, value ) => {

    //check the pattern
    let valid = true;

    //if the field is required check if it has a value
    if ( field.required ) {
      valid = 0 !== value.length;
    }

    if ( valid && 'url' === field.type ) {
      let pattern = new RegExp(
        '^(https?:\\/\\/)?' + // protocol
          '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
          '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
          '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
          '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
          '(\\#[-a-z\\d_]*)?$',
        'i'
      ); // fragment locator
      valid = !! pattern.test( value );
    }

    if ( valid && 'css-selector' === field.type ) {
      valid = !! value.length;
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
        {field.parent_label && (
          <div>
            <label>{field.parent_label}</label>
          </div>
        )}
        {validated && <Icon name="success" color="green" />}
        {! validated && <Icon name="times" />}
        <TextField
          help={field.comment}
          placeholder={field.placeholder}
          label={field.label}
          onChange={( value ) => onChangeHandler( value.target.value )}
          value={value}
          disabled={disabled}
        />
      </div>
    );
  }

  if ( 'radio-buttons' === field.type ) {
    return (
      <div className={className}>
        <RadioButtonsField
          disabled={disabled}
          field={field}
          goalId={goal.id}
          inputId={field.id}
          id={field.id}
          label={field.label}
          help={field.comment}
          value={goal[field.id]}
          onChange={( value ) => onChangeHandler( value )}
          className="radio-buttons"
        />
      </div>
    );
  }

  if ( 'hook' === field.type ) {
    return (
      <div className="flex flex-wrap align-content-stretch gap-xl [&>*]: w-full [&>input[type='text']]:w-full [&>input[type='text']]:box-border">
        <TextField
          disabled={disabled}
          field={field}
          goal={goal}
          label={field.label}
          help={field.comment}
          value={goal.hook}
          onChange={( value ) => onChangeHandler( value.target.value )}
        />
      </div>
    );
  }

  if ( 'select-page' === field.type ) {
    return (
      <div className={className}>
        <SelectPageField
          disabled={disabled}
          field={field}
          goal_id={goal.id}
          label={field.label}
          help={field.comment}
          value={false === goal.url || '*' === goal.url ? '' : goal.url}
          onChange={( value ) => onChangeHandler( value )}
        />
      </div>
    );
  }

  if ( 'selector' === field.type ) {
    return (
      <div className={className}>
        <SelectorField
          disabled={disabled}
          field={field}
          goal={goal}
          goal_id={goal.id}
          label={field.label}
          help={field.comment}
          value={goal.selector}
          onChange={( value ) => onChangeHandler( value )}
        />
      </div>
    );
  }
};

export default GoalField;
