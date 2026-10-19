interface GoalStepHeadingProps {

	// The step's question, e.g. "Where should a click count?".
	title: string;
	description: string;
}

/**
 * The question a wizard step asks, with one line on how to answer it.
 *
 * @param {GoalStepHeadingProps} props             Component props.
 * @param {string}               props.title       The question.
 * @param {string}               props.description How to answer it.
 * @return {JSX.Element} The heading.
 */
const GoalStepHeading = ({ title, description }: GoalStepHeadingProps ): JSX.Element => (
	<div>
		<h3 className="text-2xl font-semibold text-text-black">{title}</h3>
		<p className="mt-1 text-base text-text-gray">{description}</p>
	</div>
);

export default GoalStepHeading;
