import React, { memo } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { safeDecodeURI } from '@/utils/lib';
import { formatNumber } from '@/utils/formatting';

interface ParameterSummaryBannerProps {

	/** Page URL being viewed. */
	pageUrl: string;

	/** Total pageviews recorded for this page URL. */
	totalPageviews: number;

	/** Number of pageviews that arrived with at least one parameter. */
	taggedPageviews: number;

	/** Number of pageviews that arrived on a clean URL. */
	untaggedPageviews: number;

	/** Optional additional CSS classes. */
	className?: string;
}

/**
 * Top summary banner for the parameter keys breakdown view (Level 1).
 *
 * Renders the tagged/untagged ratio sentence, a dual-colored progress bar,
 * and count chips for tagged and untagged views.
 *
 * @param {ParameterSummaryBannerProps} props Component props.
 * @return {JSX.Element} Summary banner element.
 */
const ParameterSummaryBanner: React.FC<ParameterSummaryBannerProps> = ({
	pageUrl,
	totalPageviews,
	taggedPageviews,
	untaggedPageviews,
	className = ''
}) => {
	const total = Math.max( 0, totalPageviews );
	const tagged = Math.max( 0, taggedPageviews );
	const untagged = Math.max( 0, untaggedPageviews );

	const taggedRatio = 0 < total ? Math.min( 10, Math.round( ( tagged / total ) * 10 ) ) : 0;
	const taggedPercentage = 0 < total ? Math.min( 100, Math.max( 0, ( tagged / total ) * 100 ) ) : 0;

	const summarySentence = sprintf(

		// translators: %1$d is the ratio out of 10, %2$s is the decoded page URL.
		__( '%1$d in 10 views of %2$s arrive with a tracked parameter', 'burst-statistics' ),
		taggedRatio,
		safeDecodeURI( pageUrl )
	);

	return (
		<div className={`flex flex-col gap-3.5 ${className}`}>
			<div className="text-sm font-semibold text-text-black">
				{summarySentence}
			</div>

			<div className="flex h-2 w-72 sm:w-80 overflow-hidden rounded-full bg-gray-200">
				<div
					className="h-full bg-green transition-all duration-300"
					style={{ width: `${taggedPercentage}%` }}
					aria-label={sprintf(

						// translators: %s is the percentage of tagged pageviews.
						__( '%s%% tagged', 'burst-statistics' ),
						taggedPercentage.toFixed( 1 )
					)}
				/>
				<div
					className="h-full bg-gray-300 transition-all duration-300"
					style={{ width: `${100 - taggedPercentage}%` }}
					aria-label={sprintf(

						// translators: %s is the percentage of untagged pageviews.
						__( '%s%% untagged', 'burst-statistics' ),
						( 100 - taggedPercentage ).toFixed( 1 )
					)}
				/>
			</div>

			<div className="flex items-center gap-4 text-xs text-text-gray">
				<span className="inline-flex items-center gap-1.5 font-normal">
					<span className="h-2 w-2 rounded-2xs bg-green" aria-hidden="true" />
					{sprintf(

						// translators: %s is the formatted number of tagged pageviews.
						__( '%s tagged', 'burst-statistics' ),
						formatNumber( tagged, 0, false )
					)}
				</span>
				<span className="inline-flex items-center gap-1.5 font-normal">
					<span className="h-2 w-2 rounded-2xs bg-gray-300" aria-hidden="true" />
					{sprintf(

						// translators: %s is the formatted number of untagged pageviews.
						__( '%s untagged', 'burst-statistics' ),
						formatNumber( untagged, 0, false )
					)}
				</span>
			</div>
		</div>
	);
};

export default memo( ParameterSummaryBanner );
