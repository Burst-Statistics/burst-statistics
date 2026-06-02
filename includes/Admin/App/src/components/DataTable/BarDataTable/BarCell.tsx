import { memo } from 'react';
import { formatNumber } from '@/utils/formatting';

type BarCellProps = {

	/** The raw numeric value to display. */
	value: number;

	/** The highest value in the current dataset — used to compute the bar width. */
	max: number;
};

/**
 * Renders a table cell with a proportional background bar.
 *
 * The bar is an absolutely-positioned element behind the numeric text, giving
 * the reader an immediate visual sense of scale without obscuring the value.
 *
 * @param {Object} props       - Component props.
 * @param {number} props.value - The cell value.
 * @param {number} props.max   - The maximum value across all rows (used for scaling).
 * @return {JSX.Element} The bar cell.
 */
const BarCell = memo( ({ value, max }: BarCellProps ) => {
	const pct = 0 < max ? ( value / max ) * 100 : 0;

	return (
		<span className="relative flex items-center justify-end w-full h-full pr-0">
			{/* Background scale bar. */}
			<span
				aria-hidden="true"
				className="absolute inset-y-0.5 left-0 rounded-sm bg-primary-100 transition-[width] duration-300"
				style={{ width: `${pct}%` }}
			/>
			{/* Numeric text sits above the bar. */}
			<span className="relative z-10 font-medium text-text-black">
				{ formatNumber( value, 0, false ) }
			</span>
		</span>
	);
});

BarCell.displayName = 'BarCell';

export default BarCell;
