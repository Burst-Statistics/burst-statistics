import {useState} from '@wordpress/element';

const UserRoleBlock = ( props ) => {
  const [ radioValue, setRadioValue ] = useState( 'block-selected' );
  let field = props.field;
  let fieldValue = field.value;
  let fields = props.fields;
  let userRoles = burst_settings.user_roles ? burst_settings.user_roles : [];
  let selectedUserRoles = fieldValue ? fieldValue : [ 'administrator' ];

  const onChangeCheckboxHandler = ( e ) =>  {
    let value = e.target.value;
    let checked = e.target.checked;
    let fieldValue = [ ...props.field.value ];  // creating a copy of field value array
    let index = fieldValue.indexOf( value );

    if ( checked ) {
      if ( -1 === index ) {
        fieldValue.push( value );
      }
    } else {
      if ( -1 < index ) {
        fieldValue.splice( index, 1 );
      }
    }

    // we are calling this with the updated local fieldValue copy not the prop one.
    props.onChange( fieldValue );
  };


  return (
        <>
          <label>{field.label}</label>
            {'block-selected' === radioValue && <div className="burst-user-role-checkbox-blocklist">
              {Object.keys( userRoles ).map( ( key, index ) => {
                return (
                    <label key={key}>
                      <input onChange={onChangeCheckboxHandler} checked={selectedUserRoles.includes( key )} type={'checkbox'} id={key} name={'user-role-block'} value={key} />
                      {userRoles[key]}
                    </label>
                );
              })}
            </div>
            }
        </>
    );
};

export default UserRoleBlock;
