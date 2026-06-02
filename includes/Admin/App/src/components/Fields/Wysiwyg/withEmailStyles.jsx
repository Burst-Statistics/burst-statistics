/**
 * HOC that injects burst email styling into a TinyMCE-based field component.
 * Loads `assets/css/email.css` into the editor iframe so its content renders
 * identically to the sent email, and flags `emailMode` so the field applies
 * email-specific dark-mode wiring.
 */

const CONTENT_STYLE = `
	.burst-button[data-mce-selected] {
		padding: 16px 24px !important;
		margin: 0 !important;
		box-shadow: none !important;
	}
	body.is-disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
`;

const CONTENT_CSS = ( () => {
	const pluginUrl = window.burst_settings?.plugin_url;
	return pluginUrl ? [ `${ pluginUrl }assets/css/email.css` ] : [];
})();

const withEmailStyles = ( WrappedComponent ) => {
	const WithEmailStyles = ( props ) => (
		<WrappedComponent
			{ ...props }
			contentCss={ CONTENT_CSS }
			contentStyle={ CONTENT_STYLE }
			emailMode={ true }
		/>
	);

	const wrappedName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
	WithEmailStyles.displayName = `withEmailStyles(${ wrappedName })`;

	return WithEmailStyles;
};

export default withEmailStyles;
