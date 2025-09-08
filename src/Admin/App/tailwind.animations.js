/**
 * Tailwind keyFrames and animations configs.
 */

const animationTimingFunction = 'cubic-bezier(0.215,0.61,0.355,1)';
/**
 * Keyframes for various animations.
 */
const keyFrames = {
	slideUpAndFade: {
		'0%': { opacity: '0', transform: 'translateY(2px)' },
		'100%': { opacity: '1', transform: 'translateY(0)' },
	},
	slideRightAndFade: {
		'0%': { opacity: '0', transform: 'translateX(-2px)' },
		'100%': { opacity: '1', transform: 'translateX(0)' },
	},
	slideDownAndFade: {
		'0%': { opacity: '0', transform: 'translateY(-2px)' },
		'100%': { opacity: '1', transform: 'translateY(0)' },
	},
	slideLeftAndFade: {
		'0%': { opacity: '0', transform: 'translateX(2px)' },
		'100%': { opacity: '1', transform: 'translateX(0)' },
	},
	toastBounceInRight: {
		from: {
			opacity: '0',
			transform: 'translate3d(3000px,0,0)',
			'animation-timing-function': animationTimingFunction,
		},
		'60%': {
			opacity: '1',
			transform: 'translate3d(-25px,0,0)',
			'animation-timing-function': animationTimingFunction,
		},
		'75%': { transform: 'translate3d(10px,0,0)' },
		'90%': { transform: 'translate3d(-5px,0,0)' },
		to: { transform: 'none' },
	},
	toastBounceOutRight: {
		'20%': { opacity: '1', transform: 'translate3d(-20px,0,0)' },
		to: { opacity: '0', transform: 'translate3d(2000px,0,0)' },
	},
	toastBounceInLeft: {
		from: {
			opacity: '0',
			transform: 'translate3d(-3000px,0,0)',
			'animation-timing-function': animationTimingFunction,
		},
		'60%': {
			opacity: '1',
			transform: 'translate3d(25px,0,0)',
			'animation-timing-function': animationTimingFunction,
		},
		'75%': { transform: 'translate3d(-10px,0,0)' },
		'90%': { transform: 'translate3d(5px,0,0)' },
		to: { transform: 'none' },
	},
	toastBounceOutLeft: {
		'20%': { opacity: '1', transform: 'translate3d(20px,0,0)' },
		to: { opacity: '0', transform: 'translate3d(-2000px,0,0)' },
	},
	toastBounceInUp: {
		from: {
			opacity: '0',
			transform: 'translate3d(0,3000px,0)',
			'animation-timing-function': animationTimingFunction,
		},
		'60%': {
			opacity: '1',
			transform: 'translate3d(0,-20px,0)',
		},
		'75%': { transform: 'translate3d(0,10px,0)' },
		'90%': { transform: 'translate3d(0,-5px,0)' },
		to: { transform: 'translate3d(0,0,0)' },
	},
	toastBounceOutUp: {
		'20%': { transform: 'translate3d(0,-10px,0)' },
		'40%': { opacity: '1', transform: 'translate3d(0,20px,0)' },
		'45%': { opacity: '1', transform: 'translate3d(0,20px,0)' },
		to: { opacity: '0', transform: 'translate3d(0,-2000px,0)' },
	},
	toastBounceInDown: {
		from: {
			opacity: '0',
			transform: 'translate3d(0,-3000px,0)',
			'animation-timing-function': animationTimingFunction,
		},
		'60%': { opacity: '1', transform: 'translate3d(0,25px,0)' },
		'75%': { transform: 'translate3d(0,-10px,0)' },
		'90%': { transform: 'translate3d(0,5px,0)' },
		to: { transform: 'none' },
	},
	toastBounceOutDown: {
		'20%': { transform: 'translate3d(0,10px,0)' },
		'40%': { opacity: '1', transform: 'translate3d(0,-20px,0)' },
		'45%': { opacity: '1', transform: 'translate3d(0,-20px,0)' },
		to: { opacity: '0', transform: 'translate3d(0,2000px,0)' },
	},
	toastFlipIn: {
		'0%': {
			transform: 'perspective(400px) rotate3d(1,0,0,90deg)',
			animationTimingFunction: 'ease-in',
			opacity: '0',
		},
		'40%': {
			transform: 'perspective(400px) rotate3d(1,0,0,-20deg)',
			animationTimingFunction: 'ease-in',
		},
		'60%': {
			transform: 'perspective(400px) rotate3d(1,0,0,10deg)',
			opacity: '1',
		},
		'80%': {
			transform: 'perspective(400px) rotate3d(1,0,0,-5deg)',
		},
		'100%': {
			transform: 'perspective(400px)',
		},
	},
	toastFlipOut: {
		'0%': {
			transform: 'perspective(400px)',
		},
		'30%': {
			transform: 'perspective(400px) rotate3d(1,0,0,-20deg)',
			opacity: '1',
		},
		'100%': {
			transform: 'perspective(400px) rotate3d(1,0,0,90deg)',
			opacity: '0',
		},
	},
	toastSlideInRight: {
		from: { transform: 'translate3d(110%,0,0)', visibility: 'visible' },
		to: { transform: 'translate3d(0,0,0)' },
	},
	toastSlideInLeft: {
		from: { transform: 'translate3d(-110%,0,0)', visibility: 'visible' },
		to: { transform: 'translate3d(0,0,0)' },
	},
	toastSlideInUp: {
		from: { transform: 'translate3d(0,110%,0)', visibility: 'visible' },
		to: { transform: 'translate3d(0,0,0)' },
	},
	toastSlideInDown: {
		from: { transform: 'translate3d(0,-110%,0)', visibility: 'visible' },
		to: { transform: 'translate3d(0,0,0)' },
	},

	toastSlideOutRight: {
		from: { transform: 'translate3d(0,0,0)' },
		to: { transform: 'translate3d(110%,0,0)', visibility: 'hidden' },
	},
	toastSlideOutLeft: {
		from: { transform: 'translate3d(0,0,0)' },
		to: { transform: 'translate3d(-110%,0,0)', visibility: 'hidden' },
	},
	toastSlideOutDown: {
		from: { transform: 'translate3d(0,0,0)' },
		to: { transform: 'translate3d(0,500px,0)', visibility: 'hidden' },
	},
	toastSlideOutUp: {
		from: { transform: 'translate3d(0,0,0)' },
		to: { transform: 'translate3d(0,-500px,0)', visibility: 'hidden' },
	},
	toastSpin: {
		from: { transform: 'rotate(0deg)' },
		to: { transform: 'rotate(360deg)' },
	},
	toastZoomIn: {
		from: { opacity: '0', transform: 'scale3d(0.3, 0.3, 0.3)' },
		'50%': { opacity: '1' },
	},
	toastZoomOut: {
		from: { opacity: '1' },
		'50%': { opacity: '0', transform: 'scale3d(0.3, 0.3, 0.3)' },
		to: { opacity: '0' },
	},
	toastTrackProgress: {
		'0%': { transform: 'scaleX(1)' },
		'100%': { transform: 'scaleX(0)' },
	},
}

