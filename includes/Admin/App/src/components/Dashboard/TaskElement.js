import { __ } from '@wordpress/i18n'
import Icon from '../../utils/Icon';
import useTasks from "@/store/useTasksStore";
import HelpTooltip from '@/components/Common/HelpTooltip'

const TaskElement = ( props ) => {
	let { task } = props;
	const fixTask = useTasks( ( state ) => state.fixTask );

	return (
		<div className="flex items-center justify-center gap-1 pb-2.5">
			<TaskStatusIcon task={task} />

			{/*sanitized input in task.msg*/}
			{ task.msg && <p className="flex-1 text-base text-black" dangerouslySetInnerHTML={ { __html: task.msg } }></p> } {/* nosemgrep */}
	
			{ task.url && (
				<a target={ task.url.startsWith( '#' ) ? '_self' : '_blank' } href={ task.url } className="text-blue underline cursor-pointer">
					{ 'sale' === task.icon && __( 'Get 40% Off', 'burst-statistics' ) }
					{ 'offer' === task.icon && __( 'Get 3 months free!', 'burst-statistics' ) }
					{ ( 'offer' !== task.icon && 'sale' !== task.icon ) && __( 'More info', 'burst-statistics' ) }
				</a>
			) }

			{ task.fix && <span
				className="text-blue underline cursor-pointer hover:text-blue-800 hover:no-underline"
				onClick={ () => fixTask(task.id, task.fix) }>{ __( 'Fix', 'burst-statistics' ) }</span> }
			{ task.plusone && <span className='inline-block align-top box-border m-[1px_0_-1px_2px] py-0 px-1.5 min-w-[18px] h-[18px] rounded-[9px] bg-red text-white text-xs leading-[1.6] text-center'>1</span> }
			{ task.dismissible && 'completed' !== task.status &&
				<div>
                      <button className="[all:initial]" type='button' data-id={ task.id } onClick={ props.onCloseTaskHandler }>
                              <span className='text-[1.5em] text-black hover:cursor-pointer hover:text-gray [&>svg]:h-[12px] [&>svg]:w-[12px]'>
                                  <svg width="20" height="20" viewBox="0, 0, 400,400">
                                      <path id="path0" d="M55.692 37.024 C 43.555 40.991,36.316 50.669,36.344 62.891 C 36.369 73.778,33.418 70.354,101.822 138.867 L 162.858 200.000 101.822 261.133 C 33.434 329.630,36.445 326.135,36.370 337.109 C 36.270 351.953,47.790 363.672,62.483 363.672 C 73.957 363.672,68.975 367.937,138.084 298.940 L 199.995 237.127 261.912 298.936 C 331.022 367.926,326.053 363.672,337.517 363.672 C 351.804 363.672,363.610 352.027,363.655 337.891 C 363.689 326.943,367.629 331.524,299.116 262.841 C 265.227 228.868,237.500 200.586,237.500 199.991 C 237.500 199.395,265.228 171.117,299.117 137.150 C 367.625 68.484,363.672 73.081,363.672 62.092 C 363.672 48.021,351.832 36.371,337.500 36.341 C 326.067 36.316,331.025 32.070,261.909 101.066 L 199.990 162.877 138.472 101.388 C 87.108 50.048,76.310 39.616,73.059 38.191 C 68.251 36.083,60.222 35.543,55.692 37.024 " stroke="none" fill="#000000">
                                      </path>
                                  </svg>
                              </span>
                      </button>
                    </div>
			}
            </div>
	);
};

export default TaskElement;

/**
 * TaskStatusIcon component to display the status icon based on task properties.
 *
 * @param {Object} props - The component props.
 * @param {Object} props.task - The task object containing status and icon information.
 * @return { React.ReactElement } TaskStatusIcon component
 */
const TaskStatusIcon = ( props ) => {
	const iconMapping = {
		milestone: {
			icon: 'party-popper',
			color: 'blue'
		},
		completed: {
			icon: 'check',
			color: 'green'
		},
		error: {
			icon: 'error-octagon',
			color: 'red'
		},
		sale: {
			icon: 'percent',
			color: 'green'
		},
		warning: {
			icon: 'warning-triangle',
			color: 'orange'
		},
		new: {
			icon: 'campaign',
			color: 'blue'
		},
		insight: {
			icon: 'line-squiggle',
			color: 'yellow',
		},
		skeleton: {
			icon: 'loading',
			color: 'blue'
		},
		default: {
			icon: 'line-squiggle',
			color: 'yellow'
		},
	};
	const iconConfig = iconMapping[props.task.icon] ?? iconMapping['default'];
	return (
		<HelpTooltip content={ props.task.label } delayDuration={ 300 }>
			<div className='bg-white rounded-full p-1.5 mr-2 border border-gray-100 shadow-sm'>
				<Icon color={ iconConfig.color } name={ iconConfig.icon } size={ 16 } strokeWidth={ 1.5 }/>
			</div>
		</HelpTooltip>
	)
};
