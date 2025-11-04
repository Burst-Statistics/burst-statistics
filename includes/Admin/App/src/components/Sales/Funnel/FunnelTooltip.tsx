import React from "react";
import { __, sprintf } from "@wordpress/i18n";

/**
 * Props interface for the FunnelTooltip component.
 */
interface FunnelTooltipProps {
    data: {
        stepTitle: string;
        sessionCount: number;
        sessionPercentage: number;
        conversionInRate: number;
        dropoffOutRate: number;
        lostSessions: number;
        potentialGainText: string;
    };
}

/**
 * FunnelTooltip component to display detailed information about a funnel step.
 *
 * @param {FunnelTooltipProps} props - The properties for the FunnelTooltip component.
 *
 * @return {JSX.Element} The rendered tooltip.
 */
export const FunnelTooltip: React.FC<FunnelTooltipProps> = ({ data }) => {
    const {
        stepTitle,
        sessionCount,
        sessionPercentage,
        conversionInRate,
        dropoffOutRate,
        lostSessions,
        potentialGainText,
    } = data;

    return (
        <div className="bg-white p-4 rounded-lg shadow-lg max-w-xs z-[3] relative">
            {/* Header */}
            <div className="mb-3 flex flex-col gap-1">
                <p className="text-sm font-light text-gray-600">
                    {
                        sprintf(
                            __("%s visitors (%s%%)", "burst-statistics"),
                            sessionCount.toLocaleString(),
                            sessionPercentage.toFixed(sessionPercentage > 0 && sessionPercentage < 10 ? 1 : 0)
                        )
                    }
                </p>
                <h3 className="text-md font-semibold text-gray-900">
                    {stepTitle}
                </h3>
            </div>


            {/* Transitions Data */}
            <div className="mb-5">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                        <span className="text-green font-semibold">▲</span>
                        <span className="text-base font-semibold text-gray-900">
                                {sprintf(__("%d%% conversion from previous step", "burst-statistics"), conversionInRate.toFixed(1))}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-red font-semibold">▼</span>
                        <span className="text-base font-semibold text-gray-900">
                            <span className="text-gray-700">
                                {sprintf(__("%d%% drop-off to next step", "burst-statistics"), dropoffOutRate.toFixed(1))}
                            </span>
                        </span>
                    </div>
                </div>
            </div>
            <div>
                <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-gray-900">
                        {sprintf(__("%d lost visitors", "burst-statistics"), lostSessions.toLocaleString())}
                    </p>
                    <p className="text-sm font-light text-gray-700">
                        {potentialGainText}
                    </p>
                </div>
            </div>
        </div>
    );
};

