
import React from 'react';
import {__} from '@wordpress/i18n';
import {copyToClipboard} from '@/utils/copyToClipboard';
import {toast} from 'react-toastify';
import ButtonInput from '@/components/Inputs/ButtonInput';
import {useReportsStore} from '@/store/reports/useReportsStore';
import useLicenseData from '@/hooks/useLicenseData';
import Icon from '@/utils/Icon';
interface ReportStoryUrlProps {
    reportId: number; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export const ReportStoryUrl: React.FC<ReportStoryUrlProps> = ({ reportId }) => {
    const openPreview = useReportsStore( ( state ) => state.openPreview );
    const generateStoryUrl = useReportsStore( ( state ) => state.generateStoryUrl );
    const isGenerating = useReportsStore( ( state ) => state.isGenerating );
    const { isLicenseValidFor } = useLicenseData();
    const generateAndCopyUrl = async() => {
        const shareUrl = await generateStoryUrl( reportId );
        if ( shareUrl && 0 < shareUrl.length ) {
            await copyToClipboard( shareUrl );
            toast.success( __( 'Link created and copied to clipboard!', 'burst-statistics' ) );
        }
    };

    return (
        <>
            <ButtonInput disabled={ ! isLicenseValidFor( 'share-link-advanced' ) } onClick={ generateAndCopyUrl } btnVariant="tertiary"
                         className="flex items-center gap-2 !px-3 py-1.5 h-fit text-sm leading-none text-gray bg-gray-100 border border-gray-400 rounded-md hover:bg-gray-50 transition-colors"
            >
                { isGenerating &&
                    <Icon name="loading" size={14} color="gray" />
                }{__( 'Copy URL', 'burst-statistics' )}
            </ButtonInput>
            <ButtonInput disabled={ ! isLicenseValidFor( 'share-link-advanced' ) } onClick={ () => openPreview( reportId, true ) } btnVariant="tertiary"
                         className="flex items-center gap-2 !px-3 py-1.5 h-fit text-sm leading-none text-gray bg-gray-100 border border-gray-400 rounded-md hover:bg-gray-50 transition-colors"
            >
                { isGenerating &&
                    <Icon name="loading" size={14} color="gray" />
                }{__( 'Download PDF', 'burst-statistics' )}
            </ButtonInput>
        </>
    );
};
