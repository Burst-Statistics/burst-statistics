import React from "react";
import { __, sprintf } from "@wordpress/i18n";
import { StepStatistics } from "./types";

/**
 * Component to render step labels above the funnel chart.
 *
 * @param {Object} props - The component props.
 * @param {StepStatistics[]} props.steps - The step statistics data.
 *
 * @return {JSX.Element} The rendered step labels.
 */
export const FunnelStepLabels: React.FC<{ steps: StepStatistics[] }> = ({ steps }) => {
    return (
        <div className="grid gap-1 z-2" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
            {steps.map((step, index) => (
                <div key={index} className="flex flex-col px-2 pt-2 min-w-0">
                    <span className="text-xxs text-gray-600 uppercase tracking-wide">
                        {sprintf(__("Step %d", "burst-statistics"), index + 1)}
                    </span>
                    <span className="text-sm font-semibold text-black truncate" title={step.label}>
                        {step.label}
                    </span>
                </div>
            ))}
        </div>
    );
};

