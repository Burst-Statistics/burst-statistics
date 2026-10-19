import SelectPageField from '@/components/Fields/SelectPageField';

// SelectPageField is untyped JSX; these are the props this input passes to it.
const PageField = SelectPageField as React.ComponentType<{
	id: string;
	field: { value: string };
	goal: { type: string; is_draft: boolean };
	label: string;
	className: string;
	onChange: ( page: string ) => void;
}>;

interface GoalPageInputProps {
	goalId: number;

	// Overrides the input id when a second page input for the same goal can be on screen.
	inputId?: string;

	// Click and view goals treat no page as the home page; the field shows '/' for them.
	goalType: string;

	// Whether the goal's page is a draft, so its url is not final yet.
	isDraft: boolean;
	page: string;

	// Step specific wording, e.g. "Page it appears on".
	label: string;
	onChange: ( page: string ) => void;
}

/**
 * The page a goal is set up on, picked from the site's pages or typed as a path.
 *
 * @param {GoalPageInputProps} props          Component props.
 * @param {number}             props.goalId   Goal id, for the input id.
 * @param {string}             props.inputId  Optional input id instead of the one built from the goal id.
 * @param {string}             props.goalType The goal type.
 * @param {boolean}            props.isDraft  Whether the page is a draft.
 * @param {string}             props.page     The current page path.
 * @param {string}             props.label    The question shown above the input.
 * @param {Function}           props.onChange Called with the chosen page path.
 * @return {JSX.Element} The page input.
 */
const GoalPageInput = ({ goalId, inputId, goalType, isDraft, page, label, onChange }: GoalPageInputProps ): JSX.Element => {
	return (
		<div data-tour="goal-field-specific_page">
			<PageField
				id={inputId ?? `goal-${goalId}-page`}
				field={{ value: page }}
				goal={{ type: goalType, is_draft: isDraft }}
				label={label}
				className="!px-0"
				onChange={onChange}
			/>
		</div>
	);
};

export default GoalPageInput;
