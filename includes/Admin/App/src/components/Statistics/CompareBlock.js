import ExplanationAndStatsItem from '@/components/Common/ExplanationAndStatsItem';
import { __, sprintf } from '@wordpress/i18n';
import CompareFooter from './CompareFooter';
import { useQuery } from '@tanstack/react-query';
import getCompareData from '@/api/getCompareData';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockFooter } from '@/components/Blocks/BlockFooter';
import { useBlockConfig } from '@/hooks/useBlockConfig';
import { useCompareStore, COMPARE_MODES } from '@/store/useCompareStore';
import { parseISO, subYears, differenceInDays, format } from 'date-fns';
import useSettingsData from '@/hooks/useSettingsData';
import { formatNumber } from '@/utils/formatting';

/**
 * Linearly interpolates a metric value to get the performs-better-than percentile.
 */
// fallow-ignore-next-line complexity
function calculateCommunityRank( value, percentiles, higherIsBetter ) {
	const keys = [ 'p5', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95' ];
	const values = keys.map( ( key ) => Number( percentiles[key]) );
	const ranks = [ 5, 10, 25, 50, 75, 90, 95 ];

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
		percentileRank = ranks[0];
	} else if ( value >= values[ values.length - 1 ]) {
		percentileRank = ranks[ ranks.length - 1 ];
	} else {
		for ( let i = 0; i < values.length - 1; i++ ) {
			const valLow = values[i];
			const valHigh = values[ i + 1 ];
			if ( value >= valLow && value <= valHigh ) {
				const rankLow = ranks[i];
				const rankHigh = ranks[ i + 1 ];
				const ratio = valHigh === valLow ? 0.5 : ( value - valLow ) / ( valHigh - valLow );
				percentileRank = rankLow + ratio * ( rankHigh - rankLow );
				break;
			}
		}
	}

	const betterThan = higherIsBetter ? percentileRank : 100 - percentileRank;
	return Math.min( 99, Math.max( 1, Math.round( betterThan ) ) );
}

const communityMetricConfig = {
	pageviews_per_session: { higherIsBetter: true },
	time_per_session: { higherIsBetter: true },
	new_visitors_percentage: { showAverage: true },
	bounce_rate: { higherIsBetter: false },
	conversion_rate: { higherIsBetter: true },
	average_time_on_page: { higherIsBetter: true }
};

/**
 * Calculate comparison start and end dates as ISO strings based on the
 * selected compare mode and the current period start / end dates.
 *
 * @param {string} startDate   - Current period start in YYYY-MM-DD.
 * @param {string} endDate     - Current period end in YYYY-MM-DD.
 * @param {string} compareMode - One of the COMPARE_MODES values.
 * @return {{ compareStart: string, compareEnd: string }} ISO date strings for the comparison window.
 */
function getComparisonDates( startDate, endDate, compareMode ) {
	const start = parseISO( startDate );
	const end = parseISO( endDate );

	if ( COMPARE_MODES.YEAR_OVER_YEAR === compareMode ) {
		return {
			compareStart: format( subYears( start, 1 ), 'yyyy-MM-dd' ),
			compareEnd: format( subYears( end, 1 ), 'yyyy-MM-dd' )
		};
	}

	// Default: previous period of equal length.
	const days = differenceInDays( end, start ) + 1;
	const prevEnd = new Date( start );
	prevEnd.setDate( prevEnd.getDate() - 1 );
	const prevStart = new Date( prevEnd );
	prevStart.setDate( prevStart.getDate() - ( days - 1 ) );

	return {
		compareStart: format( prevStart, 'yyyy-MM-dd' ),
		compareEnd: format( prevEnd, 'yyyy-MM-dd' )
	};
}

