import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'shpe-red': '#C8102E',
        'shpe-gold': '#FDB913',
        'cmu-maroon': '#4B0012',
        'sgm-bg': '#555555',
      },
    },
  },
  plugins: [],
}

export default config
