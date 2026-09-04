/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sql: {
          bg: '#0f172a',
          panel: '#1e293b',
          border: '#334155',
          accent: '#38bdf8',
          keyword: '#c084fc',
          string: '#fbbf24',
          number: '#34d399',
          comment: '#64748b',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}