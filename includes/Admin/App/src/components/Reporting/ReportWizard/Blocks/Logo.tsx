import React from 'react';
import useSettingsData from '@/hooks/useSettingsData';
import {useDarkAwareAttachmentUrl} from '@/hooks/useAttachmentUrl';
import { useTheme } from '@/hooks/useTheme';
const Logo = () => {
    const { getValue } = useSettingsData();
    const { isDarkTheme } = useTheme();
    const logoId = getValue( 'logo_attachment_id' );
    const logoIdDark = getValue( 'logo_attachment_id_dark' );
    const darkLogoDefaultUrl = ( window as any ).burst_settings.plugin_url + 'assets/img/burst-email-logo-dark.png'; // eslint-disable-line @typescript-eslint/no-explicit-any
    const logoQuery = useDarkAwareAttachmentUrl( logoId, logoIdDark, isDarkTheme, undefined, darkLogoDefaultUrl );
    const isLoadingLogo = logoQuery.isLoading;

    const logoUrl = logoQuery.data?.attachmentUrl ?? '';
    return (
        <div className="flex justify-center mb-10">
            {
                ! isLoadingLogo && logoUrl && (
                    <img alt="logo" src={logoUrl} className="h-11 w-auto px-0 py-2" />
                )
            }
        </div>
    );
};
export default Logo;
