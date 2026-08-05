/**
 * Design System Tokens
 * Central color palette, typography, and spacing constants.
 *
 * Usage:
 *   import { theme } from '@/components/ui/theme';
 */
export const theme = {
  colors: {
    primary: {
      50: 'var(--color-primary-50)',
      100: 'var(--color-primary-100)',
      200: 'var(--color-primary-200)',
      300: 'var(--color-primary-300)',
      400: 'var(--color-primary-400)',
      500: 'var(--color-primary-500)',
      600: 'var(--color-primary-600)',
      700: 'var(--color-primary-700)',
      800: 'var(--color-primary-800)',
      900: 'var(--color-primary-900)',
    },
    slate: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      850: '#1e2a3a',
      900: '#0f172a',
      950: '#090d16',
    },
    status: {
      success: 'var(--color-status-success, #10b981)',
      warning: 'var(--color-status-warning, #f59e0b)',
      danger: 'var(--color-status-danger, #ef4444)',
      info: 'var(--color-status-info, #38bdf8)',
    },
    bg: {
      app: 'var(--bg-app)',
      card: 'var(--bg-card)',
      input: 'var(--bg-input)',
      sidebar: 'var(--bg-sidebar)',
    },
    border: {
      app: 'var(--border-app)',
      card: 'var(--border-card)',
    },
    text: {
      main: 'var(--text-main)',
      muted: 'var(--text-muted)',
      inverse: 'var(--text-inverse)',
    },
    brand: 'var(--primary-brand)',
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    scale: {
      xs: '0.625rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
    },
  },
  spacing: {
    xs: 'var(--spacing-xs)',
    sm: 'var(--spacing-sm)',
    md: 'var(--spacing-md)',
    lg: 'var(--spacing-lg)',
    xl: 'var(--spacing-xl)',
    xxl: 'var(--spacing-xxl)',
  },
  borderRadius: {
    xs: 'var(--radius-xs)',
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)',
    '2xl': 'var(--radius-2xl)',
    full: 'var(--radius-full)',
  },
  transitions: {
    fast: 'duration-150',
    base: 'duration-200',
    slow: 'duration-300',
  },
  shadows: {
    sm: 'var(--shadow-premium-sm)',
    md: 'var(--shadow-premium-md)',
    lg: 'var(--shadow-premium-lg)',
    xl: 'var(--shadow-premium-xl)',
  },
};

export default theme;
