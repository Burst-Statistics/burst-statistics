import React, { useState, useRef, useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import Tooltip from '@/components/Common/Tooltip';

export default function EditableTextField({ value, id, onChange }) {
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
    <div>
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
          <h5
            className="min-w-[150px] font-semibold inline-block burst-tooltip-clicktoedit"
            tabIndex="0"
            onClick={handleClick}
            onFocus={handleFocus}
          >
            {'' !== tempValue ? (
              tempValue
            ) : (
              <i>{__( 'Untitled goal', 'burst-statistics' )}</i>
            )}
          </h5>
        </Tooltip>
      )}
    </div>
  );
}
