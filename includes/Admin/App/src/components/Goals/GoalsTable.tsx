import { __ } from '@wordpress/i18n';
import { clsx } from 'clsx';
import DataTable from '@/components/DataTable/DataTable';
import Icon from '@/utils/Icon';
import { OverflowTooltip } from '@/components/Common/OverflowTooltip';
import HelpTooltip from '@/components/Common/HelpTooltip';
import DeleteGoalModal from '@/components/Goals/DeleteGoalModal';
import GoalStatusCell from '@/components/Goals/GoalStatusCell';
import { useGoalWizardStore } from '@/store/goals/useGoalWizardStore';
import useFilterByGoal from '@/hooks/useFilterByGoal';
import { getGoalResumeStep, isGoalCounting } from '@/components/Goals/goalHelpers';
import { getCountsOnText, getTracksText } from '@/components/Goals/goalText';
import { getGoalTypeLabel } from '@/components/Goals/goalOptions';
import type { Goal } from '@/components/Goals/goalHelpers';

interface GoalsTableProps {
	goals: Goal[];
	isLimitReached: boolean;
	toggleGoalStatus: ( id: number, status: string ) => Promise<unknown>;
	deleteGoal: ( id: number ) => Promise<unknown>;
}

/**
 * Classes for the information cells of a goal: goals that are not counting
 * conversions recede, so the ones that are stand out.
 *
 * @param {Goal} goal The goal of the row.
 * @return {string} The classes.
 */
const getCellTone = ( goal: Goal ): string => ( isGoalCounting( goal ) ? 'min-w-0' : 'min-w-0 opacity-50' );

/**
 * Table of all goals with their target, scope and status.
 *
 * @param {GoalsTableProps} props Component props.
 * @return {JSX.Element} The goals table.
 */
const GoalsTable = ({ goals, isLimitReached, toggleGoalStatus, deleteGoal }: GoalsTableProps ): JSX.Element => {
	const openWizard = useGoalWizardStore( ( state ) => state.openWizard );
	const filterByGoal = useFilterByGoal();
	const filterLabel = __( 'Click to filter the insights by this goal', 'burst-statistics' );

	const columns = [
		{
			name: __( 'Goal', 'burst-statistics' ),
			selector: ( row: Goal ) => row.title,
			cell: ( row: Goal ) => (
				<div className="group flex min-w-0 items-center gap-1">
					<button
						type="button"
						className="flex min-w-0 items-center gap-2"
						onClick={() => openWizard( row.id, getGoalResumeStep( row ) )}
					>
						{/* Green dot for goals counting conversions; the empty dot keeps names aligned. */}
						<span aria-hidden="true" className={clsx( 'h-2 w-2 shrink-0 rounded-full', isGoalCounting( row ) ? 'bg-green' : 'bg-transparent' )} />
						{isGoalCounting( row ) && <span className="sr-only">{__( 'Counting conversions:', 'burst-statistics' )}</span>}
						<span className={getCellTone( row )}>
							<OverflowTooltip className="text-left text-blue hover:text-blue-700 hover:underline font-semibold transition-colors cursor-pointer">
								{row.title}
							</OverflowTooltip>
						</span>
					</button>
					{/* Only goals that count conversions have data to filter on, and
						shown on row hover so the goal names stay the only thing
						competing for attention. */}
					{isGoalCounting( row ) && (
						<HelpTooltip content={filterLabel} asChild>
							<button
								type="button"
								aria-label={filterLabel}
								className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-100 opacity-0 shadow-sm transition-all duration-150 hover:bg-white hover:shadow-md focus-visible:opacity-100 group-hover:opacity-100"
								onClick={() => filterByGoal( row.id )}
							>
								<Icon name="filter" size={14} color="black" />
							</button>
						</HelpTooltip>
					)}
				</div>
			),
			sortable: true,
			minWidth: '150px',
			grow: 2
		},
		{
			name: __( 'Type', 'burst-statistics' ),
			selector: ( row: Goal ) => row.type,
			cell: ( row: Goal ) => (
				<span className={clsx( 'px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-gray-100 text-text-gray', getCellTone( row ) )}>
					{getGoalTypeLabel( row.type )}
				</span>
			),
			sortable: true,
			minWidth: '90px',
			grow: 0
		},
		{
			name: __( 'Tracks', 'burst-statistics' ),
			grow: 2,
			cell: ( row: Goal ) => {
				const tracks = getTracksText( row );
				return (
					<span className={getCellTone( row )}>
						{tracks ? (
							<OverflowTooltip>{tracks}</OverflowTooltip>
						) : (
							<span className="text-text-gray-light">{__( 'Not set yet', 'burst-statistics' )}</span>
						)}
					</span>
				);
			}
		},
		{
			name: __( 'Counts on', 'burst-statistics' ),
			grow: 1,
			cell: ( row: Goal ) => (
				<span className={getCellTone( row )}>
					<OverflowTooltip>
						{getCountsOnText( row ) || __( 'Not set yet', 'burst-statistics' )}
					</OverflowTooltip>
				</span>
			)
		},
		{
			name: __( 'Status', 'burst-statistics' ),
			right: true,
			grow: 0,
			width: '120px',
			cell: ( row: Goal ) => (
				<GoalStatusCell goal={row} isLimitReached={isLimitReached} toggleGoalStatus={toggleGoalStatus} />
			)
		},
		{
			name: '',
			right: true,
			grow: 0,
			width: '52px',
			cell: ( row: Goal ) => (
				<DeleteGoalModal
					goal={{
						name: row.title,
						status: 'active' === row.status ?
							__( 'Active', 'burst-statistics' ) :
							__( 'Inactive', 'burst-statistics' ),
						dateCreated: 1 < row.date_created ? row.date_created : 1
					}}
					deleteGoal={() => deleteGoal( row.id )}
				/>
			)
		}
	];

	return (
		<div data-tour="goals-list-table">
			<DataTable
				className="burst-data-table"
				pagination
				columns={columns}
				data={goals}
				sortIcon={<Icon size={14} strokeWidth={1} className="ml-1 h-3.5 w-3.5" name="arrow-down-up" />}
			/>
		</div>
	);
};

export default GoalsTable;
