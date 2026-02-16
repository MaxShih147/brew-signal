/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brew: {
          50: '#fdf8f0',
          100: '#f9eddb',
          200: '#f2d7b0',
          300: '#e9bb7c',
          400: '#df9a48',
          500: '#d68228',
          600: '#c46a1e',
          700: '#a3521b',
          800: '#84421d',
          900: '#6c371b',
        },
      },
    },
  },
  plugins: [],
}
