/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
        colors: {
            'brand-teal': '#28787C',
            'brand-gold': '#E5C158',
            'brand-mint': '#A7D7D9',
            'brand-glass': 'rgba(255, 255, 255, 0.08)',
            'brand-glass-border': 'rgba(255, 255, 255, 0.15)',
        },
        fontFamily: {
            'cormorant': ['"Noto Serif TC"', '"Cormorant Garamond"', 'serif'],
            'outfit': ['"Noto Sans TC"', '"Outfit"', 'sans-serif'],
        },
        animation: {
            'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            'scan': 'scanLine 2s linear infinite',
        },
        keyframes: {
            scanLine: {
                '0%': { transform: 'translateY(-10px)' },
                '100%': { transform: 'translateY(250px)' },
            }
        }
    }
  },
  plugins: [],
}