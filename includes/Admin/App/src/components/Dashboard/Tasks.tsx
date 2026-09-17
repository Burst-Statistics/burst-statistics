import TaskElement from './TaskElement';
import { __ } from '@wordpress/i18n';
import useTasks from '@/store/useTasksStore';
import { useEffect } from 'react';
import { LiveVisitorTaskElement } from '@/components/Dashboard/LiveVisitorTaskElement';
import { AnimatePresence, motion, Variants } from 'framer-motion';
import { listSlideAnimation } from './listAnimations';

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
		msg: __( 'Loading tasks…', 'burst-statistics' ),
		icon: 'skeleton',
		dismissible: false,
		plusone: false,
		label: __( 'Loading…', 'burst-statistics' )
	};

    // eslint-disable-next-line @typescript-eslint/no-empty-function
	return <TaskElement task={loadingTask} onCloseTaskHandler={() => {}} />;
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

    // eslint-disable-next-line @typescript-eslint/no-empty-function
	return <TaskElement task={completedTask} onCloseTaskHandler={() => {}} />;
};

export type TaskProp = {
	id: string;
	condition: {
		type: string;
		function: string;
	};
	msg?: string;
	icon: string;
	dismissible: boolean;
	plusone: boolean;
	label?: string;
	status?: string;
	url?: string;
	fix?: string;
};

/**
 * Tasks component to display list of tasks or loading/no tasks message
 *
 * @return { React.ReactElement | Array< React.ReactElement > } Tasks component or list of TaskElement components
 */
const Tasks = (): React.ReactElement | Array<React.ReactElement> => {
	const tasks = useTasks( ( state ) => state.tasks );
	const loading = useTasks( ( state ) => state.loading );
	const getTasks = useTasks( ( state ) => state.getTasks );
	const dismissTask = useTasks( ( state ) => state.dismissTask );

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
		return 'clientside' === task.condition.type;
	});

	const serverTasks = tasks.filter( ( task: TaskProp ) => {
		return 'clientside' !== task.condition.type;
	});

	// Render the motion.div items directly as AnimatePresence children. With
	// mode="popLayout" framer-motion injects a ref into each direct child to
	// measure it, so the children must be ref-able motion elements — a wrapper
	// function component (which also returns an array) cannot receive that ref.
	return (
		<AnimatePresence mode="popLayout">
			{ renderClientTasks( clientTasks ) }
			{ renderServerTasks( serverTasks, dismissTask ) }
		</AnimatePresence>
	);
};

/**
 * Render server-side task items, or the "no tasks" message when empty.
 *
 * @param { Array }    tasks       List of server-side tasks.
 * @param { Function } dismissTask Handler to dismiss a task by id.
 *
 * @return { Array< React.ReactElement > } List of motion-wrapped task elements.
 */
const renderServerTasks = (
	tasks: TaskProp[],
	dismissTask: ( id: string ) => void
): React.ReactElement[] => {
	if ( 0 === tasks.length ) {
		return [
			<motion.div
				key="no-tasks"
				variants={listSlideAnimation( 1 ) as Variants}
				initial="initial"
				animate="animate"
				exit="exit"
			>
				<NoTasksComponent />
			</motion.div>
		];
	}

	return tasks.map( ( task: TaskProp, index: number ) => {
		return (
			<motion.div
				layout
				key={'task-' + index + task.id}
				variants={listSlideAnimation( index ) as Variants}
				initial="initial"
				animate="animate"
				exit="exit"
			>
				<TaskElement
					task={task}
					onCloseTaskHandler={() => dismissTask( task.id )}
				/>
			</motion.div>
		);
	});
};

/**
 * Render client-side task items.
 *
 * @param { Array } tasks List of client-side tasks.
 *
 * @return { Array< React.ReactElement > } List of motion-wrapped task elements.
 */
const renderClientTasks = ( tasks: TaskProp[]): React.ReactElement[] => {
	return tasks.map( ( task: TaskProp, index: number ) => {
		if ( 'live_visitors' === task.id ) {
			return (
				<motion.div
					layout
					key={task.id + index}
					variants={listSlideAnimation( index ) as Variants}
					initial="initial"
					animate="animate"
					exit="exit"
				>
					<LiveVisitorTaskElement task={task} />
				</motion.div>
			);
		}

		return (
			<motion.div
				layout
				key={task.id}
				variants={listSlideAnimation( index ) as Variants}
				initial="initial"
				animate="animate"
				exit="exit"
			>
                { /* eslint-disable-next-line @typescript-eslint/no-empty-function */ }
				<TaskElement task={task} onCloseTaskHandler={() => {}} />
			</motion.div>
		);
	});
};

export default Tasks;
