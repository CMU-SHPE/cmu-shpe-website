import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'shpe-red': '#C8102E',
        // SHPE Red tinted with white so it passes WCAG AA contrast on cmu-maroon
        'shpe-red-on-maroon': { DEFAULT: '#DB6477', hover: '#E48896' },
        'shpe-gold': '#FDB913',
        'cmu-maroon': '#4B0012',
      },
    },
  },
  plugins: [],
}

export default config
