import type { Config } from 'tailwindcss'

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0c295a',
        },
        secondary: {
          DEFAULT: '#ffffff',
        },
      },
    },
  },
  plugins: [],
}
export default config;