import React, { useMemo } from "react";
import { ResponsiveFunnel } from "@nivo/funnel";
import { FunnelStepLabels } from "./FunnelStepLabels";
import { FunnelStepStatistics } from "./FunnelStepStatistics";
import { FunnelTooltip } from "./FunnelTooltip";
import { FunnelChartProps, StepStatistics, BiggestDropOff, FunnelStep } from "./types";
import { __, sprintf } from "@wordpress/i18n";
/**
 * FunnelChart component to render a funnel chart using Nivo.
 *
 * @param {FunnelChartProps} props - The properties for the FunnelChart component.
 *
 * @return {JSX.Element} The rendered funnel chart.
 */
export const FunnelChart: React.FC<FunnelChartProps> = ({ data, salesData }) => {
    const formattedData = useMemo(
        () =>
            data.map((item) => ({
                id: item.id,
                value: item.value,
                label: item.stage,
            })),
        [data]
    );

    // Calculate statistics for each step.
    const statistics = useMemo(() => {
        const totalValue = data[0]?.value || 1;
        const stats: StepStatistics[] = data.map((item, index) => {
            const currentValue = item.value;
            const nextValue = data[index + 1]?.value ?? 0;
            const percentage = (currentValue / totalValue) * 100;
            const dropOff = index < data.length - 1 ? currentValue - nextValue : null;
            const dropOffPercentage =
                index < data.length - 1
                    ? currentValue === 0
                        ? 0
                        : (dropOff! / currentValue) * 100
                    : null;

            return {
                label: item.stage,
                value: currentValue,
                percentage,
                dropOff,
                dropOffPercentage,
                isHighestDropOff: false,
            };
        });

        // Find the highest drop-off percentage.
        const validDropOffs = stats
            .map((s) => s.dropOffPercentage ?? -Infinity)
            .filter((v) => !isNaN(v) && v > 0);

        const highestDropOffValue = validDropOffs.length > 0 ? Math.max(...validDropOffs) : null;

        // Mark the step with the highest drop-off.
        let highestMarked = false;
        stats.forEach((stat, index) => {
            if (
                !highestMarked &&
                highestDropOffValue !== null &&
                stats[index] &&
                stats[index].dropOffPercentage === highestDropOffValue
            ) {
                stat.isHighestDropOff = true;
                highestMarked = true;
            }
        });

        return stats;
    }, [data]);

    return (
        <div className="border-t border-t-divider">
            <div className="grid" style={{ gridTemplateRows: 'auto 1fr auto', minHeight: '300px' }}>
                {/* Step labels - top layer */}
                <div style={{ gridRow: '1', gridColumn: '1' }}>
                    <FunnelStepLabels steps={statistics} />
                </div>

                {/* Funnel chart - middle layer, spans all rows, inverted */}
                <div 
                    style={{ 
                        gridRow: '1 / -1', 
                        gridColumn: '1', 
                        zIndex: 0,
                        height: '100%'
                    }}
                >
                    <ResponsiveFunnel
                        data={formattedData}
                        spacing={4}
                        margin={{
                            left: 0,
                            right: 0,
                            bottom: 0,
                            top: 0,
                        }}
                        shapeBlending={0.35}
                        direction="horizontal"
                        enableLabel={false}
                        enableBeforeSeparators={true}
                        enableAfterSeparators={true}
                        beforeSeparatorLength={50}
                        afterSeparatorLength={70}
                        borderWidth={0}
                        currentPartSizeExtension={5}
                        animate={true}
                        borderColor="#2E8A37"
                        interpolation="smooth"
                        colors="#2E8A37"
                        motionConfig="gently"
                        tooltip={({ part }) => {
                            const currentIndex = data.findIndex((item) => item.id === part.data.id);
                            const totalValue = data[0]?.value || 1;
                            const currentValue = part.data.value;
                            const previousValue = currentIndex > 0 ? data[currentIndex - 1].value : 0;
                            const nextValue = currentIndex < data.length - 1 ? data[currentIndex + 1].value : 0;

                            // Calculate conversion from previous step.
                            const conversionInRate = previousValue > 0 ? (currentValue / previousValue) * 100 : 100;

                            // Calculate drop-off to next step.
                            const dropoffOutRate = currentIndex < data.length - 1 && currentValue > 0
                                ? ((currentValue - nextValue) / currentValue) * 100
                                : 0;

                            // Calculate lost sessions.
                            const lostSessions = currentIndex < data.length - 1 ? currentValue - nextValue : 0;

                            // Calculate potential gain to final step (sales).
                            const improvementPercentage = 10;
                            const lastStepValue = data[data.length - 1]?.value || 0;
                            
                            // Calculate conversion rate from next step to last step.
                            const conversionToLastStep = currentIndex < data.length - 1 && nextValue > 0
                                ? lastStepValue / nextValue
                                : 0;
                            
                            // Calculate potential gain: saved sessions * conversion rate to final step.
                            const savedSessions = Math.round((lostSessions * improvementPercentage) / 100);
                            const potentialGain = Math.round(savedSessions * conversionToLastStep);
                            
                            const potentialGainText = currentIndex < data.length - 1
                                ? sprintf(__('Improving this by %s%% could lead to ~%d more sales.', "burst-statistics"), improvementPercentage, potentialGain)
                                : '';
                            const tooltipData = {
                                stepTitle: part.data.label,
                                sessionCount: currentValue,
                                sessionPercentage: (currentValue / totalValue) * 100,
                                conversionInRate,
                                dropoffOutRate,
                                lostSessions,
                                potentialGainText,
                            };

                            return <FunnelTooltip data={tooltipData} />;
                        }}
                    />
                </div>

                {/* Step statistics - top layer above funnel */}
                <div style={{ gridRow: '3', gridColumn: '1', zIndex: 1, pointerEvents: 'none' }}>
                    <FunnelStepStatistics steps={statistics} />
                </div>
            </div>

        </div>
    );
};

