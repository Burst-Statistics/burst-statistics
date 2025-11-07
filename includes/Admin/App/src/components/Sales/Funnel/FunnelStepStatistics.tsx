import React from "react";
import { __, sprintf } from "@wordpress/i18n";
import { createInterpolateElement } from "@wordpress/element";
import { StepStatistics } from "./types";
import Icon from "@/utils/Icon";
/**
 * Component to render step statistics below the funnel chart.
 *
 * @param {Object} props - The component props.
 * @param {StepStatistics[]} props.steps - The step statistics data.
 *
 * @return {JSX.Element} The rendered step statistics.
 */
export const FunnelStepStatistics: React.FC<{ 
    steps: StepStatistics[];
}> = ({ steps }) => {
    const displaySteps = steps.slice(0, -1)
    const lastStep = steps[steps.length - 1];
    
    return (
        <div className="grid gap-[1px] z-2 items-start" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
            {displaySteps.map((step, index) => (
                <div
                    key={index}
                    className="flex flex-col gap-2 px-2 py-3"
                >
                    {step.dropOffPercentage !== null && !isNaN(step.dropOffPercentage) && (
                        <div className="flex flex-col gap-1">
                            <div className={`relative z-2 w-20 h-20 mx-auto rounded-full flex flex-col items-center justify-center gap-0.5 shadow-sm ${
                                step.isHighestDropOff ? 'bg-red-light' : 'bg-gray-200'
                            }`}>
                                <tspan className={`text-xl font-bold text-center ${
                                    step.isHighestDropOff ? 'text-red' : 'text-gray-700'
                                }`}>
                                    {step.dropOffPercentage.toFixed(step.dropOffPercentage > 0 && step.dropOffPercentage < 10 ? 1 : 0)}%
                                </tspan>
                                <tspan className="text-xxs uppercase tracking-wide text-gray-600">
                                    drop-off
                                </tspan>
                            </div>
                            
                            {/* Secondary Metric: Lost sessions (smaller font) */}
                            {step.dropOff !== null && step.dropOff > 0 && (
                                <span className="text-xs text-center text-gray mt-1">
                                    {sprintf(__("%d lost visitors", "burst-statistics"), step.dropOff)}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            ))}
            
            {/* Last step: Purchased summary card */}
            {lastStep && (
                <div className="flex flex-col gap-2 px-2 py-3 self-end">
                      <div className="flex flex-col gap-1">
                        <div className="relative z-2 w-12 h-12 mx-auto rounded-full flex flex-col items-center justify-center gap-0.5 shadow-sm bg-green-light">
                            <Icon name="check" color='green' size={24} />
                        </div>

                        <p className="mt-2 text-xs text-center text-gray">
                            {sprintf(__("%d visitors purchased", "burst-statistics"), lastStep.value)}
                        </p>

                        <p className="text-xs text-center text-gray">
                            {sprintf(__("%d%% conversion rate", "burst-statistics"), lastStep.percentage)} 
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

