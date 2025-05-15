import {Button, TextareaControl} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import {
  Component,
  useRef,
  useState
} from '@wordpress/element';


class IpBlock extends Component {
  constructor( props ) {
    super( props );

    // set state warning
    this.onClickAddIPHandler = this.onClickAddIPHandler.bind( this );
    this.state = {
      warning: false
    };
  }


  onClickAddIPHandler( e ) {
    let input = document.getElementById( 'ip_address' );
    let inputValue = input.value;
    let ip = burst_settings.current_ip;

    if ( inputValue.includes( ip ) ) {
      this.setState({warning: __( 'Your IP address is:', 'burst-statistics' ) + ' \'' +  ip + '\'. ' + __( 'Which is already in the list.', 'burst-statistics' )});

      // set time out and remove warning
      setTimeout( () => {
        this.setState({warning: false});
      }, 5000 );
      return;
    }
    if ( ip ) {
      if ( inputValue ) {

        // update value for input
        inputValue += '\n' + ip;
      } else {
        inputValue = ip;
      }
    }
    input.value = inputValue;
    this.props.onChangeHandler( inputValue );
  }

  render() {
    let field = this.props.field;
    let fieldValue = field.value;
    let fields = this.props.fields;


    return (
        <>
          <TextareaControl
              label={field.label}
              help={field.comment}
              placeholder={'127.0.0.1\n192.168.0.1'}
              value={fieldValue}
              onChange={( fieldValue ) => this.props.onChangeHandler( fieldValue )}
              id="ip_address"
          />
          <Button className="burst-button burst-button--secondary button-add-ip"
                  onClick={this.onClickAddIPHandler}>{__( 'Add current IP address',
              'burst-statistics' )}</Button>
          { false !== this.state.warning && <div className="burst-warning">{this.state.warning}</div> }
          </>
    );

  }
}

export default IpBlock;
