/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        space: {
          950: '#04070d',
          900: '#080e1a',
          800: '#0f172a',
          700: '#1e293b',
        },
        telemetry: {
          cyan: '#22d3ee',
          amber: '#f59e0b',
          emerald: '#10b981',
          rose: '#f43f5e',
          mars: '#ea580c',
          lunar: '#94a3b8',
        },
      },
    },
  },
  plugins: [],
};
