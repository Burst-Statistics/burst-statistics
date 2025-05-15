import RadioButtons from './RadioButtons';
import { __, sprintf } from '@wordpress/i18n';
import {useEffect, useState, useRef} from '@wordpress/element';
import TextInput from './TextInput';
import {useFields} from '../../../store/useFieldsStore';
import {useGoalsStore} from '../../../store/useGoalsStore';
const ClassId = ( props ) => {
  const { field, goal, label, help, value, onChangeHandler } = props;
  const [ classOrId, setClassOrId ] = useState( goal.attribute || 'class' );
  const { setGoalValue } = useGoalsStore();

  const [ warning, setWarning ] = useState( '' );
  const warningTimeoutRef = useRef( null );

  let fields = {...field};
  fields.options = {
    'class': {
      type: 'class',
      icon: 'period',
      label: __( 'Class', 'burst-statistics' )
    },
    'id': {
      type: 'id',
      icon: 'hashtag',
      label: __( 'ID', 'burst-statistics' )
    }
  };

  const handleRadioButtonChange = ( value ) => {
    setGoalValue( goal.id, 'attribute', value );
  };

  const handleTextInputChange = ( inputValue ) => {
    const strippedValue = inputValue.replace( /[^a-zA-Z0-9-_]/g, '' ); // this regex pattern will strip out all characters except for letters, numbers, hyphens, and underscores
    if ( inputValue !== strippedValue ) {
      let strippedChar = inputValue.replace( strippedValue, '' );
      let warning = sprintf( __( 'The character \'%s\' can not be used.', 'burst-statistics' ), strippedChar );
      if ( '.' === strippedChar || '#' === strippedChar ) {
        warning = sprintf( __( 'You don\'t need to prefix the input with a \'%s\' character.', 'burst-statistics' ), strippedChar, strippedChar );
      }
      setWarning( warning );
      clearTimeout( warningTimeoutRef.current );
      warningTimeoutRef.current = setTimeout( () => {
        setWarning( '' );
      }, 6000 ); // clear the warning state after 6 seconds
    }
    setGoalValue( goal.id, 'attribute_value', strippedValue );
  };

  return (
      <>
        <RadioButtons
            field={fields}
            goal={goal}
            label={props.label}
            value={goal.attribute}
            onChangeHandler={handleRadioButtonChange}
        />
          <TextInput value={value} onChangeHandler={( value ) => handleTextInputChange( value )} field={field} label={sprintf( __( 'What is the name for the %s?', 'burst-statistics' ), goal.attribute ) } />
          {warning && <p
              style={{transition: 'opacity 0.5s ease-out', opacity: 1}}
              className="burst-settings-goals__list__item__fields__warning">{warning}</p>}
      </>
  );
};

export default ClassId;
