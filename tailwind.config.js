/** @type {import('tailwindcss').Config} */
// "Celeste y blanco" theme (Argentine flag blue, Sol de Mayo gold, poncho salteño red): the default dark palettes are remapped to inverted
// paper-and-ink scales (light shades become dark ink, dark shades become paper tints),
// so every existing utility class renders in the survey-chart look.
const ink = {"50":"#0a1424","100":"#0f1c30","200":"#18283f","300":"#2b3e58","400":"#4c5f7a","500":"#6e809a","600":"#93a3ba","700":"#b3c2d6","800":"#c6d5e8","900":"#e6eff8","950":"#f5f9fd"};
const rust = {"50":"#06213a","100":"#082c4d","200":"#0c3d69","300":"#125189","400":"#1a66a8","500":"#2a7fc4","600":"#4f9ad6","700":"#74acdf","800":"#b3d2ee","900":"#d9e9f7","950":"#edf5fc"};
const pine = {
  50: '#06221b', 100: '#0a3228', 200: '#0f4839', 300: '#145f4b', 400: '#1a775e', 500: '#239075',
  600: '#49aa90', 700: '#7ec4af', 800: '#b2dbcd', 900: '#d5ece4', 950: '#e9f5f0',
};
const ochre = {"50":"#2b1d00","100":"#3c2900","200":"#573b00","300":"#735000","400":"#906500","500":"#b88200","600":"#f6b40e","700":"#f8c648","800":"#fbdc8e","900":"#fdedc4","950":"#fef7e3"};
const wine = {"50":"#330709","100":"#45090c","200":"#620d11","300":"#801216","400":"#9b1b1e","500":"#b8252a","600":"#cf5257","700":"#e08a8d","800":"#eebabc","900":"#f7dcdd","950":"#fceeee"};
const clay = {"50":"#330709","100":"#45090c","200":"#620d11","300":"#801216","400":"#9b1b1e","500":"#b8252a","600":"#cf5257","700":"#e08a8d","800":"#eebabc","900":"#f7dcdd","950":"#fceeee"};
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
