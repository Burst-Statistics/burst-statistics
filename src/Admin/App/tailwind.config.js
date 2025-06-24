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

const blueColor = {
  light: '#ebf2f9',
  DEFAULT: '#1D3C8F',
  dark: '#142963'
};

module.exports = {
  mode: 'jit',
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  safelist: [
    'animate-spin'
  ],
  theme: {
    extend: {
      screens: {
        '2xl': '1600px'
      }
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
      red: {
        light: '#fbebed',
        DEFAULT: '#c6273b',
        dark: '#631a25'
      },
      orange: {
        light: '#fef5ea',
        DEFAULT: '#ef8a09',
        dark: '#631a25'
      },
      gray: {
        100: '#f8f9fa',
        200: '#e9ecef',
        300: '#dee2e6',
        400: '#ced4da',
        500: '#adb5bd',
        600: '#6c757d',
        700: '#495057',
        800: '#343a40',
        900: '#212529',
        1000: '#111315'
      },
      wp: {
        blue: '#2271b1',
        gray: '#f0f0f1',
        orange: '#d63638',
        black: '#1d2327'
      }
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
      orange: '#ef8a09'
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
      '4xl': [ '1.875rem', '2.25rem' ] // 30px with 36px line-height
    }
  },
  variants: {
    extend: {}
  },
  plugins: [],
  important: '#burst-statistics'
};
