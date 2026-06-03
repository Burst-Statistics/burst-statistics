import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { StepStatistics } from './types';
import Icon from '@/utils/Icon';
import { formatNumber, formatPercentage } from '@/utils/formatting';

/**
 * Component to render step statistics below the funnel chart.
 *
 * @param {Object}           props       - The component props.
 * @param {StepStatistics[]} props.steps - The step statistics data.
 *
 * @return {JSX.Element} The rendered step statistics.
 */
export const FunnelStepStatistics: React.FC<{
	steps: StepStatistics[];
}> = ({ steps }) => {
	const displaySteps = steps.slice( 0, -1 );
	const lastStep = steps[steps.length - 1];

	return (
		<div
			className="grid gap-px z-2 items-start"
			style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}
		>
			{displaySteps.map( ( step, index ) => (
				<div key={index} className="flex flex-col gap-2 px-2 py-3">
					{null !== step.dropOffPercentage &&
						! isNaN( step.dropOffPercentage ) && (
							<div className="flex flex-col gap-1">
								<div
									className={`relative z-2 w-20 h-20 mx-auto rounded-full flex flex-col items-center justify-center gap-0.5 shadow-sm ${
										step.isHighestDropOff ?
											'bg-red-100' :
											'bg-gray-200'
									}`}
								>
									<span
										className={`text-xl font-bold text-center ${
											step.isHighestDropOff ?
												'text-red' :
												'text-text-gray'
										}`}
									>
										{formatPercentage(
											step.dropOffPercentage,
											0 < step.dropOffPercentage &&
												10 > step.dropOffPercentage ?
												1 :
												0
										)}
									</span>
									<span className="text-xxs uppercase tracking-wide text-text-gray-light">
										drop-off
									</span>
								</div>

								{/* Secondary Metric: Lost sessions (smaller font) */}
								{null !== step.dropOff && 0 <= step.dropOff && (
									<span className="text-xs text-center text-text-gray mt-1">
										{sprintf(
											__(
												'%s lost visitors',
												'burst-statistics'
											),
											formatNumber(
												step.dropOff,
												0,
												false
											)
										)}
									</span>
								)}
							</div>
						)}
				</div>
			) )}

			{/* Last step: Purchased summary card */}
			{lastStep && (
				<div className="flex flex-col gap-2 px-2 py-3 self-end">
					<div className="flex flex-col gap-1">
						<div className="relative z-2 w-12 h-12 mx-auto rounded-full flex flex-col items-center justify-center gap-0.5 shadow-sm bg-green-300">
							<Icon name="check" color="green" size={24} />
						</div>

						<p className="mt-2 text-xs text-center text-text-gray">
							{sprintf(
								__( '%s visitors purchased', 'burst-statistics' ),
								formatNumber( lastStep.value, 0, false )
							)}
						</p>

						<p className="text-xs text-center text-text-gray">
							{sprintf(
								__( '%s conversion rate', 'burst-statistics' ),
								formatPercentage(
									lastStep.percentage,
									0 < lastStep.percentage &&
										10 > lastStep.percentage ?
										1 :
										0
								)
							)}
						</p>
					</div>
				</div>
			)}
		</div>
	);
};
