import { memo } from 'react';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import { ReferrerRow } from './ReferrerRow';
import type { NotFoundPageReferrerItem } from '@/api/getNotFoundPageReferrers';

type ReferrersListProps = {
	referrers: NotFoundPageReferrerItem[];
	maxHits: number;
	isLoading: boolean;
	showAll: boolean;
};

export const ReferrersList = memo(
	({ referrers, maxHits, isLoading, showAll }: ReferrersListProps ) => {
		if ( isLoading && 0 === referrers.length ) {
			return (
				<div className="divide-y divide-gray-100">
					<div className="py-8 text-center text-xs text-text-gray">
						<span className="inline-block h-4 w-3/4 animate-pulse rounded bg-gray-200" />
					</div>
				</div>
			);
		}

		if ( 0 === referrers.length ) {
			return (
				<div className="divide-y divide-gray-100">
					<div className="py-8 text-center text-xs text-text-gray">
						{__( 'No referrers found for this period.', 'burst-statistics' )}
					</div>
				</div>
			);
		}

		return (
			<div
				className={clsx(
					'divide-y divide-gray-100',
					showAll && 'max-h-60 overflow-y-auto'
				)}
			>
				{referrers.map( ( r ) => (
					<ReferrerRow
						key={r.referrer}
						item={r}
						maxHits={maxHits}
					/>
				) )}
			</div>
		);
	}
);

ReferrersList.displayName = 'ReferrersList';
