import { useTheme } from '@/hooks/useTheme';

const EMPTY_CONTENT_CSS = [];

const buildContentStyle = ( isDark ) => `
	body {
		font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
		font-size: 14px;
		line-height: 1.6;
		padding: 12px;
		margin: 0;
		background-color: ${ isDark ? '#1e1f26' : '#fff' };
		color: ${ isDark ? 'rgba(255,255,255,0.9)' : 'rgba(32,32,32,0.9)' };
	}
	p { margin: 0 0 10px 0; }
	ul { list-style: disc; padding-left: 24px; margin: 0 0 10px; }
	ol { list-style: decimal; padding-left: 24px; margin: 0 0 10px; }
	li { margin: 0; }
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

const withAdminStyles = ( WrappedComponent ) => {
	const WithAdminStyles = ( props ) => {
		const { isDarkTheme } = useTheme();
		return (
			<WrappedComponent
				{ ...props }
				contentCss={ EMPTY_CONTENT_CSS }
				contentStyle={ buildContentStyle( isDarkTheme ) }
			/>
		);
	};

	const wrappedName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
	WithAdminStyles.displayName = `withAdminStyles(${ wrappedName })`;
	return WithAdminStyles;
};

export default withAdminStyles;
