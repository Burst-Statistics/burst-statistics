import { __ } from '@wordpress/i18n';
import { formatNumber, formatPercentage } from '@/utils/formatting';
import GoalChange from './GoalChange';

interface GoalKpisProps {
	conversions: number;
	conversionsPrevious: number;
	convertingVisitors: number;
	conversionRate: number;
}

/**
 * The goal's numbers for the period. Conversions lead; the others explain them.
 * Converting visitors only shows when it differs from conversions: for goals
 * counted per visitor the two are always equal.
 *
 * @param {GoalKpisProps} props                     Component props.
 * @param {number}        props.conversions         Conversions in the period.
 * @param {number}        props.conversionsPrevious Conversions in the previous period.
 * @param {number}        props.convertingVisitors  Visitors who converted at least once.
 * @param {number}        props.conversionRate      Converting visitors as a percentage of all visitors.
 * @return {JSX.Element} The KPI row.
 */
const GoalKpis = ({ conversions, conversionsPrevious, convertingVisitors, conversionRate }: GoalKpisProps ): JSX.Element => (
	<dl className="flex flex-wrap items-end gap-x-10 gap-y-4">
		<div className="flex flex-col gap-1">
			<dt className="text-sm text-text-gray">{__( 'Conversions', 'burst-statistics' )}</dt>
			<dd className="flex items-baseline gap-2">
				<span className="text-2xl font-bold text-text-black">{formatNumber( conversions )}</span>
				<GoalChange current={conversions} previous={conversionsPrevious} className="text-base" />
			</dd>
		</div>
		{convertingVisitors !== conversions && (
			<div className="flex flex-col gap-1">
				<dt className="text-sm text-text-gray">{__( 'Converting visitors', 'burst-statistics' )}</dt>
				<dd className="text-2xl font-semibold text-text-black">{formatNumber( convertingVisitors )}</dd>
			</div>
		)}
		<div className="flex flex-col gap-1">
			<dt className="text-sm text-text-gray">{__( 'Conversion rate', 'burst-statistics' )}</dt>
			<dd className="text-2xl font-semibold text-text-black">{formatPercentage( conversionRate )}</dd>
		</div>
	</dl>
);

export default GoalKpis;
