/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#F59E0B',
          50:  '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        surface: {
          DEFAULT: '#1A1A1A',
          50:  '#2A2A2A',
          100: '#252525',
          200: '#1F1F1F',
          300: '#1A1A1A',
          400: '#161616',
          500: '#111111',
          600: '#0D0D0D',
          card: '#1E1E1E',
          nav: '#141414',
        },
        border: {
          DEFAULT: '#2A2A2A',
          light: '#333333',
          focus: '#F59E0B',
        },
        text: {
          primary: '#F5F5F5',
          secondary: '#9CA3AF',
          muted: '#6B7280',
          brand: '#F59E0B',
        },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#3B82F6',
          purple: '#8B5CF6',
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
