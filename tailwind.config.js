/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Flat colors (e.g., bg-main, text-primary)
        main: '#121214',
        surface: '#1E1E24',
        neon: '#DEFF9A',
        primary: '#F5F5F5',
        secondary: '#C2D6C4',
        
        // Nested colors to support project-wide styles (e.g., bg-bg-main, text-text-primary, bg-brand-neon)
        brand: {
          neon: '#DEFF9A',
        },
        bg: {
          main: '#121214',
          surface: '#1E1E24',
        },
        text: {
          primary: '#F5F5F5',
          secondary: '#C2D6C4',
        },
      },
    },
  },
  plugins: [],
}