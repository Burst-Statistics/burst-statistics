/** @type {import('tailwindcss').Config} */
// Define common color objects to alias duplicate colors
const greenColor = {
  light: '#ecf4ed',
  DEFAULT: '#2B8133',
  dark: '#233525'
};

const yellowColor = {
  light: '#F9F5E4',
  DEFAULT: '#FFDA4A',
  dark: '#555248'
};

const goldColor = {
  light: '#FFD700',
  DEFAULT: '#B8860B',
  dark: '#8B6508'
};

const blueColor = {
  light: '#ebf2f9',
  DEFAULT: '#1D3C8F',
  dark: '#142963'
};

const redColor = {
  light: '#fbebed',
  DEFAULT: '#c6273b',
  dark: '#631a25'
}

const orangeColor = {
  light: '#fef5ea',
  DEFAULT: '#ef8a09',
  dark: '#631a25'
}

const brandColor = {
  lightest: '#ecf4ed',
  lighter: '#d2e4d3',
  light: '#b7d4b8',
  DEFAULT: '#2B8133',
  dark: '#1e7e1e',
  darker: '#1a6c1a',
  darkest: '#155515',
  secondary: yellowColor.DEFAULT,
}

module.exports = {
  mode: 'jit',
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  safelist: [
    'animate-spin',
	  {
		pattern: /(yellow|green|blue|black|gray-400)$/,
		variants: [
		  'hover',
		  '[&_a:hover]',
		  '[&_a>.burst-bullet:hover]'
		],
	  },
  ],
  theme: {
    extend: {
      screens: {
        '2xl': '1600px'
      },
      spacing: {
        xxs: '5px',
        xs: '10px',
        s: '15px',
        m: '20px',
        l: '25px',
        xl: '30px',
      },
      padding: {
        button: '0 10px',
      },
      borderRadius: {
        xs: '5px',
        s: '8px',
        DEFAULT: '4px',
        m: '12px',
      },
      boxShadow: {
        rsp: "rgba(0,0,0,0.1) 0 4px 6px -1px, rgba(0,0,0,0.06) 0 2px 4px -1px",
        greenShadow: `inset 0 0 3px 2px ${greenColor.light}`,
        primaryButtonHover: `0 0 0 3px rgba(34, 113, 177, 0.3)`,
        secondaryButtonHover: `0 0 0 3px rgba(0, 0, 0, 0.1)`,
        tertiaryButtonHover: `0 0 0 3px rgba(255, 0, 0, 0.3)`,
        proButtonHover: `0 0 0 3px ${brandColor.light}`,
      },
      gridTemplateColumns: {
        'auto-1fr-auto': 'auto 1fr auto',
      },
      keyframes: {
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
      },
      animation: {
        slideUpAndFade: 'slideUpAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        slideRightAndFade: 'slideRightAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        slideDownAndFade: 'slideDownAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        slideLeftAndFade: 'slideLeftAndFade 400ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
      fontWeight: {
        button: '400',
      },
    },
    colors: {
      primary: greenColor,
      green: greenColor,
      secondary: yellowColor,
      accent: blueColor,
      white: '#ffffff',
      black: '#151615',
      yellow: yellowColor,
      blue: blueColor,
      red: redColor,
      orange: orangeColor,
      gold: goldColor,
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
      wp: {
        blue: '#2271b1',
        gray: '#f0f0f1',
        orange: '#d63638',
        black: '#1d2327'
      },
      brandColor: brandColor,
    },
    textColor: {
      black: 'rgba(26,26,26,0.9)',
      white: 'rgb(255 255 255 / 0.9)',
      gray: 'rgba(69, 69, 82, 0.9)',
      primary: greenColor.DEFAULT,
      secondary: yellowColor.DEFAULT,
      yellow: yellowColor.DEFAULT,
      blue: blueColor.DEFAULT,
      green: greenColor.DEFAULT,
      red: '#c6273b',
      orange: '#ef8a09',
      'button-contrast': '#000',
      'button-secondary': '#fff',
	  'button-accent': '#2271b1',
	  'gray-400': '#c6c6c6',
    },
    fontSize: {
      xs: [ '0.625rem', '0.875rem' ], // 10px with 14px line-height
      sm: [ '0.75rem', '1.125rem' ], // 12px with 18px line-height
      base: [ '0.8125rem', '1.25rem' ], // 13px with 20px line-height
      md: [ '0.875rem', '1.375rem' ], // 14px with 22px line-height
      lg: [ '1rem', '1.625rem' ], // 16px with 26px line-height
      xl: [ '1.125rem', '1.625rem' ], // 18px with 26px line-height
      '2xl': [ '1.25rem', '1.75rem' ], // 20px with 28px line-height
      '3xl': [ '1.5rem', '2rem' ], // 24px with 32px line-height
      '4xl': [ '1.875rem', '2.25rem' ], // 30px with 36px line-height
      button: [ '0.8125rem', '1.625' ], // 13px with 26px line-height
    },
  },
  variants: {
    extend: {}
  },
  plugins: [],
  important: '#burst-statistics'
};
