import React from 'react';
import StoryContentSelection from '@/components/Reporting/ReportWizard/StoryContentSelection';
import { ContentListView } from '@/components/Reporting/ReportWizard/ContentListView';
import { TabsContent, TabsList } from '@/components/Common/Tabs';
import { __ } from '@wordpress/i18n';

/**
 * Step 2: Content - Story report content block selection.
 * Includes tabs for adding content and managing the list view with reordering.
 */
export const StepContentStory: React.FC = () => {
	return (
		<div className="px-6 py-2">
			<TabsList
				className="sticky top-0 z-10"
				tabConfig={[
					{ id: 'add-content', title: __( 'Add content', 'burst-statistics' )},
					{ id: 'list-view', title: __( 'List view', 'burst-statistics' ) }
				]}
				tabGroup="report-wizard-content"
			/>

			<TabsContent group="report-wizard-content" id="add-content">
				<StoryContentSelection />
			</TabsContent>
			<TabsContent group="report-wizard-content" id="list-view">
				<ContentListView />
			</TabsContent>
		</div>
	);
};
