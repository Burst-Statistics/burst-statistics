import { memo } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { formatNumber } from '@/utils/formatting';

type ReferrerPopoverFooterProps = {
	noReferrerHits: number;
	totalReferrers: number;
	topN: number;
	showAll: boolean;
	onToggleShowAll: () => void;
};

export const ReferrerPopoverFooter = memo(
	({
		noReferrerHits,
		totalReferrers,
		topN,
		showAll,
		onToggleShowAll
	}: ReferrerPopoverFooterProps ) => {
		return (
			<div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-text-gray">
				<span>
					{sprintf(

						/* translators: %s: formatted hits without referrer */
						__( '%s hits without referrer', 'burst-statistics' ),
						formatNumber( noReferrerHits )
					)}
				</span>

				{totalReferrers > topN && (
					<button
						type="button"
						onClick={onToggleShowAll}
						className="inline-flex items-center gap-1 font-medium text-blue hover:underline transition-colors cursor-pointer"
					>
						{showAll ? (
							sprintf(

								/* translators: %d: number of top referrers */
								__( 'Show top %d', 'burst-statistics' ),
								topN
							)
						) : (
							<>
								<span>
									{sprintf(

										/* translators: %d: total referrers count */
										__( 'View all %d referrers', 'burst-statistics' ),
										totalReferrers
									)}
								</span>
								<span aria-hidden="true">&rarr;</span>
							</>
						)}
					</button>
				)}
			</div>
		);
	}
);

ReferrerPopoverFooter.displayName = 'ReferrerPopoverFooter';
