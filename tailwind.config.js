import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.{ts,tsx}', './components/**/*.{ts,tsx}', './utils/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Keyed on height, not width: a phone in landscape is wide AND short,
      // so sm:/md: would make it worse, not better.
      screens: {
        short: { raw: '(max-height: 700px)' },
      },
    },
  },
  plugins: [animate],
};
