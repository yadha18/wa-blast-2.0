/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#132A2E',
        signal: '#1F8A70',
        signalDark: '#166B57',
        paper: '#F5F3EE',
        line: '#DAD5C8',
        warn: '#B4552F',
      },
      fontFamily: {
        display: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
