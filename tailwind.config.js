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
        'bg-main': 'var(--bg-main)',
        'bg-surface': 'var(--bg-surface)',
        'brand-neon': 'var(--brand-neon)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        // Compatibility keys matching page components
        'main': 'var(--bg-main)',
        'surface': 'var(--bg-surface)',
        'neon': 'var(--brand-neon)',
        'primary': 'var(--text-primary)',
        'secondary': 'var(--text-secondary)',
      },
    },
  },
  plugins: [],
}