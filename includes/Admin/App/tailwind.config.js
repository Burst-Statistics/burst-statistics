import { keyFrames, animations } from "./tailwind.animations";
import { ToastComponents } from "./src/tailwind-plugins/toast-components";

/** @type {import('tailwindcss').Config} */
// Define common color objects to alias duplicate colors.

const brandColor = {
	lightest: '#ecf4ed',
	lighter: '#d2e4d3',
	light: '#b7d4b8',
	DEFAULT: '#2B8133',
	dark: '#1e7e1e',
	darker: '#1a6c1a',
	darkest: '#155515',
	secondary: '#FFDA4A',
};

const greenColor = {
	light: brandColor.lightest,
	DEFAULT: brandColor.DEFAULT,
	dark: '#233525',
};

const yellowColor = {
	light: '#F9F5E4',
	DEFAULT: brandColor.secondary,
	dark: '#555248',
};

const goldColor = {
	light: '#FFD700',
	DEFAULT: '#B8860B',
	dark: '#8B6508',
};

const blueColor = {
	lighter: '#ECF8FE',
	light: '#ebf2f9',
	DEFAULT: '#1D3C8F',
	dark: '#142963',
	darker: '#1E73BE'
};

const redColor = {
	light: '#fbebed',
	DEFAULT: '#c6273b',
	dark: '#631a25',
};

const orangeColor = {
	light: '#fef5ea',
	DEFAULT: '#ef8a09',
	dark: '#631a25',
};

/**
 * Toastify colors mapped to CSS variables.
 */
const toastifyColors = {
	light: '#fff',
	dark: '#333',
	info: yellowColor.DEFAULT,
	success: greenColor.DEFAULT,
	warning: orangeColor.DEFAULT,
	error: redColor.DEFAULT,
	transparent: 'rgba(255, 255, 255, 0.7)',
};

/**
 * Toastify text colors mapped to CSS variables.
 */
const toastifyTextColors = {
	light: '#1A1A1AE5',
	dark: '#FFFFFFE5',
	info: '#fff',
	success: '#fff',
	warning: '#fff',
	error: '#fff',
};

/**
 * Toastify progress bar colors mapped to CSS variables.
 */
const toastifyProgressColors = {
	light: 'linear-gradient(to right, #4cd964, #5ac8fa, #007aff, #34aadc, #5856d6, #ff2d55)',
	dark: '#bb86fc',
	info: 'var(--toastify-color-info)',
	success: 'var(--toastify-color-success)',
	warning: 'var(--toastify-color-warning)',
	error: 'var(--toastify-color-error)',
};

module.exports = {
	mode: 'jit',
	content: ['./src/**/*.{js,jsx,ts,tsx}'],
	safelist: [
		'animate-spin',
		{
			pattern: /(yellow|green|blue|black|gray-400)$/,
			variants: ['hover', '[&_a:hover]', '[&_a>.burst-bullet:hover]'],
		},
		{ pattern: /^rdr/ },
		{ pattern: /^rdt/ },
		{ pattern: /^Toastify/ },
	],
	theme: {
		extend: {
			screens: {
				'toast-mobile': '480px',
				xxs: '576px',
				'2xl': '1600px',
			},
			spacing: {
				'toastify-toast-width': '320px',
				'toastify-toast-min-height': '42px',
				'toastify-toast-max-height': '800px',
			},
			zIndex: {
				toastify: '9999',
			},
			borderColor: {
				'toastify-spinner': '#616161',
				'toastify-spinner-empty': '#e0e0e0',
			},
			boxShadow: {
				rsp: 'rgba(0,0,0,0.1) 0 4px 6px -1px, rgba(0,0,0,0.06) 0 2px 4px -1px',
				greenShadow: `inset 0 0 3px 2px ${greenColor.light}`,
				primaryButtonHover: `0 0 0 3px rgba(34, 113, 177, 0.3)`,
				secondaryButtonHover: `0 0 0 3px rgba(0, 0, 0, 0.1)`,
				tertiaryButtonHover: `0 0 0 3px rgba(255, 0, 0, 0.3)`,
				proButtonHover: `0 0 0 3px ${brandColor.light}`,
			},
			gridTemplateColumns: {
				'auto-1fr-auto': 'auto 1fr auto',
			},
			keyframes: { ...keyFrames },
			animation: { ...animations },
			colors: {
				transparent: 'transparent',
				current: 'currentColor',
				primary: greenColor,
				secondary: yellowColor,
				accent: blueColor,
				green: greenColor,
				yellow: yellowColor,
				blue: blueColor,
				red: redColor,
				orange: orangeColor,
				gold: goldColor,
				brand: brandColor,
				toastify: toastifyColors,

				white: '#fff',
				black: '#151615',

				gray: {
					50: '#f9f9f9',
					100: '#f8f9fa',
					200: '#e9ecef',
					300: '#dee2e6',
					400: '#ced4da',
					500: '#adb5bd',
					600: '#6c757d',
					700: '#495057',
					800: '#343a40',
					900: '#212529',
				},

				'button-accent': '#2271b1',
				'border': '#dfdfdf',
				'divider': '#ccc',

				wp: {
					blue: '#2271b1',
					gray: '#f0f0f1',
					orange: '#d63638',
					black: '#1d2327',
				},
			},
			backgroundImage: {
				'toastify-progress-light': toastifyProgressColors.light,
			},
			backgroundColor: {
				'toastify-progress-dark': toastifyProgressColors.dark,
				'toastify-progress-info': toastifyProgressColors.info,
				'toastify-progress-success': toastifyProgressColors.success,
				'toastify-progress-warning': toastifyProgressColors.warning,
				'toastify-progress-error': toastifyProgressColors.error,
			},
			textColor: (theme) => ({
				black: '#1a1a1ae5',
				white: '#ffffffe5',
				gray: '#454552e5',

				primary: theme('colors.primary.DEFAULT'),
				secondary: theme('colors.secondary.DEFAULT'),
				yellow: theme('colors.yellow.DEFAULT'),
				blue: theme('colors.blue.DEFAULT'),
				green: theme('colors.green.DEFAULT'),
				red: theme('colors.red.DEFAULT'),
				orange: theme('colors.orange.DEFAULT'),
				toastify: toastifyTextColors,

				'button-contrast': '#000',
				'button-secondary': '#fff',
				'button-accent': theme('colors.button-accent'),
				'gray-400': '#c6c6c6',
			}),
		},
		fontSize: {
			xxs: ['0.6875rem', '1rem'], // 11px / ~16px
			xs: ['0.625rem', '0.875rem'], // 10px with 14px line-height
			sm: ['0.75rem', '1.125rem'], // 12px with 18px line-height
			base: ['0.8125rem', '1.25rem'], // 13px with 20px line-height
			md: ['0.875rem', '1.375rem'], // 14px with 22px line-height
			lg: ['1rem', '1.625rem'], // 16px with 26px line-height
			xl: ['1.125rem', '1.625rem'], // 18px with 26px line-height
			'2xl': ['1.25rem', '1.75rem'], // 20px with 28px line-height
			'3xl': ['1.5rem', '2rem'], // 24px with 32px line-height
			'4xl': ['1.875rem', '2.25rem'], // 30px with 36px line-height
			'5xl': ['3.5rem', '1'], // 56px / normal line-height
		},
	},
	variants: {
		extend: {},
	},
	plugins: [
		ToastComponents
	],
	important: '#burst-statistics',
};
