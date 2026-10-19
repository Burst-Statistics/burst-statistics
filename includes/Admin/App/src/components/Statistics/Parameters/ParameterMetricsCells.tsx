import React, { memo } from 'react';
import { formatNumber } from '@/utils/formatting';
import ParameterShareBar from './ParameterShareBar';

interface ParameterMetricsCellsProps {

	/** Count of pageviews to display. */
	views: number;

	/** Count of visitors to display. */
	visitors: number;

	/** Percentage share value between 0 and 100. */
	share: number;
}

/**
 * Standard metrics cells (views, visitors, share bar) for expandable sub-row tables.
 *
 * @param {ParameterMetricsCellsProps} props Component props.
 * @return {JSX.Element} Fragment containing the three standard table cells.
 */
const ParameterMetricsCells: React.FC<ParameterMetricsCellsProps> = ({
	views,
	visitors,
	share
}) => {
	return (
		<>
			<td className="px-3 py-2 text-right font-medium tabular-nums text-text-black">
				{formatNumber( views, 0, false )}
			</td>
			<td className="px-3 py-2 text-right tabular-nums text-text-gray">
				{formatNumber( visitors, 0, false )}
			</td>
			<td className="py-2 pl-3 pr-4 text-right">
				<ParameterShareBar share={share} />
			</td>
		</>
	);
};

export default memo( ParameterMetricsCells );
