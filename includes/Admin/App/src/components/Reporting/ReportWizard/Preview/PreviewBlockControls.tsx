import React from 'react';
import { __ } from '@wordpress/i18n';
import { useWizardStore } from '@/store/reports/useWizardStore';
import { ContentBlockId } from '@/store/reports/types';
import { BlockComment } from './BlockComment';

interface PreviewBlockControlsProps {
    blockId: ContentBlockId;
    reportBlockIndex: number;
    isEditor?: boolean;
    isEditingMode?: boolean;
    isSelected?: boolean;
    children: React.ReactNode;
}

/**
 * Wrapper component for block preview with selection and metadata display.
 */
export const PreviewBlockControls: React.FC<PreviewBlockControlsProps> = ({
    reportBlockIndex,
    isEditingMode = false,
    isSelected = false,
    children
}) => {
    const setSelectedBlockIndex = useWizardStore( ( state ) => state.setSelectedBlockIndex );


    /**
     * Handle block click to select it in editing mode.
     */
    const handleBlockClick = ( e: React.MouseEvent ) => {
        if ( isEditingMode ) {
            e.stopPropagation();
            setSelectedBlockIndex( reportBlockIndex );
        }
    };

    // Non-editing mode: show block with comment.
    if ( ! isEditingMode ) {
        return (
            <div className="mb-4 grid grid-cols-1 md:grid-cols-12 gap-2 mx-auto">
                <div className="md:col-span-7">
                    <div className="group relative p-2 border border-transparent">
                        {children}
                    </div>
                </div>
                <div className="md:col-span-5 flex flex-row items-end gap-2 p-2">
                    <BlockComment reportBlockIndex={reportBlockIndex} isEditingMode={false} />
                </div>
            </div>
        );
    }

    // Editing mode: clickable block with selection state and metadata.
    const blockClassName = isSelected ?
        'border-gray-400' :
        'border-transparent hover:border-gray-300 hover:bg-gray-50/50';

    return (
        <div
            className={`p-1 mb-4 rounded-xl border-2 transition-all duration-200 cursor-pointer  ${blockClassName}`}
            onClick={handleBlockClick}
            role="button"
            tabIndex={0}
            onKeyDown={( e ) => {
                if ( 'Enter' === e.key || ' ' === e.key ) {
                    e.preventDefault();
                    handleBlockClick( e as unknown as React.MouseEvent );
                }
            }}
            aria-pressed={isSelected}
            aria-label={__( 'Select block to edit settings', 'burst-statistics' )}
        >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mx-auto">
                <div className="md:col-span-7">
                    <div className="group relative p-1 border border-transparent">
                        {children}
                    </div>
                </div>
                <div className="md:col-span-5 flex flex-row items-end gap-2 p-1">
                    <BlockComment reportBlockIndex={reportBlockIndex} isEditingMode={false} />
                </div>
            </div>
        </div>
    );
};
