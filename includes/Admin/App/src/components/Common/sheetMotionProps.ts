import type { HTMLMotionProps } from 'framer-motion';

type MotionDivPreset = Pick<
	HTMLMotionProps<'div'>,
	'className' | 'initial' | 'animate' | 'exit' | 'transition'
>;

export const SHEET_OVERLAY_PROPS: MotionDivPreset = {
	className:
		'fixed inset-0 left-0 max-[960px]:left-9 max-[782px]:left-0 z-9999 dark:bg-gray-400 bg-gray-700 bg-opacity-90 flex items-end justify-center px-4',
	initial: { opacity: 0 },
	animate: { opacity: 1 },
	exit: { opacity: 0 },
	transition: { duration: 0.15, ease: 'easeOut' }
};

export const SHEET_PANEL_PROPS: MotionDivPreset = {
	initial: { opacity: 0, y: 500, scale: 0.7 },
	animate: { opacity: 1, y: 0, scale: 1 },
	exit: { opacity: 0, y: 500, scale: 0.7 },
	transition: {
		delay: 0.1,
		y: {
			type: 'spring',
			stiffness: 135,
			damping: 18,
			mass: 0.45
		},
		opacity: {
			duration: 0.18,
			ease: 'easeOut'
		}
	},
	className: 'w-full h-[95vh] max-h-[95vh] max-w-(--breakpoint-2xl)'
};
