import { useEffect, useRef, useState, useCallback } from 'react';
import Icon from '@/utils/Icon';
import {
	type ToastItem,
	type ToastContentProps,
	useToastStore
} from '@/utils/toast';

/** Visual config per toast type. */
const TYPE_CONFIG = {
	success: {
		iconName: 'circle-check',
		iconClass: 'text-green',
		borderClass: 'border-l-green'
	},
	error: {
		iconName: 'error',
		iconClass: 'text-red',
		borderClass: 'border-l-red'
	},
	info: {
		iconName: 'alert',
		iconClass: 'text-blue',
		borderClass: 'border-l-blue'
	},
	warning: {
		iconName: 'warning',
		iconClass: 'text-orange',
		borderClass: 'border-l-orange'
	},
	default: {
		iconName: 'alert',
		iconClass: 'text-text-gray-light',
		borderClass: 'border-l-gray-400'
	}
} as const;

interface Props {
	toast: ToastItem;
}

/**
 * A single toast notification item.
 * Handles auto-close timing and enter/exit animations.
 */
export const Toast: React.FC<Props> = ({ toast: item }) => {
	const { removeToast, setExiting } = useToastStore();
	const [ isExiting, setIsExiting ] = useState( false );
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>( null );
	const isExitingRef = useRef( false );

	const { iconName, iconClass, borderClass } = TYPE_CONFIG[ item.type ];

	/** Triggers the exit animation then removes the toast from state. */
	const handleClose = useCallback( () => {
		if ( isExitingRef.current ) {
			return;
		}
		isExitingRef.current = true;
		setIsExiting( true );
		setExiting( item.id );
		timerRef.current = setTimeout( () => removeToast( item.id ), 260 );
	}, [ item.id, removeToast, setExiting ]);

	useEffect( () => {
		if ( false !== item.autoClose ) {
			timerRef.current = setTimeout( handleClose, item.autoClose );
		}
		return () => {
			if ( timerRef.current ) {
				clearTimeout( timerRef.current );
			}
		};
	}, [ item.autoClose, item.id, handleClose ]);

	const contentProps: ToastContentProps = {
		closeToast: handleClose,
		toastProps: { type: item.type, toastId: item.id }
	};

	const renderedContent =
		'function' === typeof item.content ?
			item.content( contentProps ) :
			item.content;

	return (
		<div
			role="alert"
			aria-live="assertive"
			className={ `
				flex items-start gap-3 p-4 pr-8 rounded-md shadow-layered-mid-b bg-white
				border-l-6 ${ borderClass }
				min-w-[280px] max-w-[360px] relative text-sm text-text-black leading-snug
				${ isExiting ? 'animate-toast-exit' : 'animate-toast-enter' }
			`.trim() }
		>
			<span className="shrink-0 mt-0.5" aria-hidden={ true }>
				<Icon name={ iconName } size={ 18 } className={ iconClass } />
			</span>

			<div className="flex-1 min-w-0 break-words">{ renderedContent }</div>

			<button
				type="button"
				onClick={ handleClose }
				className="absolute top-2 right-2 text-text-gray-light hover:text-text-gray-light transition-colors cursor-pointer"
				aria-label="Close notification"
			>
				<Icon name="times" size={ 14 } className="text-text-gray-light" />
			</button>
		</div>
	);
};
