import Icon from '../../../utils/Icon';
import Tooltip from '../../common/Tooltip';
import {useFields} from '../../../store/useFieldsStore';
import {useEffect, useState} from '@wordpress/element';
import {__} from '@wordpress/i18n';

const RadioButtons = ({
  disabled,
  field: {id, options},
  goal,
  label,
  value,
  onChangeHandler,
  className
}) => {
    const getFieldValue = useFields( ( state ) => state.getFieldValue );
    const fieldsLoaded = useFields( ( state ) => state.fieldsLoaded );
    const [ cookieless, setCookieless ] = useState( false );
    useEffect( () => {
        if ( fieldsLoaded ) {
            setCookieless( 1 == getFieldValue( 'enable_cookieless_tracking' ) );
        }
    }, [ fieldsLoaded, getFieldValue( 'enable_cookieless_tracking' ) ]);

    if ( !goal ) {
        return null;
    }
    return (
      <div className={`burst-radio-buttons ${className}`}>
        <p className="burst-label">{label}</p>
        <div className="burst-radio-buttons__list">
          {Object.keys( options ).map( key => {
            const {type, icon, label, description} = options[key];
            return (
                <Tooltip title={description} arrow key={key} enterDelay={1000}>
                  <div key={`${goal.id}-${id}-${type}`}
                       className='burst-radio-buttons__list__item'>
                    <input
                        type="radio"
                        checked={type === value}
                        name={`${goal.id}-${id}`}
                        id={`${goal.id}-${id}-${type}`}
                        value={type}
                        disabled={disabled || ( cookieless && 'hook' === type ) }
                        onChange={e => {
                          onChangeHandler( e.target.value );
                        }}
                    />
                    <label htmlFor={`${goal.id}-${id}-${type}`} className={ cookieless && 'hook' === type ? 'burst-disabled-radio' : ''}>
                      <Icon name={icon} size={18}/>
                      <h5>{label}</h5>
                      {description && 1 < description.length && (
                          <>
                            <div className="burst-divider"/>
                            <p>{cookieless && 'hook' === type ? __( 'Not available with cookieless tracking', 'burst-statistics' ) : description}</p>
                          </>
                      )}
                    </label>
                  </div>
                </Tooltip>
            );
          })}
        </div>
      </div>
  );
};

export default RadioButtons;
