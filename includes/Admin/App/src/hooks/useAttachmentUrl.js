// hooks/useAttachmentUrl.js
import { useQuery } from '@tanstack/react-query';

/**
 * Custom hook to fetch WordPress attachment URL by ID.
 *
 * @param {number|string} attachmentId - The WordPress attachment ID.
 * @return {Object} Query object with attachment URL and loading state.
 */
export const useAttachmentUrl = ( attachmentId ) => {
    const defaultLogoUrl = burst_settings.plugin_url + 'assets/img/burst-email-logo.png';
    return useQuery({
        queryKey: [ 'attachment', attachmentId ],
        queryFn: async() => {
            if ( '0' !== attachmentId && 0 !== attachmentId && attachmentId ) {
                const attachment = await wp.media.attachment( attachmentId ).fetch();
                return {
                    attachmentUrl: attachment?.sizes?.medium?.url ||
                        attachment?.sizes?.large?.url ||
                        attachment?.sizes?.full?.url ||
                        defaultLogoUrl,
                    attachment
                };
            }
            return { attachmentUrl: defaultLogoUrl, attachment: null };
        },
        staleTime: 5 * 60 * 1000
    });
};
