import { clsx } from 'clsx';

/**
 * Shared wrapper for all Nivo chart tooltips.
 * Provides consistent card styling (background, border, shadow, padding, radius) across all charts.
 *
 * @param {Object}      props           - Component props.
 * @param {import('react').ReactNode} props.children  - Tooltip content.
 * @param {string}      [props.className] - Additional Tailwind classes to merge.
 * @return {JSX.Element} The styled tooltip card wrapper.
 */
export function ChartTooltip({ children, className }) {
	return (
		<div
			className={ clsx(
				'bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-sm min-w-36',
				className
			) }
		>
			{ children }
		</div>
	);
}
