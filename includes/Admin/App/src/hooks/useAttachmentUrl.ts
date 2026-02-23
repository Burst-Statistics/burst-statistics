import { useQuery, UseQueryResult } from '@tanstack/react-query';

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
	attachmentId: number | string
): UseQueryResult<UseAttachmentResult, Error> => {

	const defaultLogoUrl =
		( window as any ).burst_settings.plugin_url + 'assets/img/burst-email-logo.png'; // eslint-disable-line @typescript-eslint/no-explicit-any

	return useQuery<UseAttachmentResult, Error>({
		queryKey: [ 'attachment', attachmentId ],
		queryFn: async(): Promise<UseAttachmentResult> => {
		if ( attachmentId && 0 !== attachmentId && '0' !== attachmentId ) {
			const attachment: WPAttachment = await ( window as any ).wp.media // eslint-disable-line @typescript-eslint/no-explicit-any
				.attachment( attachmentId )
				.fetch();

			return {
				attachmentUrl:
					attachment?.sizes?.medium?.url ||
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
