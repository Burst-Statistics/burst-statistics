import { Component } from 'react';
import PropTypes from 'prop-types';
import { __, sprintf } from '@wordpress/i18n';

class ErrorBoundary extends Component {
  constructor( props ) {
    super( props );
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    };
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
    navigator.clipboard.writeText(
      `${this.state.error && this.state.error.toString()}\nStack trace: ${this.state.errorInfo && this.state.errorInfo.componentStack}`
    );
    this.setState({ copied: true });
  }

  render() {
    if ( this.state.hasError ) {
      return (
        <div className="rounded-md bg-white p-5 text-black shadow-sm">
          <h3 className="mb-4 text-xl font-bold text-black">
            {__( 'Uh-oh! We stumbled upon an error.', 'burst-statistics' )}
          </h3>
          <div className="mb-6 rounded-sm border bg-gray-50 p-4">
            <p className="mb-2 text-base text-black">
              {this.state.error && this.state.error.toString()}
            </p>
            <p className="max-h-48 overflow-x-scroll text-xs text-black">
              Stack trace:{' '}
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </p>
            <button
              className={`mt-4 rounded-md px-4 py-2 font-medium text-white ${this.state.copied ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              onClick={this.copyError}
            >
              {this.state.copied ?
                __( 'Copied', 'burst-statistics' ) :
                __( 'Copy Error', 'burst-statistics' )}
            </button>
          </div>
          <p className="mb-4 text-black">
            {__(
              'We\'re sorry for the trouble. Please take a moment to report this issue on the WordPress forums so we can work on fixing it. Here’s how you can report the issue:',
              'burst-statistics'
            )}
          </p>
          <ol className="list-inside list-decimal space-y-2 text-black">
            <li>
              {sprintf(
                __(
                  'Copy the error details by clicking the %s button above.',
                  'burst-statistics'
                ),
                '"Copy Error"'
              )}
            </li>
            <li>
              <a
                href="https://wordpress.org/support/plugin/burst-statistics/#new-topic-0"
                className="text-blue-600 underline hover:text-blue-800"
              >
                {__( 'Navigate to the Support Forum.', 'burst-statistics' )}
              </a>
            </li>
            <li>
              {__(
                'If you haven’t already, log in to your WordPress.org account or create a new account.',
                'burst-statistics'
              )}
            </li>
            <li>
              {sprintf(
                __(
                  'Once logged in, click on %s under the Burst Statistics forum.',
                  'burst-statistics'
                ),
                '"Create Topic"'
              )}
            </li>
            <li>
              {sprintf(
                __(
                  'Title: Mention %s along with a brief hint of the error.',
                  'burst-statistics'
                ),
                '\'Error Encountered\''
              )}
            </li>
            <li>
              {__(
                'Description: Paste the copied error details and explain what you were doing when the error occurred.',
                'burst-statistics'
              )}
            </li>
            <li>
              {sprintf(
                __(
                  'Click %s to post your topic. Our team will look into the issue and provide assistance.',
                  'burst-statistics'
                ),
                '"Submit"'
              )}
            </li>
          </ol>
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

ErrorBoundary.displayName = 'ErrorBoundary';

export default ErrorBoundary;
