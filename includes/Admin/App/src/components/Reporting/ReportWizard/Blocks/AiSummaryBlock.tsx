import React from 'react';
import { __ } from '@wordpress/i18n';
import { useTheme } from '@/hooks/useTheme';
import WysiwygPreview from '@/components/Common/WysiwygPreview';
import { BlockComponentProps } from '@/store/reports/types';
import { useReportBlockEditor } from './blockHooks';
import { useAiSummaryAvailability } from '@/hooks/useChatAvailability';
import { useWizardStore } from '@/store/reports/useWizardStore';
import Icon from '@/utils/Icon';

const AiSummaryAlert: React.FC<{ type: 'amber' | 'red'; message: string }> = ({ type, message }) => {
	const colorClasses = 'amber' === type ?
		'border-amber-300 bg-amber-50! text-amber-900 dark:border-amber-700 dark:bg-amber-900/20! dark:text-amber-100' :
		'border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-900/20 dark:text-red-100';

	return (
		<div className={`mb-4 p-3 rounded-lg border text-xs flex items-start gap-2 ${ colorClasses }`}>
			<Icon name="alert" size={ 16 } className="shrink-0 mt-0.5" />
			<span>{ message }</span>
		</div>
	);
};

// fallow-ignore-next-line complexity
const AiSummaryBlock: React.FC<BlockComponentProps> = ({ reportBlockIndex = 0 }) => {
	const { isEditingMode, content } = useReportBlockEditor({
		reportBlockIndex,
		fieldName: 'ai_summary'
	});
	const { isDarkTheme } = useTheme();
	const { isDisabled, disabledReason } = useAiSummaryAvailability();
	const storedAiSummary = useWizardStore( ( state ) => state.wizard.ai_summary ?? '' );

	// Prefer block-level content (editable comment), then fall back to stored server summary.
	const summaryText = content || storedAiSummary;

	if ( ! isEditingMode && ! summaryText ) {
		return null;
	}

	return (
		<div className="w-full mb-6 burst-story-content-width">
			<div className="p-6 rounded-xl border border-gray-200 bg-white shadow-xs transition-all">
				<div className="flex items-center gap-2 mb-4">
					<div className="p-1.5 rounded-lg bg-primary-50 text-green">
						<Icon name="sparkles" size={ 18 } />
					</div>
					<h3 className="text-base font-semibold text-text-black">
						{ __( 'Summary', 'burst-statistics' ) }
					</h3>
				</div>

				{ isEditingMode && isDisabled && <AiSummaryAlert type="amber" message={ disabledReason } /> }

				{ summaryText ? (
					<div className={`prose prose-sm max-w-none ${ isDarkTheme ? 'prose-invert' : '' }`}>
						<WysiwygPreview html={ summaryText } isDark={ isDarkTheme } />
					</div>
				) : isEditingMode ? (
					<div className="py-4 text-center">
						<p className="text-sm text-text-gray">
							{ __( 'An executive summary will be generated automatically from your site\'s statistics for each report.', 'burst-statistics' ) }
						</p>
					</div>
				) : null }

				{ isEditingMode && summaryText && (
					<p className="mt-4 text-xs text-text-gray-light flex items-center gap-1.5 border-t border-gray-100 pt-3">
						<Icon name="info" size={ 14 } className="shrink-0" />
						<span>
							{ __( 'This summary is a preview based on recent data. A fresh summary will be generated automatically for each scheduled report timeframe.', 'burst-statistics' ) }
						</span>
					</p>
				) }
			</div>
		</div>
	);
};

AiSummaryBlock.displayName = 'AiSummaryBlock';
export default AiSummaryBlock;
