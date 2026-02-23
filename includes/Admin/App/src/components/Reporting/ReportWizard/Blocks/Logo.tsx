import React from 'react';
import useSettingsData from '@/hooks/useSettingsData';
import {useAttachmentUrl} from '@/hooks/useAttachmentUrl';
const Logo = () => {
    const { getValue } = useSettingsData();
    const logoId = getValue( 'logo_attachment_id' );
    const logoQuery = useAttachmentUrl( logoId );
    const isLoadingLogo = logoQuery.isLoading;

    const logoUrl = logoQuery.data?.attachmentUrl ?? '';
    return (
        <div className="flex justify-center mb-10">
            {! isLoadingLogo && logoUrl && (
                <img alt="logo" src={logoUrl} className="h-11 w-auto px-0 py-2" />
            )}
        </div>
    );
};
export default Logo;
