import HelpTooltip from '@/components/Common/HelpTooltip';

interface TopPerformersProps {
	title: string;
	subtitle: string | null;
	value: string | number;
	exactValue: number | null;
	change: string | null;
	changeStatus: string | null;
	className?: string;
	tooltipText: string;
}

/**
 * SalesStats component.
 *
 * @param {Object}        props              Component props.
 * @param {string}        props.title        Title of the item.
 * @param {string|null}   props.subtitle     Subtitle of the item.
 * @param {string|number} props.value        Display value of the item.
 * @param {number|null}   props.exactValue   Exact numeric value for tooltip (if > 1000).
 * @param {string|null}   props.change       Change value to display.
 * @param {string|null}   props.changeStatus Status of the change ('positive' or 'negative').
 * @param {string}        props.tooltipText  Tooltip text for additional info.
 * @param {string}        [props.className]  Optional additional class names.
 *
 * @return {JSX.Element} The rendered component.
 */
const TopPerformerStats = ({
	title,
	subtitle,
	value,
	exactValue,
	change,
	changeStatus,
	tooltipText,
	className = ''
}: TopPerformersProps ): JSX.Element => {
	return (
		<div className={`flex items-center gap-3 py-2 ${className}`}>
			<div className="flex-1 flex flex-col justify-center label">
				<h3 className="text-sm font-normal text-gray">{title}</h3>

				{subtitle && (
					<p className="text-base font-semibold text-black">
						{subtitle}
					</p>
				)}
			</div>

			<div className="text-right">
				{
					exactValue && 1000 < exactValue ? (
						<HelpTooltip content={ tooltipText } delayDuration={1000}>
							<span className="text-xl font-bold text-black value">
								{value}
							</span>
						</HelpTooltip>
					) : (
						<span className="text-xl font-bold text-black value">
							{value}
						</span>
					)
				}

				<p
					className={`text-sm ${
						'positive' === changeStatus ? 'text-green' :
						'negative' === changeStatus ? 'text-red' :
						'text-gray'
					}`}
				>
					{change ?? '-'}
				</p>
			</div>
		</div>
	);
};

export default TopPerformerStats;
