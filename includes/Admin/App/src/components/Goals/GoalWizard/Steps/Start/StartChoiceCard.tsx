import { ReactNode } from 'react';
import { clsx } from 'clsx';
import Icon from '@/utils/Icon';

interface StartChoiceCardProps {
	icon: string;
	title: string;
	description: string;
	badge?: ReactNode;
	isSelected: boolean;
	disabled?: boolean;
	onSelect: () => void;
	dataTour: string;
}

/**
 * A choice on the first step, as a card: how to start, or what kind of goal to build.
 *
 * @param {StartChoiceCardProps} props Component props.
 * @return {JSX.Element} The choice card.
 */
const StartChoiceCard = ({ icon, title, description, badge, isSelected, disabled = false, onSelect, dataTour }: StartChoiceCardProps ): JSX.Element => {
	return (
		<button
			type="button"
			onClick={onSelect}
			disabled={disabled}
			aria-pressed={isSelected}
			data-tour={dataTour}
			className={clsx(
				'flex flex-1 items-start gap-4 rounded-xl border p-5 text-left transition-colors',
				isSelected ? 'border-green bg-green-50' : 'border-gray-200 bg-white hover:border-gray-400',
				disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
			)}
		>
			<Icon name={icon} size={22} color={isSelected ? 'green' : 'gray'} className="mt-0.5 shrink-0" />
			<span className="flex flex-col gap-1">
				<span className="flex items-center gap-2 text-base font-semibold text-text-black">
					{title}
					{badge}
				</span>
				<span className="text-sm text-text-gray">{description}</span>
			</span>
		</button>
	);
};

export default StartChoiceCard;
