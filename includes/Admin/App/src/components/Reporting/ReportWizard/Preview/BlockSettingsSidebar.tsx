import React, { useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/reports/useWizardStore';
import { useReportConfigStore } from '@/store/reports/useReportConfigStore';
import Icon from '@/utils/Icon';
import SwitchInput from '@/components/Inputs/SwitchInput';
import { DateRangePicker } from '@/components/Inputs/DateRangePicker';
import TextInput from '@/components/Inputs/TextInput';
import { PageFilter } from '@/components/Filters/PageFilter';
import clsx from 'clsx';

interface BlockSettingsSidebarProps {
	reportBlockIndex: number;
	className?: string;
}

/**
 * Sidebar component for editing block settings in the report editor.
 * Displays block title, date range, filters, comments, and action buttons.
 */
export const BlockSettingsSidebar: React.FC<BlockSettingsSidebarProps> = ({ reportBlockIndex, className }) => {
	const contents = useWizardStore( ( state ) => state.wizard.content );
	const block = contents[reportBlockIndex];
	const availableContent = useReportConfigStore( ( state ) => state.availableContent );
	const blockConfig = availableContent.find( ( item ) => item.id === block?.id );

	// Store actions.
	const removeContent = useWizardStore( ( state ) => state.removeContent );
	const moveContentUp = useWizardStore( ( state ) => state.moveContentUp );
	const moveContentDown = useWizardStore( ( state ) => state.moveContentDown );
	const setSelectedBlockIndex = useWizardStore( ( state ) => state.setSelectedBlockIndex );

	// Date range.
	const blockDateRangeEnabled = useWizardStore( ( state ) => state.blockDateRangeEnabled );
	const toggleBlockDateRangeEnabled = useWizardStore( ( state ) => state.toggleBlockDateRangeEnabled );
	const setDateRange = useWizardStore( ( state ) => state.setDateRange );
	const getParsedDateRangeValue = useWizardStore( ( state ) => state.getParsedDateRangeValue );
	const dateRange = useWizardStore( ( state ) => state.getDateRange( reportBlockIndex ) );

	// Comment.
	const updateCommentTitle = useWizardStore( ( state ) => state.updateCommentTitle );
	const updateCommentText = useWizardStore( ( state ) => state.updateCommentText );
	const commentTitle = block?.comment_title ?? '';
	const commentText = block?.comment_text ?? '';

	const parsedDateRangeValue = useMemo( () => {
		return getParsedDateRangeValue( dateRange );
	}, [ dateRange, getParsedDateRangeValue ]);

	const totalBlocks = contents.length;
	const blockPosition = reportBlockIndex + 1;
	const blockLabel = blockConfig?.label || block?.id || __( 'Block', 'burst-statistics' );

	/**
	 * Handle block deletion and close sidebar.
	 */
	const handleDelete = () => {
		removeContent( reportBlockIndex );
		setSelectedBlockIndex( null );
	};

	/**
	 * Handle date range change.
	 */
	const handleDateRangeChange = ( range: string, startDate: string, endDate: string ) => {

		// For custom ranges, encode as 'custom:startDate:endDate'.
		const rangeValue = 'custom' === range ?
			`custom:${startDate}:${endDate}` :
			range;
		setDateRange( rangeValue, reportBlockIndex );
	};

	if ( ! block ) {
		return null;
	}
console.log( 'block ', block );
	return (
		<motion.div
			initial={{ opacity: 0, x: 20 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: 20 }}
			transition={{ duration: 0.2, ease: 'easeOut' }}
			className={clsx(
				'w-[35%] min-w-[280px] max-w-[360px] h-full border-l border-gray-300 bg-white flex flex-col overflow-hidden',
				className
			)}
			onClick={( e ) => e.stopPropagation()}
		>
			{/* Header. */}
			<div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
				<div className="flex items-center gap-2">
					{blockConfig?.icon && (
						<Icon name={blockConfig.icon} size={16} className="text-gray-600" />
					)}
					<span className="font-semibold text-sm text-gray-800">{blockLabel}</span>
				</div>
				<span className="text-xs text-gray-500">
					{__( 'Block', 'burst-statistics' )} {blockPosition} {__( 'of', 'burst-statistics' )} {totalBlocks}
				</span>
			</div>

			{/* Scrollable content. Controls not needed for logo block.	 */}
			{'logo' !== block.id &&
				<div className="flex-1 overflow-y-auto p-4 space-y-6">
				{/* Date Range Section. */}
				<div className="space-y-3">
					<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
						{__( 'Date Range', 'burst-statistics' )}
					</h4>
					<div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
						<label className="text-sm text-gray-700">
							{__( 'Custom date range', 'burst-statistics' )}
						</label>
						<SwitchInput
							onChange={() => toggleBlockDateRangeEnabled( reportBlockIndex )}
							value={blockDateRangeEnabled( reportBlockIndex )}
						/>
					</div>
					{blockDateRangeEnabled( reportBlockIndex ) && (
						<div className="mt-2">
							<DateRangePicker
								value={parsedDateRangeValue}
								align="start"
								onChange={handleDateRangeChange}
								smallLabels={true}
							/>
						</div>
					)}
					{! blockDateRangeEnabled( reportBlockIndex ) && (
						<p className="text-xs text-gray-500">
							{__( 'Using report default date range.', 'burst-statistics' )}
						</p>
					)}
				</div>

				{/* Filters Section. */}
				<div className="space-y-3">
					<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
						{__( 'Filters', 'burst-statistics' )}
					</h4>
					<div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
						<PageFilter reportBlockIndex={reportBlockIndex} smallLabels={true} />
					</div>
				</div>

				{/* Comment Section. */}
				<div className="space-y-3">
					<h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
						{__( 'Comment', 'burst-statistics' )}
					</h4>
					<div className="space-y-2">
						<TextInput
							value={commentTitle}
							onChange={( e ) => updateCommentTitle( reportBlockIndex, e.target.value )}
							placeholder={__( 'Comment title (optional)', 'burst-statistics' )}
							className="text-sm"
						/>
						<textarea
							value={commentText}
							onChange={( e ) => updateCommentText( reportBlockIndex, e.target.value )}
							placeholder={__( 'Add your insights or comments about this data...', 'burst-statistics' )}
							className="w-full min-h-[80px] p-2 text-sm text-gray-600 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
							rows={3}
						/>
						<p className="text-xs text-gray-500">
							{__( 'This comment will appear next to the block in the report.', 'burst-statistics' )}
						</p>
					</div>
				</div>
			</div>
			}
			{/* Action buttons footer. */}
			<div className="border-t border-gray-200 p-4 bg-gray-50">
				<div className="flex items-center justify-between">
					{/* Move buttons. */}
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={() => moveContentUp( reportBlockIndex )}
							className="p-2 rounded-md hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-all focus:ring-2 focus:ring-gray-400 focus:ring-inset"
							aria-label={__( 'Move block up', 'burst-statistics' )}
							title={__( 'Move block up', 'burst-statistics' )}
						>
							<Icon name="chevron-up" size={16} />
						</button>
						<button
							type="button"
							onClick={() => moveContentDown( reportBlockIndex )}
							className="p-2 rounded-md hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-all focus:ring-2 focus:ring-gray-400 focus:ring-inset"
							aria-label={__( 'Move block down', 'burst-statistics' )}
							title={__( 'Move block down', 'burst-statistics' )}
						>
							<Icon name="chevron-down" size={16} />
						</button>
					</div>

					{/* Delete button. */}
					<button
						type="button"
						onClick={handleDelete}
						className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-all focus:ring-2 focus:ring-red-500 focus:ring-inset"
						aria-label={__( 'Delete block', 'burst-statistics' )}
					>
						<Icon name="trash" size={14} />
						<span>{__( 'Delete', 'burst-statistics' )}</span>
					</button>
				</div>
			</div>
		</motion.div>
	);
};
