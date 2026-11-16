/** @type {import('tailwindcss').Config} */
// "Celeste y blanco" theme (Argentine flag blue, Sol de Mayo gold, poncho salteño red): the default dark palettes are remapped to inverted
// paper-and-ink scales (light shades become dark ink, dark shades become paper tints),
// so every existing utility class renders in the survey-chart look.
const ink = {
  50: '#17130f', 100: '#1f1a15', 200: '#2c261f', 300: '#453d33', 400: '#665c50', 500: '#857a6c',
  600: '#a69a89', 700: '#bfb39e', 800: '#cfc4ae', 900: '#ebe4d3', 950: '#f5efe0',
};
const rust = {
  50: '#3a1307', 100: '#4d190a', 200: '#69220e', 300: '#8c2d13', 400: '#ad3a19', 500: '#c54821',
  600: '#d7663e', 700: '#e48c6a', 800: '#efb8a1', 900: '#f6d8ca', 950: '#fbebe3',
};
const pine = {
  50: '#06221b', 100: '#0a3228', 200: '#0f4839', 300: '#145f4b', 400: '#1a775e', 500: '#239075',
  600: '#49aa90', 700: '#7ec4af', 800: '#b2dbcd', 900: '#d5ece4', 950: '#e9f5f0',
};
const ochre = {
  50: '#2c1e02', 100: '#3d2a03', 200: '#593d05', 300: '#765107', 400: '#94660a', 500: '#b37c0e',
  600: '#cc972c', 700: '#deb65d', 800: '#ecd396', 900: '#f5e7c2', 950: '#faf2dd',
};
const wine = {
  50: '#380713', 100: '#4b0a1a', 200: '#6b0f26', 300: '#8c1532', 400: '#ac1c3f', 500: '#c5304e',
  600: '#d65b73', 700: '#e48b9c', 800: '#f0b9c3', 900: '#f7dae0', 950: '#fcecef',
};
const clay = {
  50: '#381503', 100: '#4a1c04', 200: '#682806', 300: '#8f380a', 400: '#b0470e', 500: '#cb5916',
  600: '#db7a3f', 700: '#e79f73', 800: '#f1c5aa', 900: '#f8e0d1', 950: '#fcf0e8',
};
const indigoInk = {
  50: '#0c1433', 100: '#111c47', 200: '#182863', 300: '#22387f', 400: '#2d4a9c', 500: '#3b5fbb',
  600: '#607fcf', 700: '#8ea5df', 800: '#bccaed', 900: '#dde4f6', 950: '#eef1fb',
};
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Chivo Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['"Chivo"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Archivo"', 'system-ui', 'sans-serif'],
      },
      colors: {
        slate: ink,
        cyan: rust,
        emerald: pine,
        amber: ochre,
        rose: wine,
        red: wine,
        orange: clay,
        sky: indigoInk,
        purple: indigoInk,
      },
    },
  },
  plugins: [],
};
