import { __ } from '@wordpress/i18n';
import useGoalsData from '@/hooks/useGoalsData';
import type { Goal } from '@/components/Goals/goalHelpers';
import GoalStepHeading from '../GoalStepHeading';
import GoalTypeCards from './GoalTypeCards';

/**
 * Type choice for a goal that already exists: once created, only its type can still change on this step.
 *
 * @param {Object} props      Component props.
 * @param {Goal}   props.goal The goal being edited.
 * @return {JSX.Element} The type choice.
 */
const ChangeGoalType = ({ goal }: { goal: Goal }): JSX.Element => {
	const { setGoalValue } = useGoalsData();

	const changeType = ( type: string ) => {

		// A visit counts on one page: use page scope once that page is known, so no page never saves as the home page.
		if ( 'visits' === type ) {
			setGoalValue( goal.id, 'page_or_website', goal.specific_page ? 'page' : 'website' );
		}

		// A hook counts wherever it runs; the wizard has no page for it.
		if ( 'hook' === type ) {
			setGoalValue( goal.id, 'page_or_website', 'website' );
		}
		setGoalValue( goal.id, 'type', type );
	};

	return (
		<div className="flex flex-col gap-6 p-4 lg:p-10">
			<GoalStepHeading
				title={__( 'What do you want to count?', 'burst-statistics' )}
				description={__( 'Pick what a conversion looks like. You can change this later.', 'burst-statistics' )}
			/>
			<GoalTypeCards value={goal.type} onChange={changeType} />
		</div>
	);
};

export default ChangeGoalType;
