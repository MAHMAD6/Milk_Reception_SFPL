/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1440px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        'border-strong': 'hsl(var(--border-strong))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        subtle: 'hsl(var(--subtle))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          hover: 'hsl(var(--primary-hover))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Legacy aliases kept so older class names resolve to the same tokens.
        sfpl: {
          bg: 'hsl(var(--background))',
          surface: 'hsl(var(--card))',
          'surface-muted': 'hsl(var(--muted))',
          'surface-strong': 'hsl(var(--accent))',
          border: 'hsl(var(--border))',
          'border-strong': 'hsl(var(--border-strong))',
          primary: 'hsl(var(--primary))',
          'primary-hover': 'hsl(var(--primary-hover))',
          text: 'hsl(var(--foreground))',
          'text-secondary': 'hsl(var(--secondary-foreground))',
          'text-muted': 'hsl(var(--muted-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        '2xs': '0 1px 0 0 rgb(15 23 42 / 0.03)',
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
      },
      backdropBlur: {
        xs: '2px',
      },
      /**
       * Layering scale — the ONLY z-index values the app should use.
       * Values live in globals.css (--z-*) so CSS and JS share one source of truth.
       */
      zIndex: {
        raised: 'var(--z-raised)',
        sticky: 'var(--z-sticky)',
        sidebar: 'var(--z-sidebar)',
        header: 'var(--z-header)',
        modal: 'var(--z-modal)',
        popover: 'var(--z-popover)',
        banner: 'var(--z-banner)',
        toast: 'var(--z-toast)',
        tooltip: 'var(--z-tooltip)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
