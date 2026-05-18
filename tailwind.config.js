/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gala: {
          ink: '#09080c',
          plum: '#14111c',
          gold: '#c9ae6e',
          'gold-bright': '#dcc489',
          cream: '#f7f2ea',
          rose: '#9c3049',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        display: ['"Cormorant Garamond"', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        gala:
          '0 24px 48px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        'gala-lg':
          '0 32px 64px -16px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'gala-nav': '0 -12px 40px rgba(0, 0, 0, 0.35)',
      },
      transitionTimingFunction: {
        gala: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        gala: '320ms',
      },
    },
  },
  plugins: [],
}
