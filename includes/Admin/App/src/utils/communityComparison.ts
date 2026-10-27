import { __, sprintf } from '@wordpress/i18n';
import { formatNumber } from './formatting';
import { FILTER_KEYS, type FilterSearchParams } from '@/config/filterConfig';
import type {
	BurstCommunityData,
	BurstCommunityPercentiles
} from '@/types/burst-settings';

/**
 * State of the community comparison icon next to a metric.
 * - disabled: data sharing is off, the icon links to the settings.
 * - pending:  data sharing is on, but no comparison has arrived yet.
 * - filtered: the dashboard is filtered, so it cannot be compared with whole sites.
 * - active:   a comparison is available.
 */
export type CommunityComparisonState = 'disabled' | 'pending' | 'filtered' | 'active';

export interface CommunityComparison {
	state: CommunityComparisonState;
	text: string;
}

export type CommunityMetricKey =
	| 'pageviews_per_session'
	| 'time_per_session'
	| 'new_visitors_percentage'
	| 'bounce_rate'
	| 'conversion_rate'
	| 'average_time_on_page'
	| 'average_page_weight'
	| 'co2_per_pageview'
	| 'ecommerce_conversion_rate'
	| 'abandoned_cart_rate'
	| 'revenue_churn';

export type CommunityDeviceKey = 'desktop' | 'tablet' | 'mobile' | 'other';

/**
 * The filters of the block being compared. Report blocks pass an empty array
 * when they have no filters.
 */
export type ComparisonFilters = FilterSearchParams | never[] | null | undefined;

interface CommunityMetricConfig {
	higherIsBetter?: boolean;
	showAverage?: boolean;
}

const COMMUNITY_METRIC_CONFIG: Record<CommunityMetricKey, CommunityMetricConfig> = {
	pageviews_per_session: { higherIsBetter: true },
	time_per_session: { higherIsBetter: true },
	new_visitors_percentage: { showAverage: true },
	bounce_rate: { higherIsBetter: false },
	conversion_rate: { higherIsBetter: true },
	average_time_on_page: { higherIsBetter: true },
	average_page_weight: { higherIsBetter: false },
	co2_per_pageview: { higherIsBetter: false },
	ecommerce_conversion_rate: { higherIsBetter: true },
	abandoned_cart_rate: { higherIsBetter: false },
	revenue_churn: { higherIsBetter: false }
};

// Below this many sites the endpoint does not report a comparison.
const MIN_SAMPLE_SIZE = 5;

