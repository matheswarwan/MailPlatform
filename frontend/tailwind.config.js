export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0F1117',
          900: '#181C27',
          800: '#1E2436',
          700: '#252B3B',
          600: '#2E3650',
        },
        accent: {
          DEFAULT: '#4F7FFF',
          hover: '#3D6FEF',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
