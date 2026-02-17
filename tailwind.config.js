/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'vortex-red': '#DC2626',
        'vortex-gray': '#6B7280',
        'vortex-dark': '#111827',
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'display': ['Oswald', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'gymnastics-scroll': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'gymnastics-scroll': 'gymnastics-scroll 90s linear infinite',
      },
    },
  },
  plugins: [],
}
