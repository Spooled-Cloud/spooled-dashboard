/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        lane: {
          DEFAULT: 'var(--lane)',
          border: 'var(--lane-border)',
        },
        spool: {
          accent: 'var(--spool-accent)',
        },
        success: {
          DEFAULT: 'var(--status-completed)',
          foreground: 'var(--status-completed-foreground)',
        },
        warning: {
          DEFAULT: 'var(--status-warning)',
          foreground: 'var(--status-warning-foreground)',
        },
        info: {
          DEFAULT: 'var(--status-scheduled)',
          foreground: 'var(--status-scheduled-foreground)',
        },
        status: {
          pending: {
            DEFAULT: 'var(--status-pending)',
            foreground: 'var(--status-pending-foreground)',
          },
          scheduled: {
            DEFAULT: 'var(--status-scheduled)',
            foreground: 'var(--status-scheduled-foreground)',
          },
          processing: {
            DEFAULT: 'var(--status-processing)',
            foreground: 'var(--status-processing-foreground)',
          },
          retrying: {
            DEFAULT: 'var(--status-retrying)',
            foreground: 'var(--status-retrying-foreground)',
          },
          completed: {
            DEFAULT: 'var(--status-completed)',
            foreground: 'var(--status-completed-foreground)',
          },
          failed: {
            DEFAULT: 'var(--status-failed)',
            foreground: 'var(--status-failed-foreground)',
          },
          canceled: {
            DEFAULT: 'var(--status-canceled)',
            foreground: 'var(--status-canceled-foreground)',
          },
          paused: {
            DEFAULT: 'var(--status-paused)',
            foreground: 'var(--status-paused-foreground)',
          },
          offline: {
            DEFAULT: 'var(--status-offline)',
            foreground: 'var(--status-offline-foreground)',
          },
          degraded: {
            DEFAULT: 'var(--status-degraded)',
            foreground: 'var(--status-degraded-foreground)',
          },
          warning: {
            DEFAULT: 'var(--status-warning)',
            foreground: 'var(--status-warning-foreground)',
          },
          quota: {
            DEFAULT: 'var(--status-quota)',
            foreground: 'var(--status-quota-foreground)',
          },
          unknown: {
            DEFAULT: 'var(--status-unknown)',
            foreground: 'var(--status-unknown-foreground)',
          },
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
