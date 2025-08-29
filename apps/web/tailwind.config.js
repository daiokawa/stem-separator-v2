/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0b0b0c',
          soft: '#141416',
        },
        text: {
          DEFAULT: '#e6e6e6',
          mute: '#a1a1aa'
        },
        brand: {
          DEFAULT: '#8b5cf6',
          soft: '#a78bfa'
        }
      }
    }
  },
  plugins: []
}

