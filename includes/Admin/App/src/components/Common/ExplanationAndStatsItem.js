import Icon from '../../utils/Icon';
import HelpTooltip from '@/components/Common/HelpTooltip';

/**
 * ExplanationAndStatsItem component.
 *
 * @param {Object} props Component props.
 * @param {string} props.title Title of the item.
 * @param {string} props.subtitle Subtitle of the item.
 * @param {string|number} props.value Display value of the item.
 * @param {number} props.exactValue Exact numeric value for tooltip (if > 1000).
 * @param {string} props.change Change value to display.
 * @param {string} props.changeStatus Status of the change ('positive' or 'negative').
 * @param {string|null} [props.iconKey] Optional key for icon display. Default is null.
 *
 * @returns {JSX.Element} The rendered component.
 */
const ExplanationAndStatsItem = ( {
	title,
	subtitle,
	value,
	exactValue,
	change,
	changeStatus,
	iconKey = null,
} ) => {
	const tooltipValue = 1000 < exactValue ? exactValue : false;
	return (
	  <div className="flex items-start gap-3 py-2">
			{
			  iconKey && ( <Icon name={ iconKey } className="mt-1" /> )
			}

		  <div className="flex-1">
				<h3 className="text-base font-semibold text-black">{ title }</h3>

				<p className="text-sm text-gray">{ subtitle }</p>
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

export default ExplanationAndStatsItem;