const PERCENTILE_KEYS: ( keyof BurstCommunityPercentiles )[] = [ 'p5', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95' ];
const PERCENTILE_RANKS = [ 5, 10, 25, 50, 75, 90, 95 ];

/**
 * Linearly interpolates a metric value to get the performs-better-than percentile.
 *
 * @param value          The site's value for the metric.
 * @param percentiles    The community percentiles for the metric.
 * @param higherIsBetter Whether a higher value is better for this metric.
 * @return The percentage of sites this site performs better than (1-99), or null when it cannot be determined.
 */
// fallow-ignore-next-line complexity
function calculateCommunityRank(
	value: number,
	percentiles: BurstCommunityPercentiles,
	higherIsBetter: boolean
): number | null {
	const values = PERCENTILE_KEYS.map( ( key ) => Number( percentiles[ key ]) );

	if ( ! Number.isFinite( value ) || values.some( ( item ) => ! Number.isFinite( item ) ) ) {
		return null;
	}
	if ( values.some( ( item, index ) => 0 < index && item < values[ index - 1 ]) ) {
		return null;
	}
	if ( values.every( ( item ) => item === values[0]) ) {
		return 50;
	}

	let percentileRank = 50;
	if ( value <= values[0]) {
		percentileRank = PERCENTILE_RANKS[0];
	} else if ( value >= values[ values.length - 1 ]) {
		percentileRank = PERCENTILE_RANKS[ PERCENTILE_RANKS.length - 1 ];
	} else {
		for ( let i = 0; i < values.length - 1; i++ ) {
			const valLow = values[i];
			const valHigh = values[ i + 1 ];
			if ( value >= valLow && value <= valHigh ) {
				const rankLow = PERCENTILE_RANKS[i];
				const rankHigh = PERCENTILE_RANKS[ i + 1 ];
				const ratio = valHigh === valLow ? 0.5 : ( value - valLow ) / ( valHigh - valLow );
				percentileRank = rankLow + ratio * ( rankHigh - rankLow );
				break;
			}
		}
	}

	const betterThan = higherIsBetter ? percentileRank : 100 - percentileRank;
	return Math.min( 99, Math.max( 1, Math.round( betterThan ) ) );
}

/**
 * The comparison shown while no community value is available.
 *
 * @param isSharingEnabled Whether the site shares anonymous usage data.
 * @param filters          The filters of the block.
 * @return A disabled comparison when sharing is off, a filtered one for a filtered view, a pending one otherwise.
 */
function getUnavailableComparison( isSharingEnabled: boolean, filters: ComparisonFilters ): CommunityComparison {
	if ( ! isSharingEnabled ) {
		return {
			state: 'disabled',
			text: __( 'To see how your site compares to similar websites, turn on sharing anonymous usage data with Burst.', 'burst-statistics' )
		};
	}

	if ( ! canCompareWithCommunity( filters ) ) {
		return {
			state: 'filtered',
			text: __( 'No comparison for a filtered view: similar websites are compared on all their traffic. Remove the filters to compare.', 'burst-statistics' )
		};
	}

	return {
		state: 'pending',
		text: __( 'Waiting for community data. The first comparison arrives after a month of tracking.', 'burst-statistics' )
	};
}

/**
 * The comparison shown when community data arrived, but holds nothing for this metric.
 *
 * @return A pending comparison.
 */
function getMissingMetricComparison(): CommunityComparison {
	return {
		state: 'pending',
		text: __( 'No comparison for this metric yet. It may arrive with the next monthly sync.', 'burst-statistics' )
	};
}

/**
 * Describe the sites a metric is compared with.
 * The number of sites is left out on purpose: it would reveal how many sites share data with us.
 *
 * @param communityData The community data.
 * @param isFallback    Whether the metric was filled from all sites instead of the visitor range.
 * @return A sentence naming the peer group by its visitor range.
 */
// fallow-ignore-next-line complexity
function getPeerGroupText( communityData: BurstCommunityData, isFallback: boolean ): string {
	if ( isFallback ) {
		return __( 'Too few websites with similar traffic share data yet, so this compares with all websites using Burst.', 'burst-statistics' );
	}

	const min = Number( communityData.range?.min );
	const max = null === communityData.range?.max || undefined === communityData.range?.max ? null : Number( communityData.range.max );

	if ( null === max ) {
		return sprintf(

			/* translators: %s: monthly visitors, e.g. "100K". */
			__( 'Based on websites with more than %s visitors a month.', 'burst-statistics' ),
			formatNumber( Math.max( 0, min - 1 ) )
		);
	}

	if ( 1 >= min ) {
		return sprintf(

			/* translators: %s: monthly visitors, e.g. "1K". */
			__( 'Based on websites with up to %s visitors a month.', 'burst-statistics' ),
			formatNumber( max )
		);
	}

	return sprintf(

		/* translators: 1: lower bound of monthly visitors, 2: upper bound, e.g. "1K" and "5K". */
		__( 'Based on websites with %1$s–%2$s visitors a month.', 'burst-statistics' ),
		formatNumber( min ),
		formatNumber( max )
	);
}

/**
 * Whether the community data holds a usable comparison at all.
 *
 * @param communityData The community data stored from the last telemetry sync.
 * @return True when the sample is large enough to compare against.
 */
function hasUsableCommunityData( communityData: BurstCommunityData | null | undefined ): communityData is BurstCommunityData {
	return !! communityData &&
		! communityData.insufficient_data &&
		MIN_SAMPLE_SIZE <= Number( communityData.sample_size );
}

/**
 * Whether the endpoint filled this metric from all sites instead of the site's visitor range.
 *
 * @param communityData The community data.
 * @param key           The metric key.
 * @return True when the metric compares against all websites using Burst.
 */
function isAllSitesFallback( communityData: BurstCommunityData, key: string ): boolean {
	return Array.isArray( communityData.fallback_metrics ) && communityData.fallback_metrics.includes( key );
}

/**
 * Whether the dashboard view can be compared with the community.
 *
 * The community data describes all traffic of a site, so a view filtered to one page,
 * country or campaign has nothing to compare with. A goal filter is the exception: it
 * picks the goal whose conversion rate is compared.
 *
 * @param filters The filters of the block.
 * @return True when no filter other than a goal is active.
 */
function canCompareWithCommunity( filters: ComparisonFilters ): boolean {
	if ( ! filters || Array.isArray( filters ) ) {
		return true;
	}

	return ! FILTER_KEYS.some( ( key ) => 'goal_id' !== key && !! filters[ key ]);
}

/**
 * Whether a comparison can be made: data sharing is on, the view is not filtered and the community data is usable.
 *
 * @param isSharingEnabled Whether the site shares anonymous usage data.
 * @param communityData    The community data stored from the last telemetry sync.
 * @param filters          The filters of the block.
 * @return True when the comparison can be calculated.
 */
function isComparisonAvailable(
	isSharingEnabled: boolean,
	communityData: BurstCommunityData | null | undefined,
	filters: ComparisonFilters
): communityData is BurstCommunityData {
	return isSharingEnabled && canCompareWithCommunity( filters ) && hasUsableCommunityData( communityData );
}

/**
 * Rank the site's value against the community percentiles of a ranked metric.
 *
 * @param communityData The community data.
 * @param metricKey     The community metric key.
 * @param value         The site's own value for the metric.
 * @return The percentage of sites this site performs better than (1-99), or null when the metric has no percentiles.
 */
function getMetricRank( communityData: BurstCommunityData, metricKey: CommunityMetricKey, value: number ): number | null {
	const distribution = communityData[ metricKey ];
	const percentiles = distribution && 'percentiles' in distribution ? distribution.percentiles : null;

	return percentiles ?
		calculateCommunityRank( Number( value ), percentiles, !! COMMUNITY_METRIC_CONFIG[ metricKey ].higherIsBetter ) :
		null;
}

/**
 * Get the community comparison icon state and tooltip for a compare-block metric.
 *
 * @param isSharingEnabled Whether the site shares anonymous usage data.
 * @param communityData    The community data stored from the last telemetry sync.
 * @param metricKey        The community metric key.
 * @param value            The site's own value for the metric.
 * @param filters          The filters of the block; a filtered view cannot be compared.
 * @return The icon state and tooltip text.
 */
// fallow-ignore-next-line complexity
export function getMetricComparison(
	isSharingEnabled: boolean,
	communityData: BurstCommunityData | null | undefined,
	metricKey: CommunityMetricKey,
	value: number,
	filters?: ComparisonFilters
): CommunityComparison {
	if ( ! isComparisonAvailable( isSharingEnabled, communityData, filters ) ) {
		return getUnavailableComparison( isSharingEnabled, filters );
	}

	const config = COMMUNITY_METRIC_CONFIG[ metricKey ];
	const isFallback = isAllSitesFallback( communityData, metricKey );

	if ( config.showAverage ) {
		const average = Number( communityData.new_visitors_percentage?.average );
		if ( null == communityData.new_visitors_percentage?.average || ! Number.isFinite( average ) ) {
			return getMissingMetricComparison();
		}

		return {
			state: 'active',
			text: sprintf(
				isFallback ?
					__( 'Websites using Burst average %s%% new visitors.', 'burst-statistics' ) :
					__( 'Websites with similar traffic average %s%% new visitors.', 'burst-statistics' ),
				formatNumber( average )
			) + ' ' + getPeerGroupText( communityData, isFallback )
		};
	}

	const betterThanPercent = getMetricRank( communityData, metricKey, value );

	if ( null === betterThanPercent ) {
		return getMissingMetricComparison();
	}

	return {
		state: 'active',
		text: sprintf(
			isFallback ?
				__( 'Your site performs better than %d%% of websites using Burst.', 'burst-statistics' ) :
				__( 'Your site performs better than %d%% of websites with similar traffic.', 'burst-statistics' ),
			betterThanPercent
		) + ' ' + getPeerGroupText( communityData, isFallback )
	};
}

/**
 * Get the community comparison icon state and tooltip for a device row.
 *
 * @param isSharingEnabled Whether the site shares anonymous usage data.
 * @param communityData    The community data stored from the last telemetry sync.
 * @param deviceKey        The device key.
 * @param deviceTitle      The translated device name.
 * @param filters          The filters of the block; a filtered view cannot be compared.
 * @return The icon state and tooltip text.
 */
export function getDeviceComparison(
	isSharingEnabled: boolean,
	communityData: BurstCommunityData | null | undefined,
	deviceKey: CommunityDeviceKey,
	deviceTitle: string,
	filters?: ComparisonFilters
): CommunityComparison {
	if ( ! isComparisonAvailable( isSharingEnabled, communityData, filters ) ) {
		return getUnavailableComparison( isSharingEnabled, filters );
	}

	const average = communityData.devices?.[ deviceKey ];
	if ( 'number' !== typeof average ) {
		return getMissingMetricComparison();
	}

	return {
		state: 'active',
		text: sprintf(
			__( 'Community average: %s%% of visitors use %s.', 'burst-statistics' ),
			average.toFixed( 1 ),
			deviceTitle.toLowerCase()
		) + ' ' + getPeerGroupText( communityData, isAllSitesFallback( communityData, 'devices' ) )
	};
}

/**
 * Get the community comparison for the page weight headline.
 *
 * Ranks the page weight, and adds the CO2 per pageview to the same tooltip:
 * it scales with the weight, but also with the hosting, so the two ranks can
 * differ.
 *
 * @param isSharingEnabled Whether the site shares anonymous usage data.
 * @param communityData    The community data stored from the last telemetry sync.
 * @param averageBytes     The site's average page weight per pageview, in bytes.
 * @param co2PerPageview   The site's estimated CO2 per pageview, in grams.
 * @param filters          The filters of the block; a filtered view cannot be compared.
 * @return The icon state and tooltip text.
 */
// fallow-ignore-next-line complexity
export function getPageWeightComparison(
	isSharingEnabled: boolean,
	communityData: BurstCommunityData | null | undefined,
	averageBytes: number,
	co2PerPageview: number,
	filters?: ComparisonFilters
): CommunityComparison {
	if ( ! isComparisonAvailable( isSharingEnabled, communityData, filters ) ) {
		return getUnavailableComparison( isSharingEnabled, filters );
	}

	const weightRank = getMetricRank( communityData, 'average_page_weight', averageBytes );
	if ( null === weightRank ) {
		return getMissingMetricComparison();
	}

	const isWeightFallback = isAllSitesFallback( communityData, 'average_page_weight' );
	const sentences = [
		sprintf(
			isWeightFallback ?
				__( 'Your pages are lighter than %d%% of websites using Burst.', 'burst-statistics' ) :
				__( 'Your pages are lighter than %d%% of websites with similar traffic.', 'burst-statistics' ),
			weightRank
		)
	];

	const co2Rank = getMetricRank( communityData, 'co2_per_pageview', co2PerPageview );
	if ( null !== co2Rank ) {
		sentences.push( sprintf(
			isAllSitesFallback( communityData, 'co2_per_pageview' ) ?
				__( 'Each pageview causes less CO2 than on %d%% of websites using Burst.', 'burst-statistics' ) :
				__( 'Each pageview causes less CO2 than on %d%% of websites with similar traffic.', 'burst-statistics' ),
			co2Rank
		) );
	}

	sentences.push( getPeerGroupText( communityData, isWeightFallback ) );

	return {
		state: 'active',
		text: sentences.join( ' ' )
	};
}
