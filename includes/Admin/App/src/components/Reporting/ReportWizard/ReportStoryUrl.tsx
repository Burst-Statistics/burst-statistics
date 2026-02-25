
import React from 'react';
import {__} from '@wordpress/i18n';
import {copyToClipboard} from '@/utils/copyToClipboard';
import {toast} from 'react-toastify';
import ButtonInput from '@/components/Inputs/ButtonInput';
import {useReportsStore} from '@/store/reports/useReportsStore';
import useLicenseData from '@/hooks/useLicenseData';
import Icon from '@/utils/Icon';
import Tooltip from '@/components/Common/Tooltip';
interface ReportStoryUrlProps {
    reportId: number; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export const ReportStoryUrl: React.FC<ReportStoryUrlProps> = ({ reportId }) => {
    const openPreview = useReportsStore( ( state ) => state.openPreview );
    const generateStoryUrl = useReportsStore( ( state ) => state.generateStoryUrl );
    const isGenerating = useReportsStore( ( state ) => state.isGenerating );
    const { isLicenseValidFor } = useLicenseData();
    const [ isCopied, setCopied ] = React.useState( false );
    const [ link, setLink ] = React.useState( '' );
    const generateAndCopyUrl = async() => {
        const shareUrl = await generateStoryUrl( reportId );
        if ( shareUrl && 0 < shareUrl.length ) {
            setLink( shareUrl );
            await copyToClipboard( shareUrl );
            setCopied( true );
            toast.success( __( 'Link created and copied to clipboard!', 'burst-statistics' ) );
        }
    };

    return (
        <div className="flex flex-col gap-2 w-full">
            <div className="flex gap-2">
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
            </div>
            {0 < link.length &&
            <div className="flex gap-1.5 w-full">
                {/* URL display. */}
                <input
                    type="text"
                    readOnly
                    title={link}
                    value={link}
                    onClick={( e ) => ( e.target as HTMLInputElement ).select()}
                    className="max-w-full truncate text-sm text-gray-800 font-mono w-full bg-gray-50 px-2 py-1.5 rounded border border-gray-300 cursor-text focus:border-wp-blue focus:ring-1 focus:ring-wp-blue/20"
                />

                <Tooltip content={isCopied ? __( 'Copied!', 'burst-statistics' ) : __( 'Copy link', 'burst-statistics' )}>
                    <button
                        onClick={() => copyToClipboard( link )}
                        className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
                    >
                        {isCopied ? (
                            <Icon name="check" size={14} color="green" />
                        ) : (
                            <Icon name="copy" size={14} />
                        )}
                    </button>
                </Tooltip>
            </div> }
        </div>
    );
};
