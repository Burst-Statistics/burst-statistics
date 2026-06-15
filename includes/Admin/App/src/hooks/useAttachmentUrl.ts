import { keepPreviousData, useQuery, UseQueryResult } from '@tanstack/react-query';

interface WPAttachmentSize {
	url?: string;
}

interface WPAttachmentSizes {
	medium?: WPAttachmentSize;
	large?: WPAttachmentSize;
	full?: WPAttachmentSize;
	[key: string]: WPAttachmentSize | undefined;
}

interface WPAttachment {
	id: number;
	sizes?: WPAttachmentSizes;
	[key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface UseAttachmentResult {
	attachmentUrl: string;
	attachment: WPAttachment | null;
}

/**
 * Custom hook to fetch WordPress attachment URL by ID.
 *
 * @param attachmentId - The WordPress attachment ID.
 */
export const useAttachmentUrl = (
	attachmentId: number | string,
	defaultUrl?: string
): UseQueryResult<UseAttachmentResult, Error> => {

	const defaultLogoUrl =
		( window as any ).burst_settings.plugin_url + 'assets/img/burst-email-logo.png'; // eslint-disable-line @typescript-eslint/no-explicit-any

	const resolvedDefault = defaultUrl ?? defaultLogoUrl;

	return useQuery<UseAttachmentResult, Error>({
		queryKey: [ 'attachment', attachmentId, resolvedDefault ],
		queryFn: async(): Promise<UseAttachmentResult> => {

		// Server-resolved URL instead of an attachment ID (story/frontend view,
		// where wp.media is unavailable) — use it directly.
		if ( 'string' === typeof attachmentId && attachmentId.startsWith( 'http' ) ) {
			return { attachmentUrl: attachmentId, attachment: null };
		}

		if ( attachmentId && 0 !== attachmentId && '0' !== attachmentId ) {
			const attachment: WPAttachment = await ( window as any ).wp.media // eslint-disable-line @typescript-eslint/no-explicit-any
				.attachment( attachmentId )
				.fetch();

			return {
				attachmentUrl:
					attachment?.sizes?.large?.url ||
					attachment?.sizes?.full?.url ||
					resolvedDefault,
				attachment
			};
		}

		return { attachmentUrl: resolvedDefault, attachment: null };
	},

	// Keep showing the previous image while the light/dark variant loads —
	// avoids a loading flash when the query key changes.
	placeholderData: keepPreviousData,
	staleTime: 5 * 60 * 1000
});
};

const isSetAttachmentId = ( value: number | string | undefined ): boolean =>
	!! value && 0 !== value && '0' !== value;

/**
 * Resolve an attachment URL with a dark mode variant.
 *
 * In dark mode the dark attachment is used when set, falling back to the light
 * attachment, and finally to `darkDefaultUrl` when neither is set.
 *
 * @param lightId        - Attachment ID of the light mode image.
 * @param darkId         - Attachment ID of the dark mode image.
 * @param isDark         - Whether dark mode is active.
 * @param lightDefaultUrl - Default URL when no light image is set.
 * @param darkDefaultUrl  - Default URL when no image is set in dark mode.
 */
export const useDarkAwareAttachmentUrl = (
	lightId: number | string | undefined,
	darkId: number | string | undefined,
	isDark: boolean,
	lightDefaultUrl?: string,
	darkDefaultUrl?: string
): UseQueryResult<UseAttachmentResult, Error> => {
	const useDarkImage = isDark && isSetAttachmentId( darkId );
	const defaultUrl =
		isDark && ! isSetAttachmentId( lightId ) ?
			darkDefaultUrl ?? lightDefaultUrl :
			lightDefaultUrl;

	return useAttachmentUrl( ( useDarkImage ? darkId : lightId ) ?? 0, defaultUrl );
};
