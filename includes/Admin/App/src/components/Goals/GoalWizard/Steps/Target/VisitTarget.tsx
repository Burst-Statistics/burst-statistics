import { __ } from '@wordpress/i18n';
import { createInterpolateElement } from '@wordpress/element';
import useGoalsData from '@/hooks/useGoalsData';
import type { Goal } from '@/components/Goals/goalHelpers';
import GoalPageInput from '@/components/Goals/GoalWizard/Fields/GoalPageInput';
import GoalStepHeading from '../GoalStepHeading';
import GoalInfoNote from '../GoalInfoNote';

/**
 * What a visit goal tracks: the page whose visits count as conversions.
 *
 * @param {Object} props      Component props.
 * @param {Goal}   props.goal The goal being edited.
 * @return {JSX.Element} The page input.
 */
const VisitTarget = ({ goal }: { goal: Goal }): JSX.Element => {
	const { setGoalValue } = useGoalsData();

	const setPage = ( page: string ) => {

		// A visit always counts on its own page, set once that page is chosen.
		setGoalValue( goal.id, 'page_or_website', 'page' );
		setGoalValue( goal.id, 'specific_page', page );
	};

	return (
		<>
			<GoalStepHeading
				title={__( 'Which page should visitors reach?', 'burst-statistics' )}
				description={__( 'Every visit to this page counts as a conversion. A thank-you or confirmation page works best.', 'burst-statistics' )}
			/>

			<GoalPageInput
				goalId={goal.id}
				goalType={goal.type}
				isDraft={Boolean( goal.is_draft )}
				page={goal.specific_page}
				label={__( 'Page', 'burst-statistics' )}
				onChange={setPage}
			/>

			{goal.specific_page && (
				<GoalInfoNote>
					{createInterpolateElement(

						/* translators: <page />: the page path, e.g. /thank-you. */
						__( 'A conversion is counted when a visitor opens <page />. No element or scope needed, so this goal skips those steps.', 'burst-statistics' ),
						{ page: <strong>{goal.specific_page}</strong> }
					)}
				</GoalInfoNote>
			)}
		</>
	);
};

export default VisitTarget;
