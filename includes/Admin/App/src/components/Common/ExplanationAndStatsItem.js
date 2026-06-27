import Icon from '../../utils/Icon';
import HelpTooltip from '@/components/Common/HelpTooltip';
import MetricInfo from '@/components/Common/MetricInfo';
import { formatNumber } from '@/utils/formatting';

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
 * @param {string|null}   [props.tooltipText] Optional text for tooltip display. Default is null.
 * @param {string|null}   [props.metricKey]  Optional metric key to show a metric-explainer ⓘ icon.
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
	tooltipText = null,
	metricKey = null
}) => {

	if ( exactValue && 1000 < exactValue ) {
		tooltipText = tooltipText ? tooltipText : formatNumber( exactValue, 1, false );
	}

	return (
		<div className={`flex items-start gap-3 py-2 ${className}`}>
			{iconKey && <Icon name={iconKey} className="mt-1" />}

		<div className="flex-1 label min-w-0">
			<h3 className="text-base font-semibold text-text-black">
				{ metricKey ? (
					<MetricInfo metricKey={ metricKey } side="top">{ title }</MetricInfo>
				) : (
					title
				) }
			</h3>

			{subtitle && <p className="text-sm text-text-gray">{subtitle}</p>}
		</div>

			<div className="text-right">
				{
					exactValue && 1000 < exactValue && tooltipText ? (
					<HelpTooltip content={ tooltipText } delayDuration={1000}>
						<span className="text-xl font-bold text-text-black value">
							{value}
						</span>
					</HelpTooltip>
				) : (
					<span className="text-xl font-bold text-text-black value">
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
