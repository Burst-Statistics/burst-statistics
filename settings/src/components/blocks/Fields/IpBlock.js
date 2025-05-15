import {Button, TextareaControl} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import {
  useState
} from '@wordpress/element';
import InputWarning from '../../common/InputWarning';

const IpBlock = ({value, onChange, label, comment}) => {
  const [ warning, setWarning ] = useState( false );
  const fieldValue = value;
  const ip = burst_settings.current_ip;

  const checkInputForWarnings = ( fieldValue ) => {
    const ipList = fieldValue.split( '\n' );
    const ipSet = new Set();

    for ( let i = 0; i < ipList.length; i++ ) {
      if ( ipSet.has( ipList[i]) ) {
        setWarning( `Duplicate IP address found: ${ipList[i]}` );
        return;
      } else {
        ipSet.add( ipList[i]);
      }
    }

    setWarning( false );
  };

  const onChangeIpHandler = ( fieldValue ) => {
    onChange( fieldValue );
    checkInputForWarnings( fieldValue );
  };


  const onClickAddIPHandler = () => {
    const ipList = fieldValue.split( '\n' );

    if ( ipList.includes( ip ) ) {
      setWarning( 'Your IP is already in the list.' );
    } else {
      let updatedIPList = fieldValue;
      updatedIPList += updatedIPList ? `\n${ip}` : ip;
      onChange( updatedIPList );
      setWarning( false );
    }
  };

  return (
      <>
        <TextareaControl
            label={label}
            help={comment}
            placeholder={'127.0.0.1\n192.168.0.1'}
            value={fieldValue}
            onChange={( fieldValue ) => onChangeIpHandler( fieldValue )}
            id="ip_address"
        />
        <Button
            className="burst-button burst-button--secondary button-add-ip"
            onClick={onClickAddIPHandler}
            disabled={fieldValue.includes( ip )}
        >
          {__( 'Add current IP address', 'burst-statistics' )}
        </Button>
        {warning && (
            <InputWarning
                message={warning}
                onTimeout={() => setWarning( false )}
            />
        )}
      </>
  );
};

export default IpBlock;
