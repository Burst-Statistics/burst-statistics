import React from 'react';
import type { OutgoingLinkRow } from '@/components/OutgoingLinks/useOutgoingLinksData';
import Icon from '@/utils/Icon';
import { formatNumber, truncateMiddle } from '@/utils/formatting';
import { safeHref } from '@/utils/safeHref';

interface OutgoingLinkItemProps {
	item: OutgoingLinkRow;
}

/**
 * Formats an outgoing link target into a clean domain + path string.
 *
 * @param rawUrl - Raw URL string.
 * @return Clean hostname and path for display.
 */
const formatOutgoingDisplayUrl = ( rawUrl: string ): string => {
	try {
		const parsed = new URL( rawUrl );
		return parsed.hostname + ( '/' !== parsed.pathname ? parsed.pathname : '' );
	} catch {
		return rawUrl;
	}
};

/**
 * One row in the editor panel's outgoing links list. The target is only a
 * link when it is an http(s) URL; anything else is shown as plain text.
 *
 * @param props      - Component properties.
 * @param props.item - Outgoing link with its click count.
 * @return The row element.
 */
export const OutgoingLinkItem: React.FC<OutgoingLinkItemProps> = ({ item }) => {
	const displayUrl = truncateMiddle( formatOutgoingDisplayUrl( item.url ), 24 );
	const href = safeHref( item.url );

	return (
		<div className="flex items-center justify-between text-xs py-0.5">
			{ href ? (
				<a
					href={ href }
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1.5 min-w-0 max-w-[200px] text-text-black hover:text-green-600 transition-colors group"
					title={ item.url }
				>
					<Icon
						name="external-link"
						size={ 11 }
						className="shrink-0 text-gray-400 group-hover:text-green-600 transition-colors"
					/>
					<span className="truncate group-hover:underline underline-offset-2">{ displayUrl }</span>
				</a>
			) : (
				<span className="truncate min-w-0 max-w-[200px] text-text-black" title={ item.url }>
					{ displayUrl }
				</span>
			) }
			<span className="font-medium text-text-black shrink-0 ml-2">
				{ formatNumber( item.clicks ) }
			</span>
		</div>
	);
};