const animations = {
	slideUpAndFade: 'slideUpAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)',
	slideRightAndFade: 'slideRightAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)',
	slideDownAndFade: 'slideDownAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)',
	slideLeftAndFade: 'slideLeftAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)',
	toastBounceInRight: 'toastBounceInRight 1s both',
	toastBounceOutRight: 'toastBounceOutRight 1s both',
	toastBounceInLeft: 'toastBounceInLeft 1s both',
	toastBounceOutLeft: 'toastBounceOutLeft 1s both',
	toastBounceInUp: 'toastBounceInUp 1s both',
	toastBounceOutUp: 'toastBounceOutUp 1s both',
	toastBounceInDown: 'toastBounceInDown 1s both',
	toastBounceOutDown: 'toastBounceOutDown 1s both',
	toastFlipIn: 'toastFlipIn 0.75s both',
	toastFlipOut: 'toastFlipOut 0.75s both',
	toastSlideInRight: 'toastSlideInRight 0.75s both',
	toastSlideInLeft: 'toastSlideInLeft 0.75s both',
	toastSlideInUp: 'toastSlideInUp 0.75s both',
	toastSlideInDown: 'toastSlideInDown 0.75s both',
	toastSlideOutRight: 'toastSlideOutRight 0.75s both',
	toastSlideOutLeft: 'toastSlideOutLeft 0.75s both',
	toastSlideOutDown: 'toastSlideOutDown 0.75s both',
	toastSlideOutUp: 'toastSlideOutUp 0.75s both',
	toastSpin: 'toastSpin 1s linear infinite',
	toastZoomIn: 'toastZoomIn 0.5s ease both',
	toastZoomOut: 'toastZoomOut 0.5s ease both',
	toastTrackProgress: 'toastTrackProgress 1s linear forwards',
}

export {
	keyFrames,
	animations
}