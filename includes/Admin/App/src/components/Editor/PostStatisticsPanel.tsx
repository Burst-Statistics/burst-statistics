import React from 'react';
import { __ } from '@wordpress/i18n';
import { PluginDocumentSettingPanel } from '@wordpress/editor';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { EditorIcon } from './EditorIcon';
import { PostStatisticsPanelContent } from './PostStatisticsPanelContent';

// Dedicated QueryClient instance for Gutenberg editor context
const editorQueryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			staleTime: 60 * 1000,
			retry: 1
		}
	}
});

/**
 * Main per-page statistics panel embedded into the Gutenberg block editor Document/Post sidebar.
 *
 * Registered via PluginDocumentSettingPanel.
 *
 * @return Document setting panel component.
 */
export const PostStatisticsPanel: React.FC = () => {
	const panelTitle = (
		<span
			className="burst-panel-header-title"
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				gap: '8px',
				verticalAlign: 'middle',
				lineHeight: '1.4'
			}}
		>
			<EditorIcon
				size={ 18 }
				strokeWidth={ 2.5 }
				style={{
					color: '#16a34a',
					display: 'inline-block',
					flexShrink: 0
				}}
				className="burst-panel-header-icon text-green-600 shrink-0"
			/>
			<span>{ __( 'Statistics', 'burst-statistics' ) }</span>
		</span>
	);

	return (
		<PluginDocumentSettingPanel
			name="burst-statistics-panel"
			title={ panelTitle }
			className="burst-editor-setting-panel"
		>
			<QueryClientProvider client={ editorQueryClient }>
				<div className="burst font-sans text-text-black" style={{ containerType: 'inline-size' }}>
					<PostStatisticsPanelContent />
				</div>
			</QueryClientProvider>
		</PluginDocumentSettingPanel>
	);
};
