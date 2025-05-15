import React, { useState, useRef, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {useGoalsStore} from '../../../store/useGoalsStore';

import Tooltip from '../../common/Tooltip';

export default function EditableText({ value, id, onChange }) {
  const [ tempValue, setTempValue ] = useState( value );
  const [ isEditing, setIsEditing ] = useState( false );
  const inputRef = useRef( null );


  useEffect( () => {
    if ( isEditing && inputRef.current ) {
      inputRef.current.focus();
    }
  }, [ isEditing ]);

  function handleClick( e ) {
    e.preventDefault();
    setIsEditing( true );
  }

  async function handleBlur() {
    setIsEditing( false );

    // never set an empty value
    await onChange( tempValue );

  }

  function handleKeyDown( event ) {
    if ( ' ' === event.key ) {
      event.preventDefault();

      // add space to input
      setTempValue( event.target.value + ' ' );
    }

    if ( 'Enter' === event.key ) {
      event.preventDefault();
      setIsEditing( false );
      onChange( tempValue );
    }

  }

  function handleTextChange( event ) {
    event.preventDefault();
    setTempValue( event.target.value );
  }

  function handleFocus() {
    setIsEditing( true );
  }
  return (
      <div className={'burst-click-to-edit'}>
        {isEditing ? (
            <input
                type="text"
                value={tempValue}
                onChange={handleTextChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                ref={inputRef}
            />
        ) : (
            <Tooltip content={__( 'Click to edit', 'burst-statistics' )}>
              <h5 className="burst-tooltip-clicktoedit" tabIndex="0"
                  onClick={handleClick} onFocus={handleFocus}
                 >
                { '' !== tempValue ? tempValue : <i>{ __( 'Untitled goal', 'burst-statistics' ) }</i>}
              </h5>
            </Tooltip>
        )}
      </div>
  );
}
