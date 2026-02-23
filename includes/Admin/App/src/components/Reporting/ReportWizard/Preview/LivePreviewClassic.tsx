import React, { useRef, useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import { useQuery } from '@tanstack/react-query';

import { useWizardStore } from '@/store/reports/useWizardStore';
import { getReportPreview } from '@/utils/api';

/**
 * Shadow DOM container component for rendering HTML with CSS isolation.
 * This allows the container to be scrollable while keeping styles encapsulated.
 */
const ShadowContainer = ({ html }: { html: string }) => {
    const containerRef = useRef<HTMLDivElement>( null );

    useEffect( () => {
        if ( ! containerRef.current ) {
            return;
        }

        // Create or get existing shadow root.
        let shadow = containerRef.current.shadowRoot;
        if ( ! shadow ) {
            shadow = containerRef.current.attachShadow({ mode: 'open' });
        }
        shadow.innerHTML = html;
    }, [ html ]);

    return (
        <div
            ref={ containerRef }
            className="w-full burst-classic-html-container border rounded bg-white"
        />
    );
};

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
                <p className="text-gray-500 text-center">
                    { __( 'No content selected for preview.', 'burst-statistics' ) }
                </p>
            ) }

            { hasSelectedContent && isFetching && (
                <p className="text-gray-500 text-center">
                    { __( 'Loading preview…', 'burst-statistics' ) }
                </p>
            ) }

            { hasSelectedContent && ! isFetching && isError && (
                <p className="text-red-500 text-center">
                    { __( 'Failed to load preview.', 'burst-statistics' ) }
                </p>
            ) }

            { hasSelectedContent && ! isFetching && data?.preview_html && (
                <ShadowContainer html={ data.preview_html } />
            ) }
        </div>
    );
};
