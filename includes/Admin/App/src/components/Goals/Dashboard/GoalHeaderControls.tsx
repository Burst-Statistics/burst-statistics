import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useNavigate } from '@tanstack/react-router';
import IconButton from '@/components/Inputs/IconButton';
import GoalStatusCell from '@/components/Goals/GoalStatusCell';
import DeleteGoalModal from '@/components/Goals/DeleteGoalModal';
import useIsGoalLimitReached from '@/components/Goals/useIsGoalLimitReached';
import useGoalsData from '@/hooks/useGoalsData';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import { isGoalCounting } from '@/components/Goals/goalHelpers';
import type { Goal } from '@/components/Goals/goalHelpers';
import GoalFilterButton from './GoalFilterButton';

interface GoalHeaderControlsProps {
	goal: Goal;
}

/**
 * Actions of a single goal in its header: status, edit, filter and delete.
 *
 * @param {GoalHeaderControlsProps} props      Component props.
 * @param {Goal}                    props.goal The goal.
 * @return {JSX.Element} The controls.
 */
const GoalHeaderControls = ({ goal }: GoalHeaderControlsProps ): JSX.Element => {
	const { toggleGoalStatus, deleteGoal } = useGoalsData() as {
		toggleGoalStatus: ( id: number, status: string ) => Promise<unknown>;
		deleteGoal: ( id: number ) => Promise<unknown>;
	};
	const [ isDeleteOpen, setIsDeleteOpen ] = useState( false );
	const navigate = useNavigate();
	const openWizard = useGoalWizardStore( ( state ) => state.openWizard );
	const isLimitReached = useIsGoalLimitReached();

	const handleDelete = async() => {
		await deleteGoal( goal.id );

		// The deleted goal's page no longer exists: show all goals instead.
		navigate({ to: '/goals', search: true, replace: true });
	};

	return (
		<div className="flex shrink-0 items-center gap-2">
			<GoalStatusCell goal={goal} isLimitReached={isLimitReached} toggleGoalStatus={toggleGoalStatus} />
			<IconButton
				icon="pencil"
				label={__( 'Edit goal', 'burst-statistics' )}
				variant="secondary"
				size="md"
				onClick={() => openWizard( goal.id )}
			/>
			{/* Only a goal that counts conversions has data to show on Insights. */}
			{isGoalCounting( goal ) && <GoalFilterButton goal={goal} />}
			<IconButton
				icon="trash"
				variant="tertiary"
				size="md"
				ariaLabel={__( 'Delete goal', 'burst-statistics' )}
				title={__( 'Delete goal', 'burst-statistics' )}
				onClick={() => setIsDeleteOpen( true )}
			/>
			<DeleteGoalModal
				goal={{
					name: goal.title,
					status: 'active' === goal.status ?
						__( 'Active', 'burst-statistics' ) :
						__( 'Inactive', 'burst-statistics' ),
					dateCreated: 1 < goal.date_created ? goal.date_created : 1
				}}
				deleteGoal={handleDelete}
				isOpen={isDeleteOpen}
				onClose={() => setIsDeleteOpen( false )}
			/>
		</div>
	);
};

export default GoalHeaderControls;
