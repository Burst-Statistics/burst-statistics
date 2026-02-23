import { useWizardStore } from '@/store/reports/useWizardStore';
import { useReportConfigStore } from '@/store/reports/useReportConfigStore';
import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import { ContentBlock } from '@/store/reports/types';
import { Reorder } from 'framer-motion';

/**
 * ContentListView displays a list of selected content blocks for the report.
 * Users can reorder, remove, and select content blocks from this view.
 */
export const ContentListView = () => {
	const content = useWizardStore( ( state ) => state.wizard.content );
	const removeContent = useWizardStore( ( state ) => state.removeContent );
	const reorderContent = useWizardStore( ( state ) => state.reorderContent );
	const selectedBlockIndex = useWizardStore( ( state ) => state.selectedBlockIndex );
	const setSelectedBlockIndex = useWizardStore( ( state ) => state.setSelectedBlockIndex );
	const availableContent = useReportConfigStore( ( state ) => state.availableContent );

	/**
	 * Get content item details by block ID.
	 *
	 * @param blockId - The ID of the content block.
	 */
	const getContentItem = ( blockId: string ) => {
		return availableContent.find( ( c ) => c.id === blockId );
	};

	/**
	 * Handle block click to select it.
	 *
	 * @param index - The index of the block to select.
	 */
	const handleBlockClick = ( index: number ) => {
		setSelectedBlockIndex( index );
	};

	if ( 0 === content.length ) {
		return (
			<div className="flex flex-col items-center justify-center py-12 px-6">
				<div className="w-16 h-16 mb-4 flex items-center justify-center rounded-full bg-gray-100">
					<Icon name="file-alt" size={24} className="text-gray-400" />
				</div>
				<p className="text-gray-500 text-center text-sm">
					{__( 'No content selected yet. Add content blocks to get started.', 'burst-statistics' )}
				</p>
			</div>
		);
	}

	return (
		<div className="py-4">
			<Reorder.Group
				axis="y"
				values={content}
				onReorder={reorderContent}
				className="space-y-2"
			>
				{content.map( ( block: ContentBlock, index: number ) => {
					const contentItem = getContentItem( block.id );
					const isSelected = selectedBlockIndex === index;
					const itemClassName = isSelected ?
						'border-gray-400' :
						'border-gray-200 group-hover:border-gray-300';

					return (
						<Reorder.Item
							key={block.id}
							value={block}
							className="group relative"
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -10 }}
							transition={{
								type: 'spring',
								stiffness: 500,
								damping: 35
							}}
							whileDrag={{
								scale: 1.03,
								rotate: 1,
								zIndex: 10,
								boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.2)',
								cursor: 'grabbing'
							}}
							dragTransition={{
								bounceStiffness: 600,
								bounceDamping: 20
							}}
							style={{
								cursor: 'grab'
							}}
						>
							<div
								className={`flex items-center gap-3 p-4 bg-white rounded-lg border-2 transition-colors cursor-pointer ${itemClassName}`}
								onClick={() => handleBlockClick( index )}
								role="button"
								tabIndex={0}
								onKeyDown={( e ) => {
									if ( 'Enter' === e.key || ' ' === e.key ) {
										e.preventDefault();
										handleBlockClick( index );
									}
								}}
								aria-pressed={isSelected}
								aria-label={__( 'Select block', 'burst-statistics' )}
							>
								{/* Drag handle visual indicator. */}
								<div className="flex items-center gap-1 opacity-30 group-hover:opacity-60 transition-colors touch-none">
									<Icon name="grip-vertical" size={16} color="black" />
								</div>

								{/* Content icon. */}
								{contentItem?.icon && (
									<div className="flex-shrink-0 text-gray-600">
										<Icon name={contentItem.icon} size={18} />
									</div>
								)}

								{/* Content label. */}
								<div className="flex-1 flex items-center gap-2">
									<span className="text-sm text-gray-700">
										{contentItem?.label || block.id}
									</span>
									{( block.comment_title || block.comment_text ) && (
										<span className="text-xs text-gray-400 italic" title={block.comment_text}>
											{__( '(has comment)', 'burst-statistics' )}
										</span>
									)}
								</div>

								{/* Remove button. */}
								<button
									type="button"
									onClick={( e ) => {
										e.stopPropagation();
										removeContent( index );
									}}
									className="p-2 rounded-md hover:bg-red-50 text-gray-600 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100 focus:ring-2 focus:ring-red-500 focus:ring-inset focus:opacity-100"
									aria-label={__( 'Remove', 'burst-statistics' )}
									title={__( 'Remove', 'burst-statistics' )}
								>
									<Icon name="trash" size={14} />
								</button>
							</div>
						</Reorder.Item>
					);
				})}
			</Reorder.Group>

			{/* Count summary. */}
			<div className="mt-6 pt-4 border-t border-gray-200">
				<p className="text-xs text-gray-500 text-center">
					{content.length} {1 === content.length ?
						__( 'content block', 'burst-statistics' ) :
						__( 'content blocks', 'burst-statistics' )}
				</p>
			</div>
		</div>
	);
};
