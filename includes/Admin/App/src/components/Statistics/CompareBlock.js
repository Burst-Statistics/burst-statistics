import ExplanationAndStatsItem from '@/components/Common/ExplanationAndStatsItem';
import { __ } from '@wordpress/i18n';
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
		bounce_rate: __( 'Bounce Rate', 'burst-statistics' )
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
			{ Object.keys( data ).map( ( key, i ) => {
				const m = data[ key ];
				return (
					<ExplanationAndStatsItem
						key={ i }
						iconKey={ key }
						title={ m.title }
						subtitle={ m.subtitle }
						value={ m.value }
						exactValue={ m.exactValue }
						change={ m.change }
						changeStatus={ m.changeStatus }
						metricKey={ key }
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
