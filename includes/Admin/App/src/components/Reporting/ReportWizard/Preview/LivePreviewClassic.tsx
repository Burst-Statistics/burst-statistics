import React from 'react';
import { __ } from '@wordpress/i18n';
import { useQuery } from '@tanstack/react-query';

import { useWizardStore } from '@/store/reports/useWizardStore';
import { getReportPreview } from '@/utils/api';
import ShadowContainer from '@/components/Common/ShadowContainer';

export const LivePreviewClassic = ({ className }: { className?: string }) => {
    const frequency = useWizardStore( ( state ) => state.wizard.frequency );
    const contents = useWizardStore( ( state ) => state.wizard.content );

    const hasSelectedContent = 0 < contents.length;

    const { data, isFetching, isError } = useQuery({
        queryKey: [ 'report-preview', frequency, contents ],
        queryFn: () => getReportPreview( contents, frequency ),
        enabled: hasSelectedContent
    });

    return (
        <div className={className}>
            { ! hasSelectedContent && (
                <p className="text-text-gray-light text-center">
                    { __( 'No content selected for preview.', 'burst-statistics' ) }
                </p>
            ) }

            { hasSelectedContent && isFetching && (
                <p className="text-text-gray-light text-center">
                    { __( 'Loading preview…', 'burst-statistics' ) }
                </p>
            ) }

            { hasSelectedContent && ! isFetching && isError && (
                <p className="text-red-500 text-center">
                    { __( 'Failed to load preview.', 'burst-statistics' ) }
                </p>
            ) }

            { hasSelectedContent && ! isFetching && data?.preview_html && (
                <ShadowContainer
                    html={ data.preview_html }
                    className="w-full burst-classic-html-container border rounded bg-white min-h-[500px]"
                />
            ) }
        </div>
    );
};
