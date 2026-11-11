import { __ } from '@wordpress/i18n';
import useGoalsData from '@/hooks/useGoalsData';
import { getGoalKind } from '@/components/Goals/goalHelpers';
import type { Goal, GoalKind } from '@/components/Goals/goalHelpers';
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
	const currentKind = getGoalKind( goal );

	// fallow-ignore-next-line complexity
	const changeKind = ( newKindStr: string ) => {
		const newKind = newKindStr as GoalKind;
		if ( newKind === currentKind ) {
			return;
		}

		// A visit counts on one page: use page scope once that page is known, so no page never saves as the home page.
		if ( 'visits' === newKind ) {
			setGoalValue( goal.id, 'page_or_website', goal.specific_page ? 'page' : 'website' );
		}

		// Hook and event goals count wherever they run; the wizard has no page for them.
		if ( 'hook' === newKind || 'download' === newKind || 'event' === newKind ) {
			setGoalValue( goal.id, 'page_or_website', 'website' );
		}

		if ( 'download' === newKind ) {
			setGoalValue( goal.id, 'type', 'event' );
			setGoalValue( goal.id, 'hook', 'file_download' );
			setGoalValue( goal.id, 'event_filter', null );
		} else if ( 'event' === newKind ) {
			setGoalValue( goal.id, 'type', 'event' );
			setGoalValue( goal.id, 'hook', '' );
			setGoalValue( goal.id, 'event_filter', null );
		} else {

			// Switching away from an event kind clears event_filter.
			if ( 'download' === currentKind || 'event' === currentKind ) {
				setGoalValue( goal.id, 'event_filter', null );
			}
			setGoalValue( goal.id, 'type', newKind );
		}
	};

	return (
		<div className="flex flex-col gap-6 p-4 lg:p-10">
			<GoalStepHeading
				title={__( 'What do you want to count?', 'burst-statistics' )}
				description={__( 'Pick what a conversion looks like. You can change this later.', 'burst-statistics' )}
			/>
			<GoalTypeCards value={currentKind} onChange={changeKind} />
		</div>
	);
};

export default ChangeGoalType;
