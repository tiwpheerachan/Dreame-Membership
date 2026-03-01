import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dreame: {
          50:  '#fdf8ee',
          100: '#faefd0',
          200: '#f4dd9d',
          300: '#ecc660',
          400: '#e6b030',
          500: '#d4941a',
          600: '#b87413',
          700: '#8f5312',
          800: '#764217',
          900: '#633718',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
