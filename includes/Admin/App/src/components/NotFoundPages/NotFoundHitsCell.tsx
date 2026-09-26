import { ReactNode, memo } from 'react';
import { formatNumber } from '@/utils/formatting';
import NotFoundPageReferrersPopover from './NotFoundPageReferrersPopover';

interface NotFoundHitsCellProps {
	pageUrl: string;
	hits?: number | string;
	formattedHits?: ReactNode;
}

/**
 * Shared hits cell with 404 referrers popover for compact and expanded 404 tables.
 *
 * @param props Component properties.
 * @param props.pageUrl The 404 page URL path.
 * @param props.hits Raw hit count.
 * @param props.formattedHits Pre-formatted hit count if provided by parent table column.
 * @return JSX.Element
 */
const NotFoundHitsCell = memo( ({
	pageUrl,
	hits,
	formattedHits
}: NotFoundHitsCellProps ) => {
	const displayHits = undefined !== formattedHits ? formattedHits : formatNumber( hits ?? 0 );

	return (
		<div className="inline-flex items-center justify-end gap-2.5">
			<span className="font-medium text-text-black">
				{ displayHits }
			</span>
			<NotFoundPageReferrersPopover pageUrl={ pageUrl } />
		</div>
	);
});

NotFoundHitsCell.displayName = 'NotFoundHitsCell';

export default NotFoundHitsCell;
