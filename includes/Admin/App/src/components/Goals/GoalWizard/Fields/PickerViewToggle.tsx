import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import HelpTooltip from '@/components/Common/HelpTooltip';

interface PickerViewToggleProps {

	// Whether the site is shown as a logged out visitor sees it.
	loggedOut: boolean;
	onToggle: () => void;
}

/**
 * Switch the picked page between the visitor view and the logged in view.
 *
 * Some elements only show for visitors, e.g. a login link, or only for logged in users.
 *
 * @param {PickerViewToggleProps} props           Component props.
 * @param {boolean}               props.loggedOut Whether the visitor view is shown.
 * @param {Function}              props.onToggle  Switches the view.
 * @return {JSX.Element} The toggle.
 */
const PickerViewToggle = ({ loggedOut, onToggle }: PickerViewToggleProps ): JSX.Element => (
	<HelpTooltip
		content={loggedOut ?
			__( 'Switch to your logged in view of the site.', 'burst-statistics' ) :
			__( 'Switch to the view a visitor sees.', 'burst-statistics' )}
	>
		<button
			type="button"
			onClick={onToggle}
			aria-pressed={loggedOut}
			className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-text-gray transition-colors hover:bg-gray-100"
		>
			<Icon name={loggedOut ? 'log-out' : 'log-in'} size={16} color="gray" />
			{loggedOut ?
				__( 'Viewing as a visitor', 'burst-statistics' ) :
				__( 'Viewing as you, logged in', 'burst-statistics' )}
		</button>
	</HelpTooltip>
);

export default PickerViewToggle;
