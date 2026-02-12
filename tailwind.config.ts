import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
        display: ['var(--font-syne)', 'Syne', 'system-ui', 'sans-serif'],
        title: ['var(--font-phonk)', 'Phonk', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
        'screwed-pop': {
          '0%': { opacity: '0', transform: 'scale(0.5) translateY(-20px)' },
          '30%': { opacity: '1', transform: 'scale(1.15) translateY(0)' },
          '50%': { transform: 'scale(1) translateY(0)' },
          '70%': { opacity: '1', transform: 'scale(1.05)' },
          '100%': { opacity: '0.95', transform: 'scale(1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
      },
      colors: {
        accent: '#CAF76F',
      },
      animation: {
        'fade-in': 'fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in-up': 'fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scale-in 0.3s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.35s ease-out forwards',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-soft': 'pulse-soft 1.5s ease-in-out infinite',
        'bounce-subtle': 'bounce-subtle 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'screwed-pop': 'screwed-pop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'float': 'float 4s ease-in-out infinite',
        'gradient-x': 'gradient-x 8s ease infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
export default config
