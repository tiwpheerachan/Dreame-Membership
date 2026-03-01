/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dreame: {
          50:  '#fef9ee',
          100: '#fdf0d3',
          200: '#fadf9f',
          300: '#f7c964',
          400: '#f4ae32',
          500: '#f1941a',
          600: '#d46f0f',
          700: '#b05110',
          800: '#8d4014',
          900: '#743514',
        },
      },
    },
  },
  plugins: [],
}
