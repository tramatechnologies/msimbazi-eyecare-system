/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./views/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'xs': '12px',   // 12px - small text, labels
        'sm': '14px',   // 14px - body text, base
        'base': '16px', // 16px - headings, emphasis
      },
      colors: {
        brand: {
          primary: 'var(--brand-primary)',
          'primary-dark': 'var(--brand-primary-dark)',
          'primary-light': 'var(--brand-primary-light)',
          'primary-50': 'var(--brand-primary-50)',
          'primary-100': 'var(--brand-primary-100)',
          secondary: 'var(--brand-secondary)',
          'secondary-dark': 'var(--brand-secondary-dark)',
          'secondary-light': 'var(--brand-secondary-light)',
          'secondary-50': 'var(--brand-secondary-50)',
          'secondary-100': 'var(--brand-secondary-100)',
          success: 'var(--brand-success)',
          danger: 'var(--brand-danger)',
          warning: 'var(--brand-warning)',
          info: 'var(--brand-info)',
        },
      },
    },
  },
  plugins: [],
}
