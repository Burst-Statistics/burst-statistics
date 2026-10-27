import { registerPlugin } from '@wordpress/plugins';
import { PostStatisticsPanel } from '@/components/Editor/PostStatisticsPanel';

// Register plugin with Gutenberg (renders only PluginDocumentSettingPanel, no top-bar icon or sidebar)
registerPlugin( 'burst-statistics-editor', {
	render: PostStatisticsPanel
});
