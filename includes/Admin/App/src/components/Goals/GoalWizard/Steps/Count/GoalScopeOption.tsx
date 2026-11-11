import { clsx } from 'clsx';

interface GoalScopeOptionProps {

	// Radio group name, shared by the options of one goal.
	name: string;
	value: string;
	title: string;
	description: string;
	isSelected: boolean;
	onSelect: ( value: string ) => void;
	children?: React.ReactNode;
}

/**
 * One answer to "where should it count?", as a radio card.
 *
 * @param {GoalScopeOptionProps} props             Component props.
 * @param {string}               props.name        Radio group name.
 * @param {string}               props.value       The page_or_website value this option sets.
 * @param {string}               props.title       The option.
 * @param {string}               props.description When to choose it.
 * @param {boolean}              props.isSelected  Whether it is chosen.
 * @param {Function}             props.onSelect    Called with the value when chosen.
 * @param {React.ReactNode}      [props.children]  Optional content rendered inside the card.
 * @return {JSX.Element} The option.
 */
// fallow-ignore-next-line complexity
const GoalScopeOption = ({ name, value, title, description, isSelected, onSelect, children }: GoalScopeOptionProps ): JSX.Element => (
	<label
		data-tour={`wizard-format-${value}`}
		onClick={() => {
			if ( ! isSelected ) {
				onSelect( value );
			}
		}}
		className={clsx(
			'flex cursor-pointer items-start gap-4 rounded-xl border p-5 transition-colors',
			isSelected ? 'border-green bg-green-50' : 'border-gray-200 bg-white hover:border-gray-400'
		)}
	>
		<input
			type="radio"
			name={name}
			value={value}
			checked={isSelected}
			onChange={() => onSelect( value )}
			className="peer sr-only"
		/>

		{/* Drawn radio: the native one disappears on the dark theme. */}
		<span
			aria-hidden="true"
			className={clsx(
				'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-green',
				isSelected ? 'border-green bg-green' : 'border-gray-400'
			)}
		>
			{isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
		</span>
		<span className="flex flex-1 flex-col gap-1">
			<span className="text-base font-semibold text-text-black">{title}</span>
			<span className="text-sm text-text-gray">{description}</span>
			{isSelected && children && (
				<div className="mt-3 cursor-default" onClick={( e ) => e.stopPropagation()}>
					{children}
				</div>
			)}
		</span>
	</label>
);

export default GoalScopeOption;
