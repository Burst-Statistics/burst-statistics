import * as burst_api from '../../../utils/api';
import {useState} from '@wordpress/element';
import Hyperlink from '../../../utils/Hyperlink';
import Modal from '../../common/Modal';
import {__} from '@wordpress/i18n';

// import { __experimentalConfirmDialog as ConfirmDialog } from '@wordpress/components';
import {toast} from 'react-toastify';

const ButtonControl = ({label, field, disabled}) => {
  const [ isOpen, setIsOpen ] = useState( false );

  let text = field.button_text ? field.button_text : field.label;

  if ( field.action ) {
    const clickHandler = async( e ) => {
      if ( field.warnTitle ) {
        setIsOpen( true );
      } else {
        await executeAction();
      }
    };

    const handleConfirm = async() => {
      setIsOpen( false );
      await executeAction();
    };

    const handleCancel = () => {
      setIsOpen( false );
    };

    const executeAction = async( e ) => {
      let data = {};
      await burst_api.doAction( field.action, data ).then( ( response ) => {
        if ( response.success ) {
          toast.success( response.message );
        }
      });
    };

    return (
        <>
          <button
              className={'burst-button' + ( 'danger' == field.warnType ? ' burst-button--tertiary' : ' burst-button--primary' )}
              disabled={disabled}
              onClick={( e )=>clickHandler( e )}
          >{text}</button>
          <Modal
              title={field.warnTitle}
              content={field.warnContent}
              isOpen={isOpen}
              onClose={handleCancel}
              footer={
                <>
                  <button className="burst-button burst-button--secondary" onClick={handleCancel}>
                    {__( 'Cancel', 'burst-statistics' )}
                  </button>
                  <button className={'burst-button' + ( 'danger' == field.warnType ? ' burst-button--tertiary' : ' burst-button--primary' )} onClick={handleConfirm}>
                    {__( 'Confirm', 'burst-statistics' )}
                  </button>
                </>
              } />
        </>
    );
  } else {
    return (
        <Hyperlink className="burst-button burst-button--secondary" text={text} disabled={disabled} url={field.url}/>
    );
  }
};
export default ButtonControl;
