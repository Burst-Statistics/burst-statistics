import { __, sprintf } from '@wordpress/i18n';
import { formatNumber } from './formatting';
import type {
	BurstCommunityData,
	BurstCommunityPercentiles
} from '@/types/burst-settings';

/**
 * State of the community comparison icon next to a metric.
 * - disabled: data sharing is off, the icon links to the settings.
 * - pending:  data sharing is on, but no comparison has arrived yet.
 * - active:   a comparison is available.
 */
export type CommunityComparisonState = 'disabled' | 'pending' | 'active';

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
	| 'average_time_on_page';

export type CommunityDeviceKey = 'desktop' | 'tablet' | 'mobile' | 'other';

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
	average_time_on_page: { higherIsBetter: true }
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
 * @return A disabled comparison when sharing is off, a pending one otherwise.
 */
function getUnavailableComparison( isSharingEnabled: boolean ): CommunityComparison {
	if ( ! isSharingEnabled ) {
		return {
			state: 'disabled',
			text: __( 'Data sharing is off. Turn it on to compare your site with similar websites.', 'burst-statistics' )
		};
	}

	return {
		state: 'pending',
		text: __( 'Waiting for community data. It arrives with the next monthly sync.', 'burst-statistics' )
	};
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
 * Get the community comparison icon state and tooltip for a compare-block metric.
 *
 * @param isSharingEnabled Whether the site shares anonymous usage data.
 * @param communityData    The community data stored from the last telemetry sync.
 * @param metricKey        The community metric key.
 * @param value            The site's own value for the metric.
 * @return The icon state and tooltip text.
 */
// fallow-ignore-next-line complexity
export function getMetricComparison(
	isSharingEnabled: boolean,
	communityData: BurstCommunityData | null | undefined,
	metricKey: CommunityMetricKey,
	value: number
): CommunityComparison {
	if ( ! isSharingEnabled || ! hasUsableCommunityData( communityData ) ) {
		return getUnavailableComparison( isSharingEnabled );
	}

	const config = COMMUNITY_METRIC_CONFIG[ metricKey ];
	const isFallback = isAllSitesFallback( communityData, metricKey );

	if ( config.showAverage ) {
		const average = Number( communityData.new_visitors_percentage?.average );
		if ( null == communityData.new_visitors_percentage?.average || ! Number.isFinite( average ) ) {
			return getUnavailableComparison( isSharingEnabled );
		}

		return {
			state: 'active',
			text: sprintf(
				isFallback ?
					__( 'Websites using Burst average %s%% new visitors.', 'burst-statistics' ) :
					__( 'Websites with similar traffic average %s%% new visitors.', 'burst-statistics' ),
				formatNumber( average )
			)
		};
	}

	const distribution = communityData[ metricKey ];
	const percentiles = distribution && 'percentiles' in distribution ? distribution.percentiles : null;
	const betterThanPercent = percentiles ?
		calculateCommunityRank( Number( value ), percentiles, !! config.higherIsBetter ) :
		null;

	if ( null === betterThanPercent ) {
		return getUnavailableComparison( isSharingEnabled );
	}

	return {
		state: 'active',
		text: sprintf(
			isFallback ?
				__( 'Your site performs better than %d%% of websites using Burst.', 'burst-statistics' ) :
				__( 'Your site performs better than %d%% of websites with similar traffic.', 'burst-statistics' ),
			betterThanPercent
		)
	};
}

/**
 * Get the community comparison icon state and tooltip for a device row.
 *
 * @param isSharingEnabled Whether the site shares anonymous usage data.
 * @param communityData    The community data stored from the last telemetry sync.
 * @param deviceKey        The device key.
 * @param deviceTitle      The translated device name.
 * @return The icon state and tooltip text.
 */
export function getDeviceComparison(
	isSharingEnabled: boolean,
	communityData: BurstCommunityData | null | undefined,
	deviceKey: CommunityDeviceKey,
	deviceTitle: string
): CommunityComparison {
	const average = hasUsableCommunityData( communityData ) ? communityData.devices?.[ deviceKey ] : undefined;

	if ( ! isSharingEnabled || 'number' !== typeof average ) {
		return getUnavailableComparison( isSharingEnabled );
	}

	return {
		state: 'active',
		text: sprintf(
			__( 'Community average: %s%% of visitors use %s.', 'burst-statistics' ),
			average.toFixed( 1 ),
			deviceTitle.toLowerCase()
		)
	};
}
