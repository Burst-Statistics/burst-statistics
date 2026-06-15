import React, { useEffect, useRef } from 'react';
import { __ } from '@wordpress/i18n';
import { AnimatePresence } from 'framer-motion';

import { useWizardStore } from '@/store/reports/useWizardStore';
import { useReportConfigStore } from '@/store/reports/useReportConfigStore';
import MemoizedBlock from './MemoizedBlock';
import { BlockSettingsSidebar } from './BlockSettingsSidebar';
import useSettingsData from '@/hooks/useSettingsData';

export const LivePreviewBlocks = ({ className }: { className?: string }) => {
	const contents = useWizardStore( ( state ) => state.wizard.content );
	const { getStartDate, getEndDate, getFilters, isEditingMode } = useWizardStore( ( state ) => state );
	const selectedBlockIndex = useWizardStore( ( state ) => state.selectedBlockIndex );
	const setSelectedBlockIndex = useWizardStore( ( state ) => state.setSelectedBlockIndex );
	const availableContent = useReportConfigStore( ( state ) => state.availableContent );
	const { getValue } = useSettingsData();
	const brandColor: string = getValue( 'brand_color' );
	const customCss: string = getValue( 'custom_css' );
	const containerRef = useRef<HTMLDivElement>( null );
	const previewRef = useRef<HTMLDivElement>( null );
	const previousContentLengthRef = useRef( contents.length );

	const hasSidebar = isEditingMode && null !== selectedBlockIndex;

	/**
	 * Auto-scroll to the bottom when a new block is added.
	 */
	useEffect( () => {
		if ( contents.length > previousContentLengthRef.current && previewRef.current ) {
			previewRef.current.scrollTo({
				top: previewRef.current.scrollHeight,
				behavior: 'smooth'
			});
		}
		previousContentLengthRef.current = contents.length;
	}, [ contents.length ]);

	/**
	 * Handle click on the preview area to deselect the block.
	 */
	const handlePreviewClick = ( e: React.MouseEvent<HTMLDivElement> ) => {

		// Only deselect if clicking directly on the preview container, not on a block.
		if ( e.target === e.currentTarget || ( e.target as HTMLElement ).closest( '[data-preview-container]' ) === e.currentTarget ) {
			setSelectedBlockIndex( null );
		}
	};

	return (
		<div ref={containerRef} className={`burst-story-preview-container flex h-full ${className || ''}`}>
            {/* Preview content area. */}
			<div
				ref={previewRef}
				data-preview-container
				className='burst-story-page flex-1 overflow-y-auto burst-scroll transition-all duration-300'
				onClick={handlePreviewClick}
			>
                { customCss && <style>{customCss}</style> }

                {
					brandColor && (
						<div style={{ backgroundColor: brandColor, height: '13px' }} className="w-full" />
					)
				}

				<div className="px-6">
                    {
						contents.map( ( block, reportBlockIndex ) => {
							const blockConfig = availableContent.find( ( item ) => item.id === block.id );

							if ( ! blockConfig?.component ) {
								return null;
							}

							const memoizedBlock = (
								<MemoizedBlock
									isEditingMode={isEditingMode}
									key={`${block.id}-${reportBlockIndex}`}
									block={block}
									reportBlockIndex={reportBlockIndex}
									blockConfig={blockConfig}
									startDate={getStartDate( reportBlockIndex )}
									endDate={getEndDate( reportBlockIndex )}
									filters={getFilters( reportBlockIndex )}
									isSelected={selectedBlockIndex === reportBlockIndex}
								/>
							);

							// Hero and text blocks are edge-to-edge in the preview pane; cancel the px-6 of the inner wrapper.
							if ( 'hero' === block.id || 'text_block' === block.id || 'footer' === block.id ) {
								return (
									<div key={`${block.id}-${reportBlockIndex}-wrap`} className="-mx-6">
                                        {memoizedBlock}
									</div>
								);
							}

							return memoizedBlock;
						})
					}

					{
						0 === contents.length && (
							<p className="text-text-gray-light text-center">
                            {__( 'Select content to see preview', 'burst-statistics' )}
                        </p>
						)
					}

                </div>

				{
					brandColor && (
						<div style={{ backgroundColor: brandColor, height: '68px' }} className="w-full" />
					)
				}
            </div>

			{/* Block settings sidebar. */}
			<AnimatePresence>
                {
					hasSidebar && (
						<BlockSettingsSidebar reportBlockIndex={selectedBlockIndex} />
					)
				}
            </AnimatePresence>
        </div>
	);
};
