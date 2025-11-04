import HelpTooltip from '@/components/Common/HelpTooltip';

interface TopPerformersProps {
    title: string;
    subtitle: string;
    value: string | number;
    exactValue: number;
    change: string;
    changeStatus: string;
}

/**
 * SalesStats component.
 *
 * @param {Object} props Component props.
 * @param {string} props.title Title of the item.
 * @param {string} props.subtitle Subtitle of the item.
 * @param {string|number} props.value Display value of the item.
 * @param {number} props.exactValue Exact numeric value for tooltip (if > 1000).
 * @param {string} props.change Change value to display.
 * @param {string} props.changeStatus Status of the change ('positive' or 'negative').
 *
 * @returns {JSX.Element} The rendered component.
 */
const TopPerformerStats = ( {
    title,
    subtitle,
    value,
    exactValue,
    change,
    changeStatus,
}: TopPerformersProps ): JSX.Element => {
    const tooltipValue = 1000 < exactValue ? exactValue : false;
    return (
        <div className="flex items-center gap-3 py-2">
            <div className="flex-1 flex flex-col justify-center">
				<h3 className="text-sm font-normal text-gray">{ title }</h3>

                {
                    subtitle && ( <p className="text-base font-semibold text-black">{ subtitle }</p> )
                }
			</div>

			<div className="text-right">
				{
                    tooltipValue ?
                        (
                            <HelpTooltip content={ tooltipValue } delayDuration={ 1000 }>
								<span className="text-xl font-bold text-black">{ value }</span>
							</HelpTooltip>
                        ) :
                        <span className="text-xl font-bold text-black">{ value }</span>
                }

                <p className={`text-sm ${'positive' === changeStatus ? 'text-green' : 'text-red'}`}>
					{ change }
				</p>
			</div>
		</div>
    );
};

export default TopPerformerStats;
