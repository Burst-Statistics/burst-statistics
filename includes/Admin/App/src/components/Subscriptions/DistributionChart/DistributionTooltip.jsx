import { ChartTooltip } from '@/components/Common/ChartTooltip';

/**
 * Custom tooltip for the distribution pie chart.
 *
 * @param {Object} props        - Tooltip props supplied by Nivo.
 * @param {string} props.datum  - The slice datum containing id, label, value, and color.
 * @return {JSX.Element} The tooltip element.
 */
export function DistributionTooltip({ datum }) {
	return (
		<ChartTooltip>
			<div className="flex items-center gap-2">
				<span
					className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
					style={{ backgroundColor: datum.color }}
				/>
				<span className="text-gray-600">{ datum.label }:</span>
				<span className="font-medium text-gray-800 ml-auto">{ datum.value }%</span>
			</div>
		</ChartTooltip>
	);
}
