import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';

interface WizardCloseButtonProps {
	onClose: () => void;

	// Tour anchor, e.g. 'wizard-close'.
	dataTour: string;
}

/**
 * Round button that closes a wizard.
 *
 * @param {WizardCloseButtonProps} props          Component props.
 * @param {Function}               props.onClose  Closes the wizard.
 * @param {string}                 props.dataTour Tour anchor.
 * @return {JSX.Element} The close button.
 */
const WizardCloseButton = ({ onClose, dataTour }: WizardCloseButtonProps ): JSX.Element => (
	<button
		data-tour={dataTour}
		type="button"
		className="bg-gray-100 border border-gray-400 focus:ring-blue-500 rounded-full p-2 sm:p-2.5 transition-all duration-200 hover:bg-gray-400 hover:shadow-md focus:outline-hidden focus:ring-2 focus:ring-offset-2 cursor-pointer"
		onClick={onClose}
		aria-label={__( 'Close', 'burst-statistics' )}
	>
		<Icon name="times" />
	</button>
);

export default WizardCloseButton;
