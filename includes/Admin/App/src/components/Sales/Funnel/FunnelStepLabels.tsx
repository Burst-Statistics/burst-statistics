import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { StepStatistics } from './types';
import { formatNumber, formatPercentage } from '@/utils/formatting';

/**
 * Component to render step labels above the funnel chart, or as a left-hand
 * column with inline statistics on mobile (hover tooltips are unavailable
 * on touch devices).
 *
 * @param {Object}           props          - The component props.
 * @param {StepStatistics[]} props.steps    - The step statistics data.
 * @param {boolean}          props.isMobile - Whether to render the stacked mobile layout.
 *
 * @return {JSX.Element} The rendered step labels.
 */
export const FunnelStepLabels: React.FC<{
	steps: StepStatistics[];
	isMobile?: boolean;
}> = ({
	steps,
	isMobile = false
}) => {
	return (
		<div
			className={isMobile ? 'grid gap-1 z-2 h-full' : 'grid gap-1 z-2'}
			style={
				isMobile ?
					{ gridTemplateRows: `repeat(${steps.length}, 1fr)` } :
					{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }
			}
		>
			{steps.map( ( step, index ) => {
				const isLastStep = index === steps.length - 1;

				return (
					<div
						key={index}
						className={
							isMobile ?
								'flex flex-col px-2 min-w-0 justify-center' :
								'flex flex-col px-2 pt-2 min-w-0'
						}
					>
						<span className="text-xxs text-text-gray-light uppercase tracking-wide">
							{sprintf( __( 'Step %d', 'burst-statistics' ), index + 1 )}
						</span>
						<span
							className="text-sm font-semibold text-text-black truncate"
							title={step.label}
						>
							{step.label}
						</span>
						{isMobile && (
							<span className="text-sm text-text-gray">
								{formatNumber( step.value, 0, false )}
							</span>
						)}
						{isMobile &&
							! isLastStep &&
							null !== step.dropOffPercentage &&
							! isNaN( step.dropOffPercentage ) && (
							<span
								className={`text-xs ${
									step.isHighestDropOff ?
										'text-red' :
										'text-text-gray-light'
								}`}
							>
								{'▼ '}
								{sprintf(
									__( '%s drop-off', 'burst-statistics' ),
									formatPercentage(
										step.dropOffPercentage,
										0 < step.dropOffPercentage &&
											10 > step.dropOffPercentage ?
											1 :
											0
									)
								)}
							</span>
						)}
						{isMobile && isLastStep && (
							<span className="text-xs text-text-gray-light">
								{sprintf(
									__( '%s conversion rate', 'burst-statistics' ),
									formatPercentage(
										step.percentage,
										0 < step.percentage &&
											10 > step.percentage ?
											1 :
											0
									)
								)}
							</span>
						)}
					</div>
				);
			})}
		</div>
	);
};
