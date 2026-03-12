/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#0a1855',
        navy: {
          950: '#050c1d',
          900: '#09142b',
          850: '#0c1c38',
          800: '#112447',
          750: '#172d58',
          700: '#1d3569',
          600: '#2a4685',
          500: '#355ca3',
          400: '#4d74c2',
          300: '#6f91d8',
          200: '#9db6eb',
          100: '#d0dbf7',
          50:  '#f1f4fd',
        },
        accent: {
          500: '#24c8ff',
          400: '#59d6ff',
          300: '#8fe4ff',
          200: '#c7f2ff',
        },
        steel: {
          900: '#141f32',
          800: '#1a273d',
          700: '#22324b',
          600: '#2b3e5c',
          500: '#37506f',
          400: '#52698b',
          300: '#7288aa',
          200: '#9fb1cb',
          100: '#cfd8e6',
        },
      },
      fontFamily: {
        sans:    ['"IBM Plex Sans"', 'sans-serif'],
        display: ['"Syne"', 'sans-serif'],
        mono:    ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        'glow-accent': '0 0 24px rgba(36, 200, 255, 0.25)',
        'glow-sm':     '0 0 12px rgba(36, 200, 255, 0.2)',
        'panel':       '0 12px 40px rgba(5, 12, 29, 0.32)',
        'card':        '0 8px 30px rgba(5, 12, 29, 0.2)',
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
