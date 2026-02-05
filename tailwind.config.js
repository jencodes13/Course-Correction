/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lato', 'sans-serif'],
        heading: ['Poppins', 'sans-serif'],
        serif: ['DM Serif Display', 'Instrument Serif', 'serif'],
        outfit: ['Outfit', 'sans-serif'],
        jakarta: ['Plus Jakarta Sans', 'sans-serif'],
      },
      colors: {
        background: '#f8fafc',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'float-delayed': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'float-reverse': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(10px)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-delayed': 'float-delayed 7s ease-in-out infinite 1.5s',
        'float-reverse': 'float-reverse 8s ease-in-out infinite 0.5s',
      },
      boxShadow: {
        'floating-card': '0 20px 40px -10px rgba(0, 0, 0, 0.08), 0 10px 20px -5px rgba(0, 0, 0, 0.04)',
        'floating-card-hover': '0 30px 60px -12px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
};
