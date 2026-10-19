import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import ButtonInput from '@/components/Inputs/ButtonInput';
import type useSelectorMatches from '@/hooks/useSelectorMatches';
import SelectedElementPreview from './SelectedElementPreview';
import ElementMatchChips from './ElementMatchChips';

interface SelectedElementCardProps {
	selector: string;

	// Page the element was found on, e.g. '/pricing/'.
	page: string;

	// Match state of the selector on that page.
	matches: ReturnType<typeof useSelectorMatches>;
	onPickAgain: () => void;
	onEditSelector: () => void;
}

/**
 * The picked element: how it looks on the site, its selector, where it was found and how often it matches there.
 *
 * @param {SelectedElementCardProps} props                Component props.
 * @param {string}                   props.selector       The goal's CSS selector.
 * @param {string}                   props.page           The page the element was found on.
 * @param {Object}                   props.matches        Match state of the selector.
 * @param {Function}                 props.onPickAgain    Opens the picker.
 * @param {Function}                 props.onEditSelector Opens the selector input.
 * @return {JSX.Element} The card.
 */
const SelectedElementCard = ({ selector, page, matches, onPickAgain, onEditSelector }: SelectedElementCardProps ): JSX.Element => {
	return (
		<div className="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white p-5 sm:flex-row" data-tour="goal-field-selector">
			<SelectedElementPreview matches={matches} />

			<div className="flex min-w-0 flex-1 flex-col gap-3">
				<p className="text-xs font-semibold uppercase tracking-[0.05em] text-text-gray-light">
					{__( 'Selected element', 'burst-statistics' )}
				</p>
				<code className="break-all font-mono text-lg text-text-black">{selector}</code>

				<ElementMatchChips page={page} matchCount={matches.matchCount} />

				{matches.error && <p className="text-sm text-red">{matches.error}</p>}
				{matches.warning && <p className="text-sm text-text-gray">{matches.warning}</p>}

				<div className="mt-auto flex flex-wrap gap-2 pt-2">
					<ButtonInput btnVariant="tertiary" onClick={onPickAgain} className="flex items-center gap-2">
						<Icon name="mouse-pointer-click" size={16} color="gray" />
						{__( 'Pick again', 'burst-statistics' )}
					</ButtonInput>
					<ButtonInput btnVariant="tertiary" onClick={onEditSelector}>
						{__( 'Edit selector', 'burst-statistics' )}
					</ButtonInput>
				</div>
			</div>
		</div>
	);
};

export default SelectedElementCard;
