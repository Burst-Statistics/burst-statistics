import { Component  } from '@wordpress/element';
import PropTypes from 'prop-types';
import { __, sprintf } from '@wordpress/i18n';
import { burst_get_website_url } from '../utils/lib';

class ErrorBoundary extends Component {
  constructor( props ) {
    super( props );
    this.state = { hasError: false, error: null, errorInfo: null, copied: false };
    this.resetError = this.resetError.bind( this );
    this.copyError = this.copyError.bind( this );
  }

  static getDerivedStateFromError( error ) {
    return { hasError: true };
  }

  componentDidCatch( error, errorInfo ) {
    this.setState({ error, errorInfo });

    // You can also log the error to an error reporting service
  }

  resetError() {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  copyError() {
    navigator.clipboard.writeText( `${this.state.error && this.state.error.toString()}\nStack trace: ${this.state.errorInfo && this.state.errorInfo.componentStack}` );
    this.setState({ copied: true });
  }

  render() {
    if ( this.state.hasError ) {
      return (
          <div className={'burst-error-boundary'}>
            <h3>{__( 'Uh-oh! We stumbled upon an error.', 'burst-statistics' )}</h3>
            <div className={'burst-error-boundary__copy-error'} >
              <p className={'burst-error-boundary__error-code'}>{this.state.error && this.state.error.toString()}</p>
              <p className={'burst-error-boundary__error-stack'}>Stack trace: {this.state.errorInfo && this.state.errorInfo.componentStack}</p>
              <button className={'burst-button burst-button--secondary'} onClick={this.copyError}>
                {this.state.copied ? __( 'Copied', 'burst-statistics' ) : __( 'Copy Error', 'burst-statistics' )}
              </button>
            </div>

            { burst_settings.is_pro ? (
                <>
                  <p>{__( 'We apologize for the inconvenience. As a valued Burst Pro user, we are here to assist you. Please follow the steps below to report this issue:', 'burst-statistics' )}</p>
                  <ol>
                    <li>{sprintf( __( 'Copy the error details by clicking the %s button above.', 'burst-statistics' ), '"Copy Error"' )}</li>
                    <li>
                      <a href={burst_get_website_url( 'support', {
                      burst_source: 'error-boundary',
                      burst_content: 'support'
                    })} target="_blank" rel="noreferrer">
                    {__( 'Visit our support page.', 'burst-statistics' )}
                    </a></li>
                    <li>{sprintf( __( 'Under %s, provide your Name, Email, Website, and License details.', 'burst-statistics' ), '"Log a Support Ticket"' )}</li>
                    <li>{sprintf( __( 'In the %s field, paste the copied error details and describe what you were doing when the error occurred.', 'burst-statistics' ), '"What\'s the problem?"' )}</li>
                    <li>{sprintf( __( 'If possible, attach any relevant files.', 'burst-statistics' ) )}</li>
                    <li>{sprintf( __( 'Click %s to send your support request. We strive to reply to all support tickets within 24 hours, and within 48 hours during weekends.', 'burst-statistics' ), '"Submit"' )}</li>
                  </ol>
                </>
            ) : (
                <>
                  <p>{__( 'We\'re sorry for the trouble. Please take a moment to report this issue on the WordPress forums so we can work on fixing it. Here’s how you can report the issue:', 'burst-statistics' )}</p>
                  <ol>
                    <li>{sprintf( __( 'Copy the error details by clicking the %s button above.', 'burst-statistics' ), '"Copy Error"' )}</li>
                    <li><a href="https://wordpress.org/support/plugin/burst-statistics/#new-topic-0">{__( 'Navigate to the Support Forum.', 'burst-statistics' )}</a></li>
                    <li>{sprintf( __( 'If you haven’t already, log in to your WordPress.org account or create a new account.', 'burst-statistics' ) )}</li>
                    <li>{sprintf( __( 'Once logged in, click on %s under the Burst Statistics forum.', 'burst-statistics' ), '"Create Topic"' )}</li>
                    <li>{sprintf( __( 'Title: Mention %s along with a brief hint of the error.', 'burst-statistics' ), '\'Error Encountered\'' )}</li>
                    <li>{sprintf( __( 'Description: Paste the copied error details and explain what you were doing when the error occurred.', 'burst-statistics' ) )}</li>
                    <li>{sprintf( __( 'Click %s to post your topic. Our team will look into the issue and provide assistance.', 'burst-statistics' ), '"Submit"' )}</li>
                  </ol>
                </>
            )}
          </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node,
  fallback: PropTypes.node
};

export default ErrorBoundary;
