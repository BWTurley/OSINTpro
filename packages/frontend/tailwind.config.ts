import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Entity type colors
        entity: {
          person: '#3b82f6',
          organization: '#8b5cf6',
          domain: '#06b6d4',
          ip: '#f59e0b',
          email: '#10b981',
          phone: '#ec4899',
          hash: '#6366f1',
          cryptocurrency: '#f97316',
          vehicle: '#84cc16',
          location: '#ef4444',
          event: '#14b8a6',
          malware: '#dc2626',
          vulnerability: '#d946ef',
          threat_actor: '#be123c',
        },
        // TLP classification colors
        tlp: {
          white: '#ffffff',
          green: '#22c55e',
          amber: '#f59e0b',
          'amber-strict': '#d97706',
          red: '#ef4444',
        },
        // Severity colors
        severity: {
          critical: '#dc2626',
          high: '#f97316',
          medium: '#eab308',
          low: '#22c55e',
          info: '#3b82f6',
        },
        // App chrome
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          700: '#334155',
          800: '#1e293b',
          850: '#172033',
          900: '#0f172a',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
