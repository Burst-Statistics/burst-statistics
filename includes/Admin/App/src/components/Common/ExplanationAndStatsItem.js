import Icon from '../../utils/Icon';
import HelpTooltip from '@/components/Common/HelpTooltip';
import MetricInfo from '@/components/Common/MetricInfo';
import { formatNumber } from '@/utils/formatting';
import { Link } from '@tanstack/react-router';

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
 * @param {string|null}   [props.communityTooltipText] Optional text for community percentile/devices tooltip.
 * @param {boolean|null}  [props.communityTooltipLink] Optional flag to link community tooltip icon to settings.
 *
 * @return {JSX.Element} The rendered component.
 */
// fallow-ignore-next-line complexity
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
	metricKey = null,
	communityTooltipText = null,
	communityTooltipLink = null
}) => {

	if ( exactValue && 1000 < exactValue ) {
		tooltipText = tooltipText ? tooltipText : formatNumber( exactValue, 1, false );
	}

	// fallow-ignore-next-line complexity
	const renderValue = () => {

		// The raw value text — may be wrapped in a large-number tooltip.
		const valueText = exactValue && 1000 < exactValue && tooltipText ? (
			<HelpTooltip content={ tooltipText } delayDuration={1000}>
				<span>{value}</span>
			</HelpTooltip>
		) : (
			<span>{value}</span>
		);

		return (
			<span className="text-xl font-bold text-text-black value flex items-center justify-end gap-1.5">
				{communityTooltipText && (
					<HelpTooltip content={ communityTooltipText } delayDuration={200}>
						{communityTooltipLink ? (
							<Link
								to="/settings/$settingsId"
								params={{ settingsId: 'general' }}
								className="text-text-gray hover:text-primary transition-colors flex items-center"
							>
								<Icon name="compare-arrows" size={16} />
							</Link>
						) : (
							<span className="text-text-gray flex items-center">
								<Icon name="compare-arrows" size={16} />
							</span>
						)}
					</HelpTooltip>
				)}
				{valueText}
			</span>
		);
	};

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
				{renderValue()}

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
