var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import { Component, createElement } from '@wordpress/element';
import PropTypes from 'prop-types';
import { __, sprintf } from '@wordpress/i18n';
var ErrorBoundary = /** @class */ (function (_super) {
    __extends(ErrorBoundary, _super);
    function ErrorBoundary(props) {
        var _this = _super.call(this, props) || this;
        _this.copyToClipboard = function () {
            var errorMessage = "".concat(_this.state.error && _this.state.error.toString(), "\nStack trace: ").concat(_this.state.errorInfo && _this.state.errorInfo.componentStack);
            navigator.clipboard.writeText(errorMessage).then(function () {
                _this.setState({ copied: true });
                setTimeout(function () { return _this.setState({ copied: false }); }, 2000);
            });
        };
        _this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            copied: false
        };
        return _this;
    }
    ErrorBoundary.getDerivedStateFromError = function (error) {
        return {
            hasError: true,
            error: error
        };
    };
    ErrorBoundary.prototype.componentDidCatch = function (error, errorInfo) {
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
        // You can also log the error to an error reporting service
    };
    ErrorBoundary.prototype.render = function () {
        if (this.state.hasError) {
            return createElement('div', { className: 'rounded-md bg-white p-5 text-black shadow-md' }, createElement('h3', { className: 'mb-4 text-xl font-bold text-black' }, __('Uh-oh! We stumbled upon an error.', 'burst-statistics')), createElement('div', { className: 'mb-6 rounded-sm border bg-gray-50 p-4' }, createElement('p', { className: 'mb-2 text-base text-black' }, this.state.error && this.state.error.toString()), createElement('p', { className: 'max-h-48 overflow-x-scroll text-xs text-black' }, 'Stack trace: ' + (this.state.errorInfo && this.state.errorInfo.componentStack)), createElement('button', {
                onClick: this.copyToClipboard,
                className: "mt-4 rounded-md px-4 py-2 font-medium text-white ".concat(this.state.copied ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600', " focus:outline-none focus:ring-2 focus:ring-blue-500")
            }, this.state.copied ? __('Copied', 'burst-statistics') : __('Copy Error', 'burst-statistics'))), createElement('p', { className: 'mb-4 text-black' }, __('We\'re sorry for the trouble. Please take a moment to report this issue on the WordPress forums so we can work on fixing it. Here\'s how you can report the issue:', 'burst-statistics')), createElement('ol', { className: 'list-inside list-decimal space-y-2 text-black' }, createElement('li', null, sprintf(__('Copy the error details by clicking the %s button above.', 'burst-statistics'), '"Copy Error"')), createElement('li', null, createElement('a', {
                href: 'https://wordpress.org/support/plugin/burst-statistics/#new-topic-0',
                className: 'text-blue-600 underline hover:text-blue-800',
                target: '_blank',
                rel: 'noopener noreferrer'
            }, __('Navigate to the Support Forum.', 'burst-statistics'))), createElement('li', null, __('If you haven\'t already, log in to your WordPress.org account or create a new account.', 'burst-statistics')), createElement('li', null, sprintf(__('Once logged in, click on %s under the Burst Statistics forum.', 'burst-statistics'), '"Create Topic"')), createElement('li', null, sprintf(__('Title: Mention %s along with a brief hint of the error.', 'burst-statistics'), '\'Error Encountered\'')), createElement('li', null, __('Description: Paste the copied error details and explain what you were doing when the error occurred.', 'burst-statistics')), createElement('li', null, sprintf(__('Click %s to post your topic. Our team will look into the issue and provide assistance.', 'burst-statistics'), '"Submit"'))));
        }
        return createElement('div', null, this.props.children);
    };
    ErrorBoundary.propTypes = {
        children: PropTypes.node.isRequired
    };
    ErrorBoundary.displayName = 'ErrorBoundary';
    return ErrorBoundary;
}(Component));
export default ErrorBoundary;
