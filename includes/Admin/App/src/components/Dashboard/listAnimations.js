/**
 * Framer Motion variants for list items.
 *
 * @param {number} index - The index of the item in the list.
 *
 * @return {Object} Variants for Framer Motion.
 */
export const listSlideAnimation = ( index ) => ({
	initial: {
		opacity: 0,
		y: -20
	},
	animate: {
		opacity: 1,
		y: 0,
		transition: {
			delay: index * 0.05,
			duration: 0.3,
			ease: 'easeOut'
		}
	},
	exit: {
		opacity: 0,
		y: 30,
		transition: {
			duration: 0.3,
			ease: 'easeIn'
		}
	}
});
