// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        protocol: {
          opcua: '#3b82f6',
          rest: '#10b981', 
          websocket: '#f59e0b',
          grpc: '#8b5cf6',
          cpd: '#14b8a6',
          sql: '#6366f1'
        },
        swarco: {
          blue: {
            100: '#E7F2F9',
            200: '#BEDCEF',
            400: '#6CB0DA',
            600: '#1785CA',
            800: '#006BAC',
            900: '#153D56',
          },
          grey: {
            100: '#E6E9EA',
            200: '#C8D1D6',
            400: '#939EA4',
            600: '#5F6B72',
            800: '#485156',
            900: '#1D1D1B',
          },
          green: { 200: '#A9EFB6', 500: '#29D649', 800: '#10561D' },
          jade: { 200: '#A9EFCD', 500: '#29D682', 800: '#105634' },
          yellow: { 200: '#FFF199', 500: '#FFDD00', 800: '#665800' },
          lime: { 200: '#FAFF66', 500: '#DEE500', 800: '#4A4D00' },
          orange: { 200: '#FFCA99', 500: '#FF7B00', 800: '#663100' },
          red: { 200: '#FA9EA1', 500: '#E90C14', 800: '#610508' },
          pink: { 200: '#FA9EC0', 500: '#E90C5D', 800: '#610527' },
          warmgrey: { 200: '#CECACA', 500: '#857A7A', 800: '#353131' },
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounce 2s infinite',
      },
      fontFamily: {
        sans: ['Montserrat', 'Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      }
    },
  },
  plugins: [],
  darkMode: 'class',
}
