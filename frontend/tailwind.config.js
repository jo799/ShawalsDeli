/** @type {import('tailwindcss').Config} */

// Every color below resolves through `rgb(var(--x) / <alpha-value>)` instead
// of a fixed hex string. This is what makes a runtime light/dark toggle
// possible without editing every page that uses `bg-surface-300`,
// `text-text-primary`, and so on — the actual RGB values live in index.css
// as CSS variables (a dark set under :root, a light set under .light), and
// Tailwind's own opacity modifiers (bg-brand/10, bg-status-success/10 — used
// extensively throughout this app) keep working correctly with this pattern,
// which they would NOT if colors were swapped via plain CSS variables like
// `background: var(--x)` directly.
const withOpacity = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: withOpacity('--color-brand'),
          50:  withOpacity('--color-brand-50'),
          100: withOpacity('--color-brand-100'),
          200: withOpacity('--color-brand-200'),
          300: withOpacity('--color-brand-300'),
          400: withOpacity('--color-brand-400'),
          500: withOpacity('--color-brand-500'),
          600: withOpacity('--color-brand-600'),
          700: withOpacity('--color-brand-700'),
          800: withOpacity('--color-brand-800'),
          900: withOpacity('--color-brand-900'),
        },
        surface: {
          DEFAULT: withOpacity('--color-surface'),
          50:  withOpacity('--color-surface-50'),
          100: withOpacity('--color-surface-100'),
          200: withOpacity('--color-surface-200'),
          300: withOpacity('--color-surface-300'),
          400: withOpacity('--color-surface-400'),
          500: withOpacity('--color-surface-500'),
          600: withOpacity('--color-surface-600'),
          card: withOpacity('--color-surface-card'),
          nav: withOpacity('--color-surface-nav'),
        },
        border: {
          DEFAULT: withOpacity('--color-border'),
          light: withOpacity('--color-border-light'),
          focus: withOpacity('--color-border-focus'),
        },
        text: {
          primary: withOpacity('--color-text-primary'),
          secondary: withOpacity('--color-text-secondary'),
          muted: withOpacity('--color-text-muted'),
          brand: withOpacity('--color-text-brand'),
        },
        status: {
          success: withOpacity('--color-status-success'),
          warning: withOpacity('--color-status-warning'),
          error: withOpacity('--color-status-error'),
          info: withOpacity('--color-status-info'),
          purple: withOpacity('--color-status-purple'),
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        modal: '0 20px 60px rgba(0,0,0,0.6)',
        brand: '0 4px 14px rgba(245,158,11,0.3)',
      },
    },
  },
  plugins: [],
};