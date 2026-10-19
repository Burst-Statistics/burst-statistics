import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import ButtonInput from '@/components/Inputs/ButtonInput';

/**
 * Shown until an element is chosen: one button that opens the site to pick it.
 *
 * @param {Object}   props        Component props.
 * @param {Function} props.onPick Opens the picker.
 * @return {JSX.Element} The prompt.
 */
const PickElementPrompt = ({ onPick }: { onPick: () => void }): JSX.Element => (
	<div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white p-10 text-center" data-tour="goal-field-selector">
		<Icon name="mouse-pointer-click" size={28} color="gray" />
		<p className="text-base text-text-gray">
			{__( 'No element picked yet.', 'burst-statistics' )}
		</p>
		<ButtonInput btnVariant="secondary" onClick={onPick} className="flex items-center gap-2">
			{__( 'Pick an element', 'burst-statistics' )}
		</ButtonInput>
	</div>
);

export default PickElementPrompt;
