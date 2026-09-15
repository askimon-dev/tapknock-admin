import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#1a73e8',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        surface: {
          darkest: 'rgb(var(--surface-darkest) / <alpha-value>)',
          darker: 'rgb(var(--surface-darker) / <alpha-value>)',
          card: 'rgb(var(--surface-card) / <alpha-value>)',
          cardHover: 'rgb(var(--surface-cardHover) / <alpha-value>)',
          border: 'rgb(var(--surface-border) / <alpha-value>)',
          borderMuted: 'rgb(var(--surface-borderMuted) / <alpha-value>)',
        }
      },
    },
  },
  plugins: [],
};
export default config;
