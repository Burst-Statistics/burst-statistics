import { __, sprintf } from '@wordpress/i18n';
import { ChartTooltip } from '@/components/Common/ChartTooltip';
import { formatNumber, formatPercentage } from '@/utils/formatting';

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
		potentialGainText
	} = data;

	const sessionPercentageDecimals =
		0 < sessionPercentage && 10 > sessionPercentage ? 1 : 0;

	return (
        <ChartTooltip className="max-w-xs p-4 z-[3] relative">

        <div className="bg-gray-100 text-text-black p-4 rounded-lg shadow-lg max-w-xs z-3 relative">
			{/* Header */}
			<div className="mb-3 flex flex-col gap-1">
				<p className="text-sm font-light text-text-gray-light">
					{sprintf(
						__( '%1$s visitors (%2$s)', 'burst-statistics' ),
						formatNumber( sessionCount, 0, false ),
						formatPercentage(
							sessionPercentage,
							sessionPercentageDecimals
						)
					)}
				</p>
				<h3 className="text-md font-semibold text-text-gray">
					{stepTitle}
				</h3>
			</div>

			{/* Transitions Data */}
			<div className="mb-5">
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-1">
						<span className="text-green font-semibold">▲</span>
						<span className="text-base font-semibold text-text-gray">
							{sprintf(
								__(
									'%s conversion from previous step',
									'burst-statistics'
								),
								formatPercentage( conversionInRate, 1 )
							)}
						</span>
					</div>
					<div className="flex items-center gap-1">
						<span className="text-red font-semibold">▼</span>
						<span className="text-base font-semibold text-text-gray">
							<span className="text-text-gray">
								{sprintf(
									__(
										'%s drop-off to next step',
										'burst-statistics'
									),
									formatPercentage( dropoffOutRate, 1 )
								)}
							</span>
						</span>
					</div>
				</div>
			</div>
			<div>
				<div className="flex flex-col gap-1">
					<p className="text-sm font-semibold text-text-gray">
						{sprintf(
							__( '%s lost visitors', 'burst-statistics' ),
							formatNumber( lostSessions, 0, false )
						)}
					</p>
					<p className="text-sm font-light text-text-gray">
						{potentialGainText}
					</p>
				</div>
			</div>
        </div>
		</ChartTooltip>
	);
};
