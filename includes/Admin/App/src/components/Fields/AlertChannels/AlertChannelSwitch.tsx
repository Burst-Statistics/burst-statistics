import { __, sprintf } from '@wordpress/i18n';
import SwitchInput from '@/components/Inputs/SwitchInput';
import HelpTooltip from '@/components/Common/HelpTooltip';

interface AlertChannelSwitchProps {

	/** Id of the switch, unique on the page. */
	id: string;

	/** Name of the alert, for the accessible label. */
	alertLabel: string;

	/** Name of the channel, for the accessible label. */
	channelLabel: string;
	checked: boolean;
	onChange: ( checked: boolean ) => void;

	/** Why the switch can't be used. Shown in a tooltip; no reason means the switch is available. */
	unavailableReason?: string;
}

/**
 * One cell of the alert grid: the switch that sends an alert to a channel.
 * An unavailable switch is shown off and disabled, with the reason in a tooltip.
 *
 * @param {AlertChannelSwitchProps} props Component props.
 * @return {JSX.Element} The switch cell.
 */
const AlertChannelSwitch = ({
	id,
	alertLabel,
	channelLabel,
	checked,
	onChange,
	unavailableReason
}: AlertChannelSwitchProps ) => {
	const isAvailable = ! unavailableReason;
	const ariaLabel = sprintf(

		// translators: 1: channel name (Email or Slack), 2: alert name, e.g. "Traffic spike".
		__( '%1$s: %2$s', 'burst-statistics' ),
		channelLabel,
		alertLabel
	);

	const switchInput = (
		<SwitchInput
			id={id}
			value={isAvailable && checked}
			onChange={onChange}
			disabled={! isAvailable}
			size="small"
			aria-label={ariaLabel}
		/>
	);

	return (
		<div className="flex justify-center">
			{isAvailable ? switchInput : (
				<HelpTooltip content={unavailableReason} asChild>
					<span className="inline-flex">{switchInput}</span>
				</HelpTooltip>
			)}
		</div>
	);
};

export default AlertChannelSwitch;
