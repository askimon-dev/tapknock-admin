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
          darkest: 'var(--surface-darkest, #090d16)',
          darker: 'var(--surface-darker, #0d1322)',
          card: 'var(--surface-card, #131b2e)',
          cardHover: 'var(--surface-cardHover, #18233c)',
          border: 'var(--surface-border, #1e2d4a)',
          borderMuted: 'var(--surface-borderMuted, #172238)',
        }
      },
    },
  },
  plugins: [],
};
export default config;
