import { keyFrames, animations } from './tailwind.animations.mjs';

/** @type {import('tailwindcss').Config} */

const brandColor = {
	lightest: '#ecf4ed',
	lighter: '#d2e4d3',
	light: '#b7d4b8',
	DEFAULT: '#2B8133',
	dark: '#1e7e1e',
	darker: '#1a6c1a',
	darkest: '#155515',
	secondary: '#FFDA4A'
};

const greenColor = {
	light: brandColor.lightest,
	DEFAULT: brandColor.DEFAULT,
	dark: '#233525'
};

const yellowColor = {
	light: '#F9F5E4',
	DEFAULT: brandColor.secondary,
	dark: '#555248'
};

const goldColor = {
	light: '#FFD700',
	DEFAULT: '#B8860B',
	dark: '#8B6508'
};

const blueColor = {
	lightest: '#21468B0F',
	lighter: '#ECF8FE',
	light: '#ebf2f9',
	DEFAULT: '#1D3C8F',
	dark: '#142963',
	darker: '#1E73BE'
};

const redColor = {
	light: '#fbebed',
	DEFAULT: '#c6273b',
	dark: '#631a25'
};

const orangeColor = {
	light: '#fef5ea',
	DEFAULT: '#ef8a09',
	dark: '#631a25'
};

const dashboardDarkColor = {
	base: "#121313",
	surface: "#1c1d1b",
	text: "#F2F2F2",
	accent: "#2B8133",
	danger: "#c6273b",
};

export default {
	content: ["./src/**/*.{js,jsx,ts,tsx,css}"],
	theme: {
		extend: {
			screens: {
				xxs: "576px",
				"2xl": "1600px",
			},
			boxShadow: {
				rsp: "rgba(0,0,0,0.1) 0 4px 6px -1px, rgba(0,0,0,0.06) 0 2px 4px -1px",
				greenShadow: `inset 0 0 3px 2px ${greenColor.light}`,
				primaryButtonHover: "0 0 0 3px rgba(34, 113, 177, 0.3)",
				secondaryButtonHover: "0 0 0 3px rgba(0, 0, 0, 0.1)",
				tertiaryButtonHover: "0 0 0 3px rgba(255, 0, 0, 0.3)",
				proButtonHover: `0 0 0 3px ${brandColor.light}`,
				"layered-low-b":
					"0 1px 1px rgb(0 0 0 / 0.05), 0 2px 2px rgb(0 0 0 / 0.05), 0 4px 4px rgb(0 0 0 / 0.03)",
				"layered-low-t":
					"0 -1px 1px rgb(0 0 0 / 0.05), 0 -2px 2px rgb(0 0 0 / 0.05), 0 -4px 4px rgb(0 0 0 / 0.03)",
				"layered-mid-b":
					"0 1px 1px rgb(0 0 0 / 0.05), 0 2px 2px rgb(0 0 0 / 0.05), 0 4px 4px rgb(0 0 0 / 0.03), 0 8px 8px rgb(0 0 0 / 0.025)",
				"layered-mid-t":
					"0 -1px 1px rgb(0 0 0 / 0.05), 0 -2px 2px rgb(0 0 0 / 0.05), 0 -4px 4px rgb(0 0 0 / 0.03), 0 -8px 8px rgb(0 0 0 / 0.025)",
				"layered-high-b":
					"0 1px 1px rgb(0 0 0 / 0.06), 0 2px 2px rgb(0 0 0 / 0.05), 0 4px 4px rgb(0 0 0 / 0.03), 0 8px 8px rgb(0 0 0 / 0.025), 0 16px 16px rgb(0 0 0 / 0.025)",
				"layered-high-t":
					"0 -1px 1px rgb(0 0 0 / 0.06), 0 -2px 2px rgb(0 0 0 / 0.05), 0 -4px 4px rgb(0 0 0 / 0.03), 0 -8px 8px rgb(0 0 0 / 0.025), 0 -16px 16px rgb(0 0 0 / 0.025)",
			},
			gridTemplateColumns: {
				"auto-1fr-auto": "auto 1fr auto",
			},
			keyframes: { ...keyFrames },
			animation: { ...animations },
			colors: {
				transparent: "transparent",
				current: "currentColor",
				"dashboard-dark": dashboardDarkColor,
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
				white: "#fff",
				black: "#151615",
				gray: {
					50: "#f9f9f9",
					100: "#f8f9fa",
					200: "#e9ecef",
					300: "#dee2e6",
					400: "#ced4da",
					500: "#adb5bd",
					600: "#6c757d",
					700: "#495057",
					800: "#343a40",
					900: "#212529",
				},
				"button-accent": "#2271b1",
				border: "#dfdfdf",
				divider: "#ccc",
				wp: {
					blue: "#2271b1",
					gray: "#f0f0f1",
					orange: "#d63638",
					black: "#1d2327",
				},
			},
			textColor: (theme) => ({
				black: "#1a1a1ae5",
				"black-light": "#1A1A1AB2",
				white: "#ffffffe5",
				primary: theme("colors.primary.DEFAULT"),
				secondary: theme("colors.secondary.DEFAULT"),
				yellow: theme("colors.yellow.DEFAULT"),
				blue: theme("colors.blue.DEFAULT"),
				green: theme("colors.green.DEFAULT"),
				red: theme("colors.red.DEFAULT"),
				orange: theme("colors.orange.DEFAULT"),
				"button-contrast": "#000",
				"button-secondary": "#fff",
				"button-accent": theme("colors.button-accent"),
				gray: {
					DEFAULT: "#454552e5",
					50: "#f9f9f9",
					100: "#f8f9fa",
					200: "#e9ecef",
					300: "#dee2e6",
					400: "#ced4da",
					500: "#adb5bd",
					600: "#6c757d",
					700: "#495057",
					800: "#343a40",
					900: "#212529",
				},
			}),
		},
		fontSize: {
			xxs: ["0.5625rem", "0.8125rem"],
			xs: ["0.625rem", "0.875rem"],
			sm: ["0.75rem", "1.125rem"],
			base: ["0.8125rem", "1.25rem"],
			md: ["0.875rem", "1.375rem"],
			lg: ["1rem", "1.625rem"],
			xl: ["1.125rem", "1.625rem"],
			"2xl": ["1.25rem", "1.75rem"],
			"3xl": ["1.5rem", "2rem"],
			"4xl": ["1.875rem", "2.25rem"],
			"5xl": ["3.5rem", "1"],
		},
	},
	safelist: [
		"animate-spin",
		"animate-pulseSlow",
		"animate-shimmer",
		{
			pattern: /(yellow|green|blue|black|gray-400)$/,
			variants: ["hover", "[&_a:hover]", "[&_a>.burst-bullet:hover]"],
		},
		{ pattern: /^rdr/ },
		{ pattern: /^rdt/ },
	],
	// important: "#burst-statistics",
};
