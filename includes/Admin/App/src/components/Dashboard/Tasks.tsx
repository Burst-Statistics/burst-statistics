import TaskElement from './TaskElement';
import { __ } from "@wordpress/i18n";
import useTasks from "@/store/useTasksStore";
import { useEffect } from "react";
import { LiveVisitorTaskElement } from "@/components/Dashboard/LiveVisitorTaskElement";
import {AnimatePresence, motion, Variants} from "framer-motion";
import { listSlideAnimation } from './OverviewBlock';

/**
 * Loading component to show while tasks are being fetched
 *
 * @return { React.ReactElement } Loading component
 */
const LoadingComponent = (): React.ReactElement => {
	const loadingTask: TaskProp = {
		id: 'loading',
		condition: {
			type: 'system',
			function: 'loading'
		},
		msg: __( 'Loading tasks...', 'burst-statistics' ),
		icon: 'skeleton',
		dismissible: false,
		plusone: false,
		label: __( 'Loading...', 'burst-statistics' )
	};

	return <TaskElement task={ loadingTask } onCloseTaskHandler={ () => {} } />;
};

/**
 * No tasks component to show when there are no tasks to display
 *
 * @return { React.ReactElement } No tasks component
 */
const NoTasksComponent = (): React.ReactElement => {
	const completedTask: TaskProp = {
		id: 'no-tasks',
		condition: {
			type: 'system',
			function: 'completed'
		},
		msg: __( 'No remaining tasks to show', 'burst-statistics' ),
		icon: 'completed',
		dismissible: false,
		plusone: false,
		label: __( 'Completed', 'burst-statistics' )
	};

	return <TaskElement task={ completedTask } onCloseTaskHandler={ () => {} } />;
};

export type TaskProp = {
	id: string;
	condition: {
		type: string;
		function: string;
	};
	msg?: string;
	icon: string,
	dismissible: boolean;
	plusone: boolean;
	label?: string;
	status?: string;
	url?: string;
	fix?: string;
}

/**
 * Tasks component to display list of tasks or loading/no tasks message
 *
 * @return { React.ReactElement | Array< React.ReactElement > } Tasks component or list of TaskElement components
 */
const Tasks = (): React.ReactElement | Array< React.ReactElement > => {
	const tasks = useTasks( ( state ) => state.tasks );
	const loading = useTasks( ( state ) => state.loading );
	const getTasks = useTasks( ( state ) => state.getTasks );

	useEffect(
		/**
		 * Fetch tasks on component mount and when getTasks changes.
		 */
		() => {
			getTasks();
		},
		[ getTasks ]
	);

	if ( loading ) {
		return <LoadingComponent />;
	}

	const clientTasks = tasks.filter( ( task: TaskProp ) => {
		return task.condition.type === 'clientside';
	} );

	const serverTasks = tasks.filter( ( task: TaskProp ) => {
		return task.condition.type !== 'clientside';
	} );

	return (
		<AnimatePresence mode="popLayout">
			<ClientTasks tasks={ clientTasks } />
			<ServerTasks tasks={ serverTasks } />
		</AnimatePresence>
	);
}

/**
 * ServerTasks component to display server-side tasks or no tasks message
 *
 * @param { Object } props - Component props
 * @param { Array } props.tasks - List of server-side tasks
 *
 * @return { React.ReactElement | Array< React.ReactElement > } NoTasksComponent or list of TaskElement components
 */
const ServerTasks = ( { tasks }: { tasks: TaskProp[] } ) => {
	if ( tasks.length === 0 ) {
		return (
			<motion.div
				key='no-tasks'
				variants={ listSlideAnimation( 1 ) as Variants }
				initial="initial"
				animate="animate"
				exit="exit"
			>
				<NoTasksComponent />
			</motion.div>
		);
	}

	const dismissTask = useTasks( ( state ) => state.dismissTask );

	return tasks.map( ( task: TaskProp, index: number ) => {
		return (
			<motion.div
				layout
				key={ task.id }
				variants={ listSlideAnimation( index ) as Variants }
				initial="initial"
				animate="animate"
				exit="exit"
			>
				<TaskElement
					key={ task.id }
					task={ task }
					onCloseTaskHandler={ () => dismissTask( task.id ) }
				/>
			</motion.div>
		);
	} );
}

/**
 * ClientTasks component to display client-side tasks
 *
 * @param { Object } props - Component props
 * @param { Array } props.tasks - List of client-side tasks
 *
 * @return { Array< React.ReactElement > } List of TaskElement components
 */
const ClientTasks = ( { tasks }: { tasks: TaskProp[] } ) => {
	return tasks.map( ( task: TaskProp, index: number ) => {
		if ( task.id === 'live_visitors' ) {

			return (
				<motion.div
					layout
					key={ task.id }
					variants={ listSlideAnimation( index ) as Variants }
					initial="initial"
					animate="animate"
					exit="exit"
				>
					<LiveVisitorTaskElement task={ task } />
				</motion.div>
			)
		}

		return (
			<motion.div
				layout
				key={ task.id }
				variants={ listSlideAnimation( index ) as Variants }
				initial="initial"
				animate="animate"
				exit="exit"
			>
				<TaskElement
					task={ task }
					onCloseTaskHandler={ () => {} }
				/>
			</motion.div>
		);
	} );
}

export default Tasks;