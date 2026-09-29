import type { Config } from 'tailwindcss';

/**
 * Design tokens are declared as CSS custom properties in styles/index.css and
 * consumed here through the `rgb(var(--token) / <alpha-value>)` pattern. This
 * keeps Tailwind opacity modifiers working (e.g. `bg-surface/75`) while letting
 * every color flip between the light and dark themes by swapping the variables
 * — no per-element `dark:` variants required.
 */
function token(name: string): string {
  return `rgb(var(${name}) / <alpha-value>)`;
}

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Semantic surfaces / content / borders ──────────────────────────
        bg: token('--bg'),
        surface: {
          DEFAULT: token('--surface'),
          raised: token('--surface-2'),
          sunken: token('--surface-3'),
        },
        content: {
          DEFAULT: token('--content'),
          muted: token('--content-muted'),
          subtle: token('--content-subtle'),
          invert: token('--content-invert'),
        },
        border: {
          DEFAULT: token('--border'),
          strong: token('--border-strong'),
        },
        heading: token('--heading'),

        // ── Brand ───────────────────────────────────────────────────────────
        primary: {
          DEFAULT: token('--primary'),
          hover: token('--primary-hover'),
          active: token('--primary-active'),
          soft: token('--primary-soft'),
        },
        secondary: {
          DEFAULT: token('--secondary'),
          hover: token('--secondary-hover'),
          soft: token('--secondary-soft'),
        },
        accent: {
          DEFAULT: token('--accent'),
          soft: token('--accent-soft'),
        },
        'on-primary': token('--on-primary'),
        'on-secondary': token('--on-secondary'),

        // ── Feedback ──────────────────────────────────────────────────────────
        success: { DEFAULT: token('--success'), surface: token('--success-surface'), content: token('--success-content') },
        warning: { DEFAULT: token('--warning'), surface: token('--warning-surface'), content: token('--warning-content') },
        danger: { DEFAULT: token('--danger'), surface: token('--danger-surface'), content: token('--danger-content') },
        info: { DEFAULT: token('--info'), surface: token('--info-surface'), content: token('--info-content') },

        // ── Categorical chart slots (identity, never status) ───────────────────
        chart: {
          1: token('--chart-1'),
          2: token('--chart-2'),
          3: token('--chart-3'),
          4: token('--chart-4'),
          5: token('--chart-5'),
        },

        // ── Legacy raw brand — still used by the retired v1/v2 screens ────────
        kuaizi: {
          primary: '#F07820',
          secondary: '#1D3557',
          accent: '#457B9D',
          light: '#F1FAEE',
          dark: '#1D3557',
          ink: '#1A1A1A',
          paper: '#FAFAF7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        elevated: '0 4px 6px -1px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.06)',
        pop: '0 10px 25px -5px rgb(15 23 42 / 0.12), 0 8px 10px -6px rgb(15 23 42 / 0.08)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out both',
        'fade-in-up': 'fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 0.3s ease-out both',
      },
    },
  },
} satisfies Config;
