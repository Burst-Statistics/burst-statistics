import Icon from '../../utils/Icon';
import HelpTooltip from '@/components/Common/HelpTooltip';

/**
 * ExplanationAndStatsItem component.
 *
 * @param {Object}        props              Component props.
 * @param {string}        props.title        Title of the item.
 * @param {string|null}   props.subtitle     Subtitle of the item.
 * @param {string|number} props.value        Display value of the item.
 * @param {number|null}   props.exactValue   Exact numeric value for tooltip (if > 1000).
 * @param {string|null}   props.change       Change value to display.
 * @param {string|null}   props.changeStatus Status of the change ('positive' or 'negative').
 * @param {string|null}   [props.iconKey]    Optional key for icon display. Default is null.
 * @param {string}        [props.className]  Optional additional class names. Default is ''.
 * @param {string|null}   [props.tooltipText] Optional text for tooltip display. Default is null.param
 *
 * @return {JSX.Element} The rendered component.
 */
const ExplanationAndStatsItem = ({
	title,
	subtitle,
	value,
	exactValue,
	change,
	changeStatus,
	iconKey = null,
	className = '',
	tooltipText = null
}) => {

	if ( exactValue && 1000 < exactValue ) {
		tooltipText = tooltipText ? tooltipText : exactValue.toLocaleString();
	}

	return (
		<div className={`flex items-start gap-3 py-2 ${className}`}>
			{iconKey && <Icon name={iconKey} className="mt-1" />}

			<div className="flex-1 label">
				<h3 className="text-base font-semibold text-black">{title}</h3>

				{subtitle && <p className="text-sm text-gray">{subtitle}</p>}
			</div>

			<div className="text-right">
				{
					exactValue && 1000 < exactValue && tooltipText ? (
					<HelpTooltip content={ tooltipText } delayDuration={1000}>
						<span className="text-xl font-bold text-black value">
							{value}
						</span>
					</HelpTooltip>
				) : (
					<span className="text-xl font-bold text-black value">
						{value}
					</span>
				)}

				<p
					className={`text-sm ${'positive' === changeStatus ? 'text-green' : 'text-red'}`}
				>
					{change}
				</p>
			</div>
		</div>
	);
};

export default ExplanationAndStatsItem;
