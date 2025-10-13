/**
 * LiveVisitorTaskElement component.
 */
import { useTaskConditionRegistry } from '@/hooks/useTaskConditionRegistry'
import Icon from '@/utils/Icon'
import { __, _n, sprintf } from '@wordpress/i18n'
import { useNonPersistedTabsStore } from '@/store/useTabsStore'
import { useLiveVisitorsData } from '@/hooks/useLiveVisitorsData'
import type { TaskProp } from "@/components/Dashboard/Tasks";

/**
 * LiveVisitorTaskElement component.
 *
 * @param {Object} props - Component props.
 * @param {Object} props.task - Task object containing task details.
 *
 * @returns {JSX.Element|null} The rendered component or null if the condition is not met.
 */
export const LiveVisitorTaskElement = ( { task }: { task: TaskProp } ): JSX.Element | null => {
	const { id } = task;
	const taskCondition = useTaskConditionRegistry( id );
	const setActiveTab = useNonPersistedTabsStore( ( state ) => state.setActiveTab );
	// Add 'any' type for now until all JS files are converted to TS.
	const liveVisitorsQuery: any = useLiveVisitorsData();
	const live = parseInt( liveVisitorsQuery.data );

	if ( ! taskCondition ) {
		return null;
	}

	const { condition } = taskCondition;

	if ( ! condition() ) {
		return null;
	}

	// Translators: %d is the number of live visitors.
	const msg = sprintf( _n( '%d person is exploring your site right now', '%d people are exploring your site right now', live, 'burst-statistics' ), live, )

	return (
		<div className="flex items-center justify-center gap-1 pb-2.5">
			<div className='bg-white rounded-full p-1.5 mr-2 border border-gray-100 shadow-sm'>
				<Icon name='line-squiggle' className='text-yellow' color='' size={ 16 } strokeWidth={ 1.5 } />
			</div>

			<p className="flex-1 text-base text-black">{ msg }</p>

			<span className="text-blue underline cursor-pointer" onClick={ () => setActiveTab( 'dashboard-overview', 'live-visitors' ) }>{ __( 'View', 'burst-statistics' ) }</span>
		</div>
	);
}