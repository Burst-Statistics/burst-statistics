import { BlockComponentProps, ContentBlock, ContentBlockId, ContentItem } from '@/store/reports/types';
import { PreviewBlockControls } from '@/components/Reporting/ReportWizard/Preview/PreviewBlockControls';
import React, { useMemo } from 'react';
import { FilterSearchParams } from '@/config/filterConfig';

const MemoizedBlock = React.memo<{
    block: ContentBlock;
    reportBlockIndex: number;
    blockConfig: ContentItem;
    startDate: string;
    endDate: string;
    filters: FilterSearchParams;
    isEditingMode: boolean;
    isSelected?: boolean;
}>( ({ block, reportBlockIndex, blockConfig, startDate, endDate, filters, isEditingMode, isSelected = false }) => {
    const BlockComponent = blockConfig.component as React.ComponentType<BlockComponentProps>;

    const componentProps = useMemo( () => ({
        isStory: true,
        isReport: true,
        customFilters: filters,
        reportBlockIndex: reportBlockIndex,
        startDate: startDate,
        endDate: endDate,
        ...( blockConfig?.blockProps || {}),
        allowBlockFilters: false
    }), [ reportBlockIndex, startDate, endDate, filters, blockConfig ]);

    return (
        <PreviewBlockControls
            key={`${block.id}-${reportBlockIndex}`}
            reportBlockIndex={reportBlockIndex}
            blockId={block.id as ContentBlockId}
            isEditingMode={isEditingMode}
            isSelected={isSelected}
        >
            <BlockComponent {...componentProps} />
        </PreviewBlockControls>
    );
}, ( prevProps, nextProps ) => {

    // Return true if props are equal (skip re-render).
    return (
        prevProps.reportBlockIndex === nextProps.reportBlockIndex &&
        prevProps.block.id === nextProps.block.id &&
        prevProps.startDate === nextProps.startDate &&
        prevProps.endDate === nextProps.endDate &&
        prevProps.isEditingMode === nextProps.isEditingMode &&
        prevProps.isSelected === nextProps.isSelected &&
        JSON.stringify( prevProps.filters ) === JSON.stringify( nextProps.filters ) &&
        prevProps.blockConfig === nextProps.blockConfig
    );
});
MemoizedBlock.displayName = 'MemoizedBlock';
export default MemoizedBlock;
