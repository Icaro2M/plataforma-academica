import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--foreground)', cream: 'var(--background)', line: 'var(--line)',
        brand: 'var(--brand)', accent: 'var(--accent)', muted: 'var(--muted)', warm: 'var(--warm)',
        teal: 'var(--accent)', coral: 'var(--warm)',
      },
      fontFamily: { sans: ['Segoe UI Variable Text', 'Segoe UI', 'Arial', 'sans-serif'], display: ['Segoe UI Variable Display', 'Segoe UI', 'Arial', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config;
