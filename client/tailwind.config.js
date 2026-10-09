const defaultTheme = require('tailwindcss/defaultTheme')

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Open Sans', 'sans-serif'],
        heading: ['Poppins', 'sans-serif'],
      },
      colors: {
        cream: '#f4f0dc',
        leaf: {
          DEFAULT: '#17452f',
          deep: '#123b29',
        },
        primary: {
          50: '#ECFDF3',
          100: '#D1FADF',
          200: '#A6F4C5',
          300: '#6CE9A6',
          400: '#32D583',
          500: '#12B76A',
          600: '#039855',
          700: '#027A48',
          800: '#05603A',
          900: '#054F31',
          950: '#053321',
        },
        gray: {
          25: '#FCFCFD',
          50: '#F9FAFB',
          100: '#F2F4F7',
          200: '#EAECF0',
          300: '#D0D5DD',
          400: '#98A2B3',
          500: '#667085',
          600: '#475467',
          700: '#344054',
          800: '#1D2939',
          900: '#101828',
          950: '#0C111D',
        },
        success: {
          DEFAULT: '#12B76A',
          soft: '#D1FADF',
        },
        warning: {
          DEFAULT: '#DC6803',
          soft: '#FEF0C7',
        },
        danger: {
          DEFAULT: '#F04438',
          soft: '#FEE4E2',
        },
        info: {
          DEFAULT: '#2E90FA',
          soft: '#E0F2FE',
        },
        accent: {
          DEFAULT: '#F79009',
          soft: '#FEF0C7',
        },
      },
    },
  },
  screens: {
    'xs': '450px',
    ...defaultTheme.screens,
  },
  plugins: [],
};
