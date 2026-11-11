import getGoalDetailTitle from './getGoalDetailTitle';

interface GoalHeadlineProps {

	// Whether the numbers are the real ones, not placeholder zeros.
	isLoaded: boolean;
	numbers: Parameters<typeof getGoalDetailTitle>[0];
}

/**
 * The conclusion above the goal's numbers. Keeps its height while loading: a title
 * from placeholder zeros would say "No conversions yet".
 *
 * @param {GoalHeadlineProps} props          Component props.
 * @param {boolean}           props.isLoaded Whether the numbers have loaded.
 * @param {Object}            props.numbers  Conversions in this and the previous period.
 * @return {JSX.Element | null} The headline, null when it would only repeat the count.
 */
const GoalHeadline = ({ isLoaded, numbers }: GoalHeadlineProps ): JSX.Element | null => {
	if ( ! isLoaded ) {
		return <p className="text-md font-semibold text-text-gray">{'\u00a0'}</p>;
	}

	const title = getGoalDetailTitle( numbers );
	return title ? <p className="text-md font-semibold text-text-gray">{title}</p> : null;
};

export default GoalHeadline;
