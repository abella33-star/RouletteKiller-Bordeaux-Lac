import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Stealth Dark palette
        bg:       '#000000',
        surface:  '#0A0A0A',
        card:     '#111111',
        border:   '#1E1E1E',
        // Signal colours
        neon:     '#00E676',   // PLAY
        gold:     '#FFD700',   // KILLER
        orange:   '#FF9800',   // MEDIUM / AGGRESSIVE
        crimson:  '#FF1744',   // NOISE / WARNING
        muted:    '#555555',
        // Sector colours
        voisins:  '#C8A951',
        tiers:    '#4E88FF',
        orphelins:'#FF6B35',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      screens: {
        // iPhone 16 Pro Max viewport
        'ip16pm': '430px',
      },
      animation: {
        'pulse-fast':  'pulse 0.8s ease-in-out infinite',
        'glow-green':  'glowGreen 2s ease-in-out infinite',
        'glow-gold':   'glowGold 0.6s ease-in-out infinite',
        'spin-slow':   'spin 8s linear infinite',
        'slide-up':    'slideUp 0.3s ease-out',
      },
      keyframes: {
        glowGreen: {
          '0%,100%': { boxShadow: '0 0 8px rgba(0,230,118,0.4)' },
          '50%':     { boxShadow: '0 0 24px rgba(0,230,118,0.9)' },
        },
        glowGold: {
          '0%,100%': { boxShadow: '0 0 12px rgba(255,215,0,0.5)' },
          '50%':     { boxShadow: '0 0 30px rgba(255,215,0,1)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
