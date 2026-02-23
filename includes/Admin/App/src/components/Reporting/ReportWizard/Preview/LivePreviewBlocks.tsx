import React, { useEffect, useRef } from 'react';
import { __ } from '@wordpress/i18n';
import { AnimatePresence } from 'framer-motion';

import { useWizardStore } from '@/store/reports/useWizardStore';
import { useReportConfigStore } from '@/store/reports/useReportConfigStore';
import MemoizedBlock from './MemoizedBlock';
import { BlockSettingsSidebar } from './BlockSettingsSidebar';

export const LivePreviewBlocks = ({ className }: { className?: string }) => {
    const contents = useWizardStore( ( state ) => state.wizard.content );
    const { getStartDate, getEndDate, getFilters, isEditingMode } = useWizardStore( ( state ) => state );
    const selectedBlockIndex = useWizardStore( ( state ) => state.selectedBlockIndex );
    const setSelectedBlockIndex = useWizardStore( ( state ) => state.setSelectedBlockIndex );
    const availableContent = useReportConfigStore( ( state ) => state.availableContent );
    const containerRef = useRef<HTMLDivElement>( null );
    const previewRef = useRef<HTMLDivElement>( null );
    const previousContentLengthRef = useRef( contents.length );

    const hasSidebar = isEditingMode && null !== selectedBlockIndex;

    /**
     * Auto-scroll to bottom when a new block is added.
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
     * Handle click on preview area to deselect block.
     */
    const handlePreviewClick = ( e: React.MouseEvent<HTMLDivElement> ) => {

        // Only deselect if clicking directly on the preview container, not on a block.
        if ( e.target === e.currentTarget || ( e.target as HTMLElement ).closest( '[data-preview-container]' ) === e.currentTarget ) {
            setSelectedBlockIndex( null );
        }
    };

    return (
        <div ref={containerRef} className={`flex h-full ${className || ''}`}>
            {/* Preview content area. */}
            <div
                ref={previewRef}
                data-preview-container
                className={'flex-1 overflow-y-auto burst-scroll py-4 px-6 transition-all duration-300'}
                onClick={handlePreviewClick}
            >
                {
                    contents.map( ( block, reportBlockIndex ) => {
                        const blockConfig = availableContent.find( ( item ) => item.id === block.id );
                        if ( ! blockConfig?.component ) {
                            return null;
                        }

                        return (
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
                    })
                }

                {
                    0 === contents.length && (
                        <p className="text-gray-500 text-center">
                            {__( 'Select content to see preview', 'burst-statistics' )}
                        </p>
                    )
                }
            </div>

            {/* Block settings sidebar. */}
            <AnimatePresence>
                {hasSidebar && (
                    <BlockSettingsSidebar reportBlockIndex={selectedBlockIndex} />
                )}
            </AnimatePresence>
        </div>
    );
};
