import React, { memo } from 'react';

interface ParameterShareBarProps {

	/** Percentage share value between 0 and 100. */
	share: number;

	/** Optional additional CSS classes for the container. */
	className?: string;
}

/**
 * Visual progress bar depicting share of pageviews or visitors.
 *
 * Renders a horizontal bar with a fill width matching the share percentage,
 * accompanied by a right-aligned tabular percentage label.
 *
 * @param {ParameterShareBarProps} props Component props.
 * @return {JSX.Element} Progress bar and percentage label.
 */
const ParameterShareBar: React.FC<ParameterShareBarProps> = ({ share, className = '' }) => {
	const clampedShare = Math.min( 100, Math.max( 0, Number( share ) || 0 ) );
	const formattedPercentage = 0 < clampedShare && 1 > clampedShare ? '<1%' : `${Math.round( clampedShare )}%`;

	return (
		<div
			className={`flex items-center justify-end gap-2.5 ${className}`}
			role="meter"
			aria-valuenow={clampedShare}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-label={formattedPercentage}
		>
			<div className="h-1.5 w-16 sm:w-24 overflow-hidden rounded-full bg-gray-200">
				<div
					className="h-full rounded-full bg-slate-400 transition-all duration-200"
					style={{ width: `${clampedShare}%` }}
				/>
			</div>
			<span className="min-w-[2.2rem] text-right font-normal text-xs tabular-nums text-text-gray">
				{formattedPercentage}
			</span>
		</div>
	);
};

export default memo( ParameterShareBar );