//eslint-disable-next-line
const CompareBlock = ( props ) => {
	const { startDate, endDate, range, filters, isReport, index } = useBlockConfig( props );
	const compareMode = useCompareStore( ( state ) => state.compareMode );

	// Compute comparison window dates so the backend uses them instead of the
	// default "shift back by equal duration" logic.
	const { compareStart, compareEnd } = getComparisonDates( startDate, endDate, compareMode );

	const args = {
		filters,
		compare_date_start: compareStart,
		compare_date_end: compareEnd
	};

	const metrics = {
		pageviews: __( 'Pageviews', 'burst-statistics' ),
		sessions: __( 'Sessions', 'burst-statistics' ),
		visitors: __( 'Visitors', 'burst-statistics' ),
		bounce_rate: __( 'Bounce Rate', 'burst-statistics' ),
		avg_time_on_page: __( 'Avg. time on page', 'burst-statistics' )
	};
	const emptyData = {};

	// Loop through metrics and set default values.
	Object.keys( metrics ).forEach( function( key ) {
		emptyData[ key ] = {
			title: metrics[ key ],
			subtitle: '-',
			value: '-',
			exactValue: '-',
			change: '-',
			changeStatus: ''
		};
	});

	const { getValue } = useSettingsData();
	const query = useQuery({
		queryKey: [ 'compare', startDate, endDate, compareMode, args ],
		queryFn: () => getCompareData({ startDate, endDate, range, args }),
		placeholderData: emptyData
	});

	const isLoading = query.isLoading || query.isFetching;
	const data = query.data || {};

	// If query is fetched and all .change values are empty, set compareNotAvailable to true.
	const compareNotAvailable = ! Object.keys( data ).some(
		( key ) => '' !== data[ key ].change
	);

	return (
		<Block className="row-span-1 @lg:col-span-6 @xl:col-span-3">
			<BlockHeading title={ __( 'Compare', 'burst-statistics' ) } isReport={ isReport } reportBlockIndex={ index } isLoading={ isLoading } />
			<BlockContent>
			{/* fallow-ignore-next-line complexity */}
			{ Object.keys( data ).map( ( key, i ) => {
				const m = data[ key ];
				let communityTooltipText = null;
				let communityTooltipLink = false;

				if ( m.communityMetricKey ) {
					const anonymousUsageDataEnabled = getValue( 'anonymous_usage_data' );
					const communityData = window.burst_settings?.community_data;
					const metricConfig = communityMetricConfig[ m.communityMetricKey ];

					if ( ! anonymousUsageDataEnabled ) {
						communityTooltipText = __( 'Opt in to data sharing to see how your site compares to peers.', 'burst-statistics' );
						communityTooltipLink = true;
					} else if ( communityData && 5 <= Number( communityData.sample_size ) && ! communityData.insufficient_data && metricConfig ) {
						const communityMetric = communityData[ m.communityMetricKey ];
						if ( metricConfig.showAverage && null != communityMetric?.average && Number.isFinite( Number( communityMetric.average ) ) ) {
							communityTooltipText = sprintf(
								__( 'Websites with similar traffic average %s%% new visitors.', 'burst-statistics' ),
								formatNumber( Number( communityMetric.average ) )
							);
						} else if ( communityMetric?.percentiles ) {
							const betterThanPercent = calculateCommunityRank(
								Number( m.communityMetricValue ),
								communityMetric.percentiles,
								metricConfig.higherIsBetter
							);
							if ( null !== betterThanPercent ) {
								communityTooltipText = sprintf(
									__( 'Your site performs better than %d%% of websites with similar traffic.', 'burst-statistics' ),
									betterThanPercent
								);
							}
						}
					}
				}

				return (
					<ExplanationAndStatsItem
						key={ i }
						iconKey={ 'avg_time_on_page' === key ? 'time' : key }
						title={ m.title }
						subtitle={ m.subtitle }
						value={ m.value }
						exactValue={ m.exactValue }
						change={ m.change }
						changeStatus={ m.changeStatus }
						metricKey={ 'avg_time_on_page' === key ? 'time_on_page' : key }
						communityTooltipText={ communityTooltipText }
						communityTooltipLink={ communityTooltipLink }
					/>
				);
			}) }
			</BlockContent>
			<BlockFooter>
				<CompareFooter
					noCompare={ compareNotAvailable }
					startDate={ startDate }
					endDate={ endDate }
					compareMode={ compareMode }
					compareStart={ compareStart }
					compareEnd={ compareEnd }
				/>
			</BlockFooter>
		</Block>
	);
};

export default CompareBlock;
