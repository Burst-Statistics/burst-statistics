import { createFileRoute } from '@tanstack/react-router';
import { __ } from '@wordpress/i18n';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import NotFoundModal from '@/components/Common/NotFoundModal';
import GoalHeader from '@/components/Goals/Dashboard/GoalHeader';
import GoalBreakdowns from '@/components/Goals/Dashboard/GoalBreakdowns';
import useGoalsData from '@/hooks/useGoalsData';

export const Route = createFileRoute( '/goals/$goalId' )({
	component: SingleGoal
});

/**
 * Not found, with the way back to all goals instead of a silent redirect.
 *
 * @return {JSX.Element} The modal.
 */
const GoalNotFound = () => (
	<NotFoundModal
		header={__( 'Goal not found', 'burst-statistics' )}
		message={__( 'This goal does not exist or was deleted.', 'burst-statistics' )}
		actionLabel={__( 'View all goals', 'burst-statistics' )}
		actionTo="/goals"
	/>
);

/**
 * One goal: its results and trend, then where its conversions come from.
 *
 * @return {JSX.Element|null} The goal detail.
 */
function SingleGoal() {
	const { goalId } = Route.useParams();
	const { goals, isLoading } = useGoalsData();
	const isNumeric = /^\d+$/.test( goalId );

	if ( ! isNumeric ) {
		return <GoalNotFound />;
	}

	if ( isLoading ) {
		return null;
	}

	const goal = goals.find( ( g ) => String( g.id ) === goalId );
	if ( ! goal ) {
		return <GoalNotFound />;
	}

	return (
		<>
			<ErrorBoundary>
				<GoalHeader goal={goal} />
			</ErrorBoundary>
			<GoalBreakdowns goalId={goal.id} />
		</>
	);
}
