import type { Config } from 'tailwindcss';
export default { content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'], theme: { extend: { colors: { ink: '#17202a', cream: '#f7f5ef', coral: '#e86f51', teal: '#0e8c86', line: '#e5e1d8' }, fontFamily: { sans: ['var(--font-geist)'] } } }, plugins: [] } satisfies Config;
