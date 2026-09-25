import { memo } from 'react';
import Icon from '@/utils/Icon';
import { formatNumber } from '@/utils/formatting';
import type { NotFoundPageReferrerItem } from '@/api/getNotFoundPageReferrers';
import { ReferrerActionLink } from './ReferrerActionLink';

type ReferrerRowProps = {
	item: NotFoundPageReferrerItem;
	maxHits: number;
};

export const ReferrerRow = memo( ({ item, maxHits }: ReferrerRowProps ) => {
	const barPct = 0 < maxHits ? Math.round( ( item.hits / maxHits ) * 100 ) : 0;
	const iconName = item.is_internal ? 'page' : 'browser';
	const iconClass = item.is_internal ? 'text-blue shrink-0' : 'text-text-gray shrink-0';

	return (
		<div className="relative flex items-center justify-between py-2 px-2 text-xs overflow-hidden">
			{0 < barPct && (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-y-0 left-0 bg-primary-100 rounded-sm transition-[width] duration-300"
					style={{ width: `${barPct}%` }}
				/>
			)}

			<div className="relative z-10 flex items-center gap-2 min-w-0 pr-2">
				<span className={iconClass}>
					<Icon name={iconName} size={13} color="currentColor" />
				</span>
				<a
					href={item.url}
					target="_blank"
					rel="noopener noreferrer"
					className="truncate font-medium text-text-black hover:text-blue transition-colors"
					title={item.display_url}
				>
					{item.display_url}
				</a>
			</div>

			<div className="relative z-10 flex items-center gap-2 shrink-0">
				<span className="font-semibold text-text-black">
					{formatNumber( item.hits )}
				</span>
				<ReferrerActionLink
					isInternal={item.is_internal}
					editUrl={item.edit_url}
					url={item.url}
				/>
			</div>
		</div>
	);
});

ReferrerRow.displayName = 'ReferrerRow';
