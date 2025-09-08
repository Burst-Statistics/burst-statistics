/**
 * Tailwind plugin that registers Tailwind components for the toasts.
 *
 * @param {object} param0 - The plugin parameters.
 * @param {function} param0.addComponents - Function to add components.
 * @param {function} param0.theme - Function to access theme values.
 *
 * @returns {void}
 */
export const ToastComponents = function ({ addComponents, theme }) {
	const ToastNameSpace = "Toastify";

	addComponents({
		/* Bounce In */
		[`.${ToastNameSpace}__bounce-enter--top-left, .${ToastNameSpace}__bounce-enter--bottom-left`]: {
			'@apply animate-toastBounceInLeft': {},
		},
		[`.${ToastNameSpace}__bounce-enter--top-right, .${ToastNameSpace}__bounce-enter--bottom-right`]: {
			'@apply animate-toastBounceInRight': {},
		},
		[`.${ToastNameSpace}__bounce-enter--top-center`]: {
			'@apply animate-toastBounceInDown': {},
		},
		[`.${ToastNameSpace}__bounce-enter--bottom-center`]: {
			'@apply animate-toastBounceInUp': {},
		},

		/* Bounce Out */
		[`.${ToastNameSpace}__bounce-exit--top-left, .${ToastNameSpace}__bounce-exit--bottom-left`]: {
			'@apply animate-toastBounceOutLeft': {},
		},
		[`.${ToastNameSpace}__bounce-exit--top-right, .${ToastNameSpace}__bounce-exit--bottom-right`]: {
			'@apply animate-toastBounceOutRight': {},
		},
		[`.${ToastNameSpace}__bounce-exit--top-center`]: {
			'@apply animate-toastBounceOutUp': {},
		},
		[`.${ToastNameSpace}__bounce-exit--bottom-center`]: {
			'@apply animate-toastBounceOutDown': {},
		},

		/* Flip */
		[`.${ToastNameSpace}__flip-enter`]: {
			'@apply animate-toastFlipIn': {},
		},
		[`.${ToastNameSpace}__flip-exit`]: {
			'@apply animate-toastFlipOut': {},
		},

		/* Slide Enter */
		[`.${ToastNameSpace}__slide-enter--top-left, .${ToastNameSpace}__slide-enter--bottom-left`]: {
			'@apply animate-toastSlideInLeft': {},
		},
		[`.${ToastNameSpace}__slide-enter--top-right, .${ToastNameSpace}__slide-enter--bottom-right`]: {
			'@apply animate-toastSlideInRight': {},
		},
		[`.${ToastNameSpace}__slide-enter--top-center`]: {
			'@apply animate-toastSlideInDown': {},
		},
		[`.${ToastNameSpace}__slide-enter--bottom-center`]: {
			'@apply animate-toastSlideInUp': {},
		},

		/* Slide Exit */
		[`.${ToastNameSpace}__slide-exit--top-left, .${ToastNameSpace}__slide-exit--bottom-left`]: {
			'@apply animate-toastSlideOutLeft': {},
		},
		[`.${ToastNameSpace}__slide-exit--top-right, .${ToastNameSpace}__slide-exit--bottom-right`]: {
			'@apply animate-toastSlideOutRight': {},
		},
		[`.${ToastNameSpace}__slide-exit--top-center`]: {
			'@apply animate-toastSlideOutUp': {},
		},
		[`.${ToastNameSpace}__slide-exit--bottom-center`]: {
			'@apply animate-toastSlideOutDown': {},
		},

		/* Spin */
		[`.${ToastNameSpace}__spin`]: {
			'@apply animate-toastSpin': {},
		},

		/* Zoom */
		[`.${ToastNameSpace}__zoom-enter`]: {
			'@apply animate-toastZoomIn': {},
		},
		[`.${ToastNameSpace}__zoom-exit`]: {
			'@apply animate-toastZoomOut': {},
		},

		/* Progress bar */
		[`.${ToastNameSpace}__progress-bar`]: {
			'@apply animate-toastTrackProgress': {},
		},

		/* Toast container */
		[`.${ToastNameSpace}__toast-container`]: {
			'@apply fixed z-toastify p-1 w-toastify-toast-width box-border text-white max-toast-mobile:w-screen max-toast-mobile:p-0 max-toast-mobile:left-0 max-toast-mobile:m-0': {},
			transform: 'translate3d(0, 0, 9999px)', // keep manual since Tailwind can’t cover this
		},
		[`.${ToastNameSpace}__toast-container--top-left`]: {
			'@apply top-4 left-4 max-toast-mobile:top-0 max-toast-mobile:translate-x-0': {},
		},
		[`.${ToastNameSpace}__toast-container--top-center`]: {
			'@apply top-12 left-1/2 -translate-x-1/2 max-toast-mobile:top-0 max-toast-mobile:translate-x-0': {},
		},
		[`.${ToastNameSpace}__toast-container--top-right`]: {
			'@apply top-4 right-4 max-toast-mobile:top-0 max-toast-mobile:translate-x-0': {},
		},
		[`.${ToastNameSpace}__toast-container--bottom-left`]: {
			'@apply bottom-4 left-4 max-toast-mobile:bottom-0 max-toast-mobile:translate-x-0': {},
		},
		[`.${ToastNameSpace}__toast-container--bottom-center`]: {
			'@apply bottom-4 left-1/2 -translate-x-1/2 max-toast-mobile:bottom-0 max-toast-mobile:translate-x-0': {},
		},
		[`.${ToastNameSpace}__toast-container--bottom-right`]: {
			'@apply bottom-4 right-4 max-toast-mobile:bottom-0 max-toast-mobile:translate-x-0': {},
		},
		[`.${ToastNameSpace}__toast-container--rtl`]: {
			'@apply max-toast-mobile:right-0 max-toast-mobile:left-auto': {},
		},

		// Base close button
		[`.${ToastNameSpace}__close-button`]: {
			'@apply text-white bg-transparent outline-none border-none p-0 cursor-pointer opacity-70 transition duration-300 ease-in-out self-start': {},
			'&:hover, &:focus': {
				'@apply opacity-100': {},
			},
			'& > svg': {
				'@apply fill-current h-4 w-[14px]': {}, // height: 16px → h-4, width: 14px → arbitrary class
			},
		},

		// Light variant
		[`.${ToastNameSpace}__close-button--light`]: {
			'@apply text-black opacity-30': {},
		},

		// Toast
		[`.${ToastNameSpace}__toast`]: {
			'@apply relative box-border mb-4 p-2 rounded-m border min-h-toastify-toast-min-height border-[#eeeeee] shadow-rsp flex justify-between max-h-toastify-toast-max-height overflow-hidden cursor-default z-0 max-toast-mobile:mb-0 max-toast-mobile:rounded-none': {},
			'direction': 'ltr',
		},

		// RTL
		[`.${ToastNameSpace}__toast--rtl`]: {
			direction: 'rtl',
		},

		// Close-on-click
		[`.${ToastNameSpace}__toast--close-on-click`]: {
			'@apply cursor-pointer': {},
		},

		// Toast body
		[`.${ToastNameSpace}__toast-body`]: {
			'@apply my-auto flex-1 p-[6px] flex items-center': {},
		},
		[`.${ToastNameSpace}__toast-body > div:last-child`]: {
			'@apply break-words flex-1': {},
		},

		// Toast icon
		[`.${ToastNameSpace}__toast-icon`]: {
			'@apply flex w-5 shrink-0 me-[10px]': {},
		},

		// Animations
		[`.${ToastNameSpace}--animate`]: {
			'animation-duration': '700ms',
			'animation-fill-mode': 'both',
		},
		[`.${ToastNameSpace}--animate-icon`]: {
			'animation-duration': '300ms',
			'animation-fill-mode': 'both',
		},

		// Toast themes
		[`.${ToastNameSpace}__toast-theme--dark`]: {
			'@apply bg-toastify-dark text-toastify-dark': {},
		},
		[`.${ToastNameSpace}__toast-theme--light`]: {
			'@apply bg-toastify-light text-toastify-light': {},
		},
		[`.${ToastNameSpace}__toast-theme--colored.${ToastNameSpace}__toast--default`]: {
			'@apply bg-toastify-light text-toastify-light': {},
		},
		[`.${ToastNameSpace}__toast-theme--colored.${ToastNameSpace}__toast--info`]: {
			'@apply bg-toastify-info text-toastify-info': {},
		},
		[`.${ToastNameSpace}__toast-theme--colored.${ToastNameSpace}__toast--success`]: {
			'@apply bg-toastify-success text-toastify-success': {},
		},
		[`.${ToastNameSpace}__toast-theme--colored.${ToastNameSpace}__toast--warning`]: {
			'@apply bg-toastify-warning text-toastify-warning': {},
		},
		[`.${ToastNameSpace}__toast-theme--colored.${ToastNameSpace}__toast--error`]: {
			'@apply bg-toastify-error text-toastify-error': {},
		},

		// Progress bar themes.
		[`.${ToastNameSpace}__progress-bar-theme--light`]: {
			'@apply bg-toastify-progress-light': {},
		},
		[`.${ToastNameSpace}__progress-bar-theme--dark`]: {
			'@apply bg-toastify-progress-dark': {},
		},
		[`.${ToastNameSpace}__progress-bar--info`]: {
			'@apply bg-toastify-progress-info': {},
		},
		[`.${ToastNameSpace}__progress-bar--success`]: {
			'@apply bg-toastify-progress-success': {},
		},
		[`.${ToastNameSpace}__progress-bar--warning`]: {
			'@apply bg-toastify-progress-warning': {},
		},
		[`.${ToastNameSpace}__progress-bar--error`]: {
			'@apply bg-toastify-progress-error': {},
		},
		[`.${ToastNameSpace}__progress-bar-theme--colored.${ToastNameSpace}__progress-bar--info,
		.${ToastNameSpace}__progress-bar-theme--colored.${ToastNameSpace}__progress-bar--success,
		.${ToastNameSpace}__progress-bar-theme--colored.${ToastNameSpace}__progress-bar--warning,
		.${ToastNameSpace}__progress-bar-theme--colored.${ToastNameSpace}__progress-bar--error`]: {
			'@apply bg-toastify-transparent': {},
		},

		// Base progress bar.
		[`.${ToastNameSpace}__progress-bar`]: {
			'@apply z-toastify absolute bottom-0 left-0 w-full h-[5px] opacity-70 origin-left': {},
		},
		[`.${ToastNameSpace}__progress-bar--animated`]: {
			animation: `${ToastNameSpace}__trackProgress linear 1 forwards`,
		},
		[`.${ToastNameSpace}__progress-bar--controlled`]: {
			transition: 'transform 0.2s',
		},
		[`.${ToastNameSpace}__progress-bar--rtl`]: {
			'@apply right-0 origin-right': {},
			left: 'initial',
		},

		// Spinner
		[`.${ToastNameSpace}__spinner`]: {
			'@apply w-5 h-5 box-border rounded-full border-2 border-toastify-spinner-empty border-r-toastify-spinner animate-toastSpin': {},
		},
	});
}