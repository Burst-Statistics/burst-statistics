import { __ } from '@wordpress/i18n';
import { ChartTooltip } from '@/components/Common/ChartTooltip';
import { formatCurrency } from '@/utils/formatting';

/**
 * Custom tooltip for the new vs renewal chart.
 *
 * @param {Object} props          - Tooltip props supplied by Nivo.
 * @param {string} props.id       - The key of the hovered bar segment.
 * @param {number} props.value    - The raw value of the bar segment.
 * @param {string} props.color    - The bar color.
 * @param {Object} props.data     - The full data row for this bar.
 * @param {string} props.mode     - Current chart mode.
 * @param {string} props.currency - Base currency code for revenue mode.
 * @return {JSX.Element} The tooltip element.
 */
export function RevenueTooltip({ id, value, color, data, mode = 'revenue', currency = 'USD' }) {
	const isRevenueMode = 'revenue' === mode;
	const label = 'newValue' === id ?
		( isRevenueMode ? __( 'New Revenue', 'burst-statistics' ) : __( 'New Sales', 'burst-statistics' ) ) :
		( isRevenueMode ? __( 'Renewal Revenue', 'burst-statistics' ) : __( 'Renewal Sales', 'burst-statistics' ) );

	const total = ( data.newValue ?? 0 ) + ( data.renewalValue ?? 0 );
	const formatValue = ( amount ) => isRevenueMode ?
		formatCurrency( currency, Number( amount ?? 0 ) ) :
		Number( amount ?? 0 ).toLocaleString();

	return (
		<ChartTooltip>
			<p className="font-semibold text-gray-700 mb-1">{ data.label }</p>
			<div className="flex items-center gap-2">
				<span
					className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
					style={{ backgroundColor: color }}
				/>
				<span className="text-gray-600">{ label }:</span>
				<span className="font-medium text-gray-800 ml-auto">{ formatValue( value ) }</span>
			</div>
			<div className="border-t border-gray-100 mt-1.5 pt-1.5 flex justify-between text-gray-500">
				<span>{ __( 'Total', 'burst-statistics' ) }</span>
				<span className="font-medium text-gray-700">{ formatValue( total ) }</span>
			</div>
		</ChartTooltip>
	);
}
