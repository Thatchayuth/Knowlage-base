/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#020817',
          900: '#050f2c',
          850: '#071538',
          800: '#0a1d4a',
          750: '#0d2560',
          700: '#102e75',
          600: '#1a3f9e',
          500: '#2452c7',
          400: '#3b6ce8',
          300: '#6b95f0',
          200: '#a5bdf5',
          100: '#d4e0fb',
          50:  '#edf1fd',
        },
        accent: {
          500: '#00c8ff',
          400: '#38d4ff',
          300: '#7fe3ff',
          200: '#b8efff',
        },
        steel: {
          900: '#0d1b2e',
          800: '#152238',
          700: '#1e3049',
          600: '#263d5c',
          500: '#304e71',
          400: '#4a6d94',
          300: '#6b90b8',
          200: '#96b5d4',
          100: '#c4d7ea',
        },
      },
      fontFamily: {
        sans:    ['"IBM Plex Sans"', 'sans-serif'],
        display: ['"Syne"', 'sans-serif'],
        mono:    ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        'glow-accent': '0 0 20px rgba(0, 200, 255, 0.25)',
        'glow-sm':     '0 0 10px rgba(0, 200, 255, 0.15)',
        'panel':       '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card':        '0 2px 12px rgba(0, 0, 0, 0.3)',
      },
      animation: {
        'fade-in':    'fadeIn 0.35s ease forwards',
        'slide-in':   'slideIn 0.3s ease forwards',
        'pulse-slow': 'pulse 3s infinite',
        'shimmer':    'shimmer 1.5s infinite linear',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideIn: { from: { opacity: 0, transform: 'translateX(-12px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
      },
    },
  },
  plugins: [],
}
